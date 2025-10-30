"""Tests for stock deduction when an order is paid.

This test creates a single order for a dish that has a recipe
consuming an ingredient. Upon payment, the system should record
``OUT`` stock movements for each ingredient used according to the
recipe. The test verifies that the correct quantity is recorded and
that no deduction is made before payment.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.models.stock import StockMove, StockMoveType


@pytest.mark.asyncio
async def test_stock_is_deducted_on_payment(test_client: AsyncClient, seed_data, db_session: Session):
    """Paying an order should create OUT stock moves based on the recipe."""
    # Log in as the manager user
    login_resp = await test_client.post(
        "/api/auth/login",
        json={"username": seed_data["manager_user"].username, "password": seed_data["manager_password"]},
    )
    assert login_resp.status_code == 200
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    # Create an order for one portion of the dish
    dish_id = seed_data["dish"].id
    order_resp = await test_client.post(
        "/api/orders",
        json={"items": [{"product_id": dish_id, "quantity": 1, "notes": None}]},
        headers=headers,
    )
    assert order_resp.status_code == 200, order_resp.text
    order_data = order_resp.json()
    order_id = order_data["id"]
    # At this point no OUT movements should exist for the ingredient
    ingredient_id = seed_data["ingredient"].id
    pre_moves = (
        db_session.query(StockMove)
        .filter(
            StockMove.tenant_id == seed_data["tenant_id"],
            StockMove.product_id == ingredient_id,
            StockMove.type == StockMoveType.OUT,
        )
        .all()
    )
    # Only initial stock moves should exist (no OUT yet)
    assert len(pre_moves) == 0
    # Pay the order in full
    pay_resp = await test_client.put(
        f"/api/orders/{order_id}/pay",
        json=[{"method": "cash", "amount": order_data["total"]}],
        headers=headers,
    )
    assert pay_resp.status_code == 200, pay_resp.text
    # Query stock moves again
    post_moves = (
        db_session.query(StockMove)
        .filter(
            StockMove.tenant_id == seed_data["tenant_id"],
            StockMove.product_id == ingredient_id,
            StockMove.type == StockMoveType.OUT,
        )
        .all()
    )
    # Now there should be one OUT move for the ingredient
    assert len(post_moves) == 1
    move = post_moves[0]
    # The quantity should equal the recipe consumption (200 grams) for one dish
    assert move.quantity == 200
    assert move.reason.startswith("Saída por venda")