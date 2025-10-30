"""Pytest configuration and fixtures for the restaurant management system.

This module sets up an isolated SQLite database for each test, overrides
the FastAPI dependency that provides the database session, and inserts
minimal seed data such as a tenant, roles and a manager user. Tests
can rely on these fixtures to authenticate and interact with the API
without polluting the development database.

The fixtures exposed here include:

* ``engine``: an in‑memory SQLite engine used for the duration of the test
  session. All tables are created up front and dropped when the session
  ends.
* ``db_session``: a SQLAlchemy session bound to the test engine. Each test
  gets its own transaction which is rolled back at the end so state does
  not leak between tests.
* ``override_get_db``: a fixture that plugs the test session into the
  application by overriding the ``get_db`` dependency.
* ``test_client``: an ``AsyncClient`` pointing at the FastAPI app. Requests
  made through this client automatically include the ``X‑Tenant`` header
  set to ``test`` for multi‑tenancy.
* ``seed_data``: populates the database with a tenant, roles, a manager
  user and some products, a recipe and initial stock. It returns
  convenient references that tests can use (e.g. the manager user and
  dish product).
"""

import os
import sys
import asyncio
from pathlib import Path
from typing import Dict, Tuple

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from fastapi import FastAPI

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import app as fastapi_app
from app.core.database import get_db
from app.models import Base
from app.models.user import Tenant, Role, User
from app.models.product import Unit, Product, ProductType, Recipe, RecipeItem
from app.models.stock import StockMove, StockMoveType
from app.core.security import get_password_hash


# Ensure the application is running with a deterministic secret and short
# token expiration during tests. These environment variables must be set
# before the FastAPI app imports the settings module.
os.environ.setdefault("JWT_SECRET", "testsecret")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_MINUTES", "1440")


# Create an in‑memory SQLite engine for the entire test session. Using a
# session level fixture means the tables are created once per session and
# dropped afterwards.
@pytest.fixture(scope="session")
def engine() -> "Engine":
    test_engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    yield test_engine
    Base.metadata.drop_all(bind=test_engine)


# Provide a sessionmaker bound to the in‑memory engine. Each test gets a
# brand new transaction which is rolled back at the end of the test. This
# ensures isolation between tests while still sharing the same schema.
@pytest.fixture
def db_session(engine) -> "Session":
    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


# Override the application's database dependency so that it returns our
# test session instead of opening a new connection on each request. The
# override is installed before each test and removed afterwards.
@pytest.fixture(autouse=True)
def override_get_db(db_session):
    def _get_db_override():  # pragma: no cover
        try:
            yield db_session
        finally:
            pass
    # apply override
    fastapi_app.dependency_overrides[get_db] = _get_db_override
    yield
    # remove override
    fastapi_app.dependency_overrides.pop(get_db, None)


# Create an asynchronous HTTP client that will be used in tests. The
# ``X‑Tenant`` header is preconfigured to ``test`` because most
# endpoints require a tenant id. Authentication headers must be set by
# individual tests after obtaining a token.
@pytest_asyncio.fixture
async def test_client() -> AsyncClient:
    async with AsyncClient(app=fastapi_app, base_url="http://testserver") as client:
        # Provide a default tenant header on every request
        client.headers.update({"X-Tenant": "test"})
        yield client


# Seed minimal data needed for the tests: a tenant, roles, a manager user,
# basic units, an ingredient and a dish with a recipe, plus initial
# stock entries. The return value exposes the created manager user and
# product identifiers to the tests.
@pytest.fixture
def seed_data(db_session) -> Dict[str, any]:
    # Create tenant record
    tenant_id = "test"
    tenant = Tenant(name="Test Tenant", description="Test tenant for unit tests", slug=tenant_id)
    db_session.add(tenant)
    db_session.flush()
    # Create roles
    role_names = ["owner", "manager", "cashier", "chef", "waiter", "purchasing", "accountant", "guest_view"]
    roles: Dict[str, Role] = {}
    for name in role_names:
        r = Role(name=name, description=name.capitalize(), tenant_id=tenant_id)
        db_session.add(r)
        db_session.flush()
        roles[name] = r
    # Create a manager user
    manager_password = "secret"
    manager_user = User(
        username="manager",
        email="manager@test.com",
        hashed_password=get_password_hash(manager_password),
        is_active=True,
        tenant_id=tenant_id,
    )
    manager_user.roles.append(roles["manager"])
    manager_user.roles.append(roles["cashier"])
    db_session.add(manager_user)
    db_session.flush()
    # Create units (grams and portion)
    gram = Unit(name="grama", abbreviation="g", tenant_id=tenant_id)
    portion = Unit(name="porção", abbreviation="porção", tenant_id=tenant_id)
    db_session.add_all([gram, portion])
    db_session.flush()
    # Create ingredient product
    ingredient = Product(
        name="Carne",
        type=ProductType.INGREDIENT,
        unit_id=gram.id,
        cost_price=30.0,
        tenant_id=tenant_id,
    )
    db_session.add(ingredient)
    db_session.flush()
    # Create dish product
    dish = Product(
        name="Bife",
        type=ProductType.DISH,
        unit_id=portion.id,
        sale_price=50.0,
        tenant_id=tenant_id,
    )
    db_session.add(dish)
    db_session.flush()
    # Create recipe for dish: 200g of ingredient yields one portion
    recipe = Recipe(product_id=dish.id, yield_qty=1, yield_unit_id=portion.id, tenant_id=tenant_id)
    db_session.add(recipe)
    db_session.flush()
    recipe_item = RecipeItem(recipe_id=recipe.id, ingredient_id=ingredient.id, quantity=200, unit_id=gram.id, tenant_id=tenant_id)
    db_session.add(recipe_item)
    # Create initial stock: 1000g of ingredient and 10 portions of dish (prepped)
    in_move_ing = StockMove(
        product_id=ingredient.id,
        quantity=1000,
        unit_id=gram.id,
        type=StockMoveType.IN,
        reason="Initial stock ingredient",
        tenant_id=tenant_id,
    )
    in_move_dish = StockMove(
        product_id=dish.id,
        quantity=10,
        unit_id=portion.id,
        type=StockMoveType.IN,
        reason="Initial stock dish",
        tenant_id=tenant_id,
    )
    db_session.add_all([in_move_ing, in_move_dish])
    db_session.commit()
    return {
        "tenant_id": tenant_id,
        "manager_user": manager_user,
        "manager_password": manager_password,
        "ingredient": ingredient,
        "dish": dish,
    }
