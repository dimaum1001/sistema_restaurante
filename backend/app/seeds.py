"""Script para popular o banco de dados com dados de exemplo.

Execute `python -m app.seeds` para rodar este script. Ele cria um tenant
"demo" com usuários, produtos, fichas técnicas, estoque, pedidos e outras
entidades básicas para experimentação.
"""
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

from faker import Faker

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.database import engine, SessionLocal
from app.core.security import get_password_hash
from app.models import Base
from app.models.customer import Customer, Consent
from app.models.order import Table, Order, OrderItem, OrderStatus, Payment, PaymentMethod, PaymentStatus
from app.models.product import Unit, Product, ProductType, Recipe, RecipeItem
from app.models.purchase import Supplier, PurchaseOrder, PurchaseItem, PurchaseStatus, Payable, PayableStatus
from app.models.stock import Batch, StockMove, StockMoveType, InventoryRule
from app.models.user import Tenant, User, Role

fake = Faker("pt_BR")


def seed():
    # Cria estruturas
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Verifica se já existem dados
    if db.query(Tenant).first():
        print("Banco já possui dados. Abortando seeds.")
        db.close()
        return
    tenant_id = "demo"
    # Tenant
    tenant = Tenant(name="Restaurante Demo", description="Tenant de demonstracao", slug=tenant_id)
    db.add(tenant)
    db.commit()
    # Roles
    role_names = ["owner", "manager", "cashier", "chef", "waiter", "purchasing", "accountant", "guest_view"]
    roles = {}
    for name in role_names:
        r = Role(name=name, description=name.capitalize(), tenant_id=tenant_id)
        db.add(r)
        db.flush()
        roles[name] = r
    # Users
    users_data = [
        ("owner", "owner", ["owner"]),
        ("manager", "manager", ["manager"]),
        ("caixa", "cashier", ["cashier"]),
        ("chef", "chef", ["chef"]),
        ("garcom", "waiter", ["waiter"]),
        ("compras", "purchasing", ["purchasing"]),
        ("conta", "accountant", ["accountant"]),
    ]
    users = {}
    for username, password, rnames in users_data:
        user = User(
            username=username,
            email=f"{username}@example.com",
            hashed_password=get_password_hash(password),
            is_active=True,
            tenant_id=tenant_id,
        )
        # associa papéis
        for rn in rnames:
            user.roles.append(roles[rn])
        db.add(user)
        db.flush()
        users[username] = user
    # Units
    units_data = [
        ("grama", "g"),
        ("quilo", "kg"),
        ("mililitro", "ml"),
        ("litro", "L"),
        ("unidade", "un"),
        ("porção", "porção"),
    ]
    units = {}
    for name, abbr in units_data:
        unit = Unit(name=name, abbreviation=abbr, tenant_id=tenant_id)
        db.add(unit)
        db.flush()
        units[abbr] = unit
    # Products (ingredients)
    ingredients_data = [
        ("Arroz", "g", 5.0),
        ("Feijão", "g", 7.0),
        ("Carne", "g", 30.0),
        ("Frango", "g", 20.0),
        ("Alface", "g", 3.0),
        ("Tomate", "g", 4.0),
    ]
    products = {}
    for name, unit_abbr, cost in ingredients_data:
        p = Product(
            name=name,
            type=ProductType.INGREDIENT,
            unit_id=units[unit_abbr].id,
            cost_price=cost,
            sale_price=None,
            tenant_id=tenant_id,
        )
        db.add(p)
        db.flush()
        products[name] = p
        rule = InventoryRule(
            product_id=p.id,
            reorder_point=2000.0,
            par_level=6000.0,
            lead_time_days=3,
            tenant_id=tenant_id,
        )
        db.add(rule)
    # Dishes
    dishes_data = [
        ("Prato Executivo", 40.0, [("Arroz", 200), ("Feijão", 150), ("Carne", 200), ("Alface", 30), ("Tomate", 30)]),
        ("Salada", 20.0, [("Alface", 100), ("Tomate", 50)]),
    ]
    for dish_name, sale_price, recipe_items in dishes_data:
        dish = Product(
            name=dish_name,
            type=ProductType.DISH,
            unit_id=units["porção"].id,
            cost_price=None,
            sale_price=sale_price,
            tenant_id=tenant_id,
        )
        db.add(dish)
        db.flush()
        products[dish_name] = dish
        rule = InventoryRule(
            product_id=dish.id,
            reorder_point=20.0,
            par_level=60.0,
            lead_time_days=2,
            tenant_id=tenant_id,
        )
        db.add(rule)
        recipe = Recipe(product_id=dish.id, yield_qty=1, yield_unit_id=units["porção"].id, tenant_id=tenant_id)
        db.add(recipe)
        db.flush()
        for ing_name, qty in recipe_items:
            ing = products[ing_name]
            ri = RecipeItem(recipe_id=recipe.id, ingredient_id=ing.id, quantity=qty, unit_id=units["g"].id, tenant_id=tenant_id)
            db.add(ri)
    # Batches (estoque inicial)
    for p in products.values():
        qty = 10000 if p.type == ProductType.INGREDIENT else 50
        batch = Batch(
            product_id=p.id,
            quantity=qty,
            unit_id=p.unit_id,
            cost_price=p.cost_price or 0,
            expiration_date=(datetime.utcnow() + timedelta(days=90)).date(),
            lot_code=f"L{random.randint(1000, 9999)}",
            tenant_id=tenant_id,
        )
        db.add(batch)
        move = StockMove(
            product_id=p.id,
            quantity=qty,
            unit_id=p.unit_id,
            type=StockMoveType.IN,
            reason="Seed inicial",
            tenant_id=tenant_id,
        )
        db.add(move)
    # Suppliers
    supplier_names = ["Fornecedor A", "Fornecedor B", "Fornecedor C"]
    suppliers = []
    for name in supplier_names:
        s = Supplier(name=name, contact=fake.name(), phone=fake.phone_number(), email=fake.email(), tenant_id=tenant_id)
        db.add(s)
        db.flush()
        suppliers.append(s)
    # Sample purchase order
    po = PurchaseOrder(
        supplier_id=suppliers[0].id,
        status=PurchaseStatus.RECEIVED,
        approved_at=datetime.utcnow(),
        received_at=datetime.utcnow(),
        tenant_id=tenant_id,
    )
    db.add(po)
    db.flush()
    total_amount = 0.0
    for p_name in ["Arroz", "Feijão"]:
        p = products[p_name]
        qty = 5000
        unit_price = p.cost_price
        poi = PurchaseItem(
            purchase_order_id=po.id,
            product_id=p.id,
            quantity=qty,
            unit_id=p.unit_id,
            unit_price=unit_price,
            tenant_id=tenant_id,
        )
        db.add(poi)
        # entrada de estoque
        move = StockMove(
            product_id=p.id,
            quantity=qty,
            unit_id=p.unit_id,
            type=StockMoveType.IN,
            reason="Compra seed",
            tenant_id=tenant_id,
        )
        db.add(move)
        total_amount += qty * unit_price
    payable = Payable(
        supplier_id=po.supplier_id,
        purchase_order_id=po.id,
        due_date=datetime.utcnow().date() + timedelta(days=30),
        amount=total_amount,
        status=PayableStatus.OPEN,
        description="Compra inicial",
        tenant_id=tenant_id,
    )
    db.add(payable)
    # Tables
    tables = []
    for i in range(1, 11):
        table = Table(name=f"Mesa {i}", status="free", capacity=4, tenant_id=tenant_id)
        db.add(table)
        db.flush()
        tables.append(table)
    # Customers
    customers = []
    for i in range(10):
        c = Customer(
            name=fake.name(),
            phone=fake.phone_number(),
            email=fake.email(),
            preferences=None,
            allergies=None,
            tenant_id=tenant_id,
        )
        db.add(c)
        db.flush()
        customers.append(c)
        # consentimento marketing e fidelidade
        for purpose in ["marketing", "fidelidade"]:
            cons = Consent(customer_id=c.id, purpose=purpose, tenant_id=tenant_id)
            db.add(cons)
    # Sample orders (últimos 30 dias)
    for _ in range(100):
        customer = random.choice(customers)
        table = random.choice(tables)
        order = Order(
            table_id=table.id,
            customer_id=customer.id,
            status=OrderStatus.PAID,
            opened_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            closed_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            tenant_id=tenant_id,
        )
        db.add(order)
        db.flush()
        total = 0.0
        # adiciona 1-3 items
        for _ in range(random.randint(1, 3)):
            product = random.choice([products["Prato Executivo"], products["Salada"]])
            qty = random.randint(1, 3)
            oi = OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=qty,
                unit_price=product.sale_price,
                notes=None,
                tenant_id=tenant_id,
            )
            db.add(oi)
            total += qty * (product.sale_price or 0)
        order.total = total
        # pagamentos
        pay = Payment(
            order_id=order.id,
            method=random.choice(list(PaymentMethod)),
            amount=total,
            status=PaymentStatus.COMPLETED,
            tenant_id=tenant_id,
        )
        db.add(pay)
    db.commit()
    db.close()
    print("Seeds executadas com sucesso.")


if __name__ == "__main__":
    seed()
