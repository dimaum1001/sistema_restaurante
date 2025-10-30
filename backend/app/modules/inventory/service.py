from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List

from sqlalchemy import case, func, inspect
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ...models.product import Product, Unit
from ...models.stock import InventoryRule, StockMove, StockMoveType
from .schemas import InventoryAlert, InventoryAlertResponse


def _stock_balance_case() -> case:
    return case(
        (
            StockMove.type == StockMoveType.IN,
            StockMove.quantity,
        ),
        (
            StockMove.type == StockMoveType.OUT,
            -StockMove.quantity,
        ),
        (
            StockMove.type == StockMoveType.ADJUST,
            StockMove.quantity,
        ),
        else_=0.0,
    )


def _ensure_inventory_table(db: Session) -> None:
    """Guarantee that `inventory_rules` exists for legacy databases."""
    engine = db.get_bind()
    if engine is None:
        return
    inspector = inspect(engine)
    if inspector.has_table("inventory_rules"):
        return
    try:
        InventoryRule.__table__.create(bind=engine, checkfirst=True)
    except SQLAlchemyError:
        # If another process created the table simultaneously, ignore the failure.
        pass


def build_inventory_alerts(
    db: Session,
    tenant_id: str,
    history_days: int = 14,
    warning_multiplier: float = 1.15,
) -> InventoryAlertResponse:
    _ensure_inventory_table(db)
    balance_sub = (
        db.query(
            StockMove.product_id.label("product_id"),
            func.coalesce(func.sum(_stock_balance_case()), 0.0).label("balance"),
        )
        .filter(StockMove.tenant_id == tenant_id)
        .group_by(StockMove.product_id)
        .subquery()
    )

    history_start = datetime.utcnow() - timedelta(days=history_days)
    consumption_rows = (
        db.query(
            StockMove.product_id,
            func.coalesce(func.sum(StockMove.quantity), 0.0).label("consumed"),
        )
        .filter(
            StockMove.tenant_id == tenant_id,
            StockMove.type == StockMoveType.OUT,
            StockMove.created_at >= history_start,
        )
        .group_by(StockMove.product_id)
        .all()
    )
    avg_daily_consumption: Dict[int, float] = {
        product_id: float(consumed) / history_days if history_days else 0.0
        for product_id, consumed in consumption_rows
    }

    rows = (
        db.query(
            Product.id,
            Product.name,
            func.coalesce(balance_sub.c.balance, 0.0).label("current_stock"),
            InventoryRule.reorder_point,
            InventoryRule.par_level,
            Unit.abbreviation,
        )
        .join(InventoryRule, InventoryRule.product_id == Product.id)
        .outerjoin(balance_sub, balance_sub.c.product_id == Product.id)
        .outerjoin(Unit, Unit.id == Product.unit_id)
        .filter(
            Product.tenant_id == tenant_id,
            InventoryRule.tenant_id == tenant_id,
        )
        .all()
    )

    alerts: List[InventoryAlert] = []
    for product_id, name, current_stock, reorder_point, par_level, unit_abbr in rows:
        current_stock = float(current_stock or 0.0)
        reorder_point = float(reorder_point or 0.0)
        par_level_value = float(par_level) if par_level is not None else None

        threshold_warning = (par_level_value or reorder_point) * warning_multiplier
        status = None
        if current_stock <= reorder_point:
            status = "critical"
        elif current_stock <= threshold_warning:
            status = "warning"
        if not status:
            continue

        avg_consumption = avg_daily_consumption.get(product_id)
        coverage = (
            (current_stock / avg_consumption) if avg_consumption and avg_consumption > 0 else None
        )

        alerts.append(
            InventoryAlert(
                product_id=product_id,
                product_name=name,
                unit=unit_abbr,
                current_stock=current_stock,
                reorder_point=reorder_point,
                par_level=par_level_value,
                avg_daily_consumption=avg_consumption,
                coverage_days=coverage,
                status=status,
            )
        )

    alerts.sort(key=lambda item: (0 if item.status == "critical" else 1, item.current_stock))

    return InventoryAlertResponse(
        generated_at=datetime.utcnow(),
        alerts=alerts,
    )
