from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session

from ...api.deps import get_db_dep, get_tenant_id, require_roles
from ...models.order import Order, OrderItem, OrderStatus
from ...models.product import Product, ProductType, Recipe, RecipeItem
from ...modules.analytics import build_daily_overview

router = APIRouter()


@router.get("/sales")
def sales_report(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(require_roles("owner", "manager", "accountant")),
):
    try:
        start = (
            datetime.fromisoformat(start_date)
            if start_date
            else datetime.utcnow() - timedelta(days=30)
        )
        end = datetime.fromisoformat(end_date) if end_date else datetime.utcnow()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date format") from exc

    data = (
        db.query(
            cast(Order.closed_at, Date).label("day"),
            func.sum(Order.total).label("total"),
        )
        .filter(
            Order.tenant_id == tenant_id,
            Order.status == OrderStatus.PAID,
            Order.closed_at >= start,
            Order.closed_at <= end,
        )
        .group_by(cast(Order.closed_at, Date))
        .order_by(cast(Order.closed_at, Date))
        .all()
    )
    return {"sales": [{"date": str(row.day), "total": row.total} for row in data]}


@router.get("/cmv")
def cmv_report(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(require_roles("owner", "manager", "accountant")),
):
    try:
        start = (
            datetime.fromisoformat(start_date)
            if start_date
            else datetime.utcnow() - timedelta(days=30)
        )
        end = datetime.fromisoformat(end_date) if end_date else datetime.utcnow()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date format") from exc

    revenue = (
        db.query(func.sum(Order.total))
        .filter(
            Order.tenant_id == tenant_id,
            Order.status == OrderStatus.PAID,
            Order.closed_at >= start,
            Order.closed_at <= end,
        )
        .scalar()
    ) or 0.0

    orders = (
        db.query(Order)
        .filter(
            Order.tenant_id == tenant_id,
            Order.status == OrderStatus.PAID,
            Order.closed_at >= start,
            Order.closed_at <= end,
        )
        .all()
    )
    cost = 0.0
    for order in orders:
        for item in order.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                continue
            if product.type == ProductType.DISH:
                recipe = (
                    db.query(Recipe)
                    .filter(
                        Recipe.product_id == product.id,
                        Recipe.tenant_id == tenant_id,
                    )
                    .first()
                )
                if recipe:
                    for recipe_item in recipe.items:
                        ingredient = (
                            db.query(Product)
                            .filter(Product.id == recipe_item.ingredient_id)
                            .first()
                        )
                        if ingredient:
                            qty = (item.quantity * recipe_item.quantity) / recipe.yield_qty
                            cost += (ingredient.cost_price or 0.0) * qty
            else:
                cost += (product.cost_price or 0.0) * item.quantity

    cmv_percentage = (cost / revenue * 100.0) if revenue else None
    return {
        "revenue": revenue,
        "cost": cost,
        "cmv_percentage": cmv_percentage,
    }


@router.get("/turnover")
def turnover_report(
    top: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(require_roles("owner", "manager", "accountant")),
):
    rows = (
        db.query(
            OrderItem.product_id,
            func.sum(OrderItem.quantity).label("qty"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            Order.tenant_id == tenant_id,
            Order.status == OrderStatus.PAID,
        )
        .group_by(OrderItem.product_id)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(top)
        .all()
    )
    payload = []
    for product_id, quantity in rows:
        product = db.query(Product).filter(Product.id == product_id).first()
        if product:
            payload.append({"product": product.name, "quantity": quantity})
    return {"turnover": payload}


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(require_roles("owner", "manager", "cashier")),
):
    today = datetime.utcnow().date()
    overview = build_daily_overview(db, tenant_id, target_date=today, top_limit=5)
    cmv = cmv_report(
        start_date=str(today),
        end_date=str(today + timedelta(days=1)),
        db=db,
        tenant_id=tenant_id,
    )
    open_orders = (
        db.query(Order)
        .filter(Order.tenant_id == tenant_id, Order.status == OrderStatus.OPEN)
        .count()
    )
    return {
        "vendas_do_dia": overview.total_revenue,
        "ticket_medio": overview.average_ticket,
        "cmv_percentual": cmv["cmv_percentage"],
        "mesas_abertas": open_orders,
    }
