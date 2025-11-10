from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Dict, List, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from ...models.order import (
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
)
from ...models.product import Product
from .schemas import (
    PaymentBreakdownItem,
    SalesDailyOverview,
    SalesPeriodicReport,
    SalesPeriodEntry,
    SalesPeriodicSummary,
    TopProductItem,
)


def _compute_period_boundaries(target: date, granularity: str) -> Tuple[date, date, str]:
    if granularity == "daily":
        return target, target, target.isoformat()
    if granularity == "monthly":
        period_start = target.replace(day=1)
        if period_start.month == 12:
            next_month = period_start.replace(year=period_start.year + 1, month=1, day=1)
        else:
            next_month = period_start.replace(month=period_start.month + 1, day=1)
        period_end = next_month - timedelta(days=1)
        label = period_start.strftime("%Y-%m")
        return period_start, period_end, label
    # default weekly (ISO week)
    weekday = target.weekday()
    period_start = target - timedelta(days=weekday)
    period_end = period_start + timedelta(days=6)
    iso_year, iso_week, _ = target.isocalendar()
    label = f"Semana {iso_week}/{iso_year}"
    return period_start, period_end, label


def _normalize_start_end(
    start: date | None,
    end: date | None,
    default_days: int = 30,
) -> Tuple[datetime, datetime, date, date]:
    today = datetime.utcnow().date()
    end_date = end or today
    start_date = start or (end_date - timedelta(days=default_days))
    if start_date > end_date:
        start_date, end_date = end_date, start_date
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date + timedelta(days=1), time.min)
    return start_dt, end_dt, start_date, end_date


def build_daily_overview(
    db: Session,
    tenant_id: str,
    target_date: date | None = None,
    top_limit: int = 5,
) -> SalesDailyOverview:
    target = target_date or datetime.utcnow().date()
    start_dt = datetime.combine(target, time.min)
    end_dt = datetime.combine(target + timedelta(days=1), time.min)

    orders = (
        db.query(Order)
        .filter(
            Order.tenant_id == tenant_id,
            Order.status == OrderStatus.PAID,
            Order.closed_at >= start_dt,
            Order.closed_at < end_dt,
        )
        .all()
    )
    total_orders = len(orders)
    total_revenue = sum((order.total or 0.0) for order in orders)
    average_ticket = total_revenue / total_orders if total_orders else 0.0
    customers_served = len({order.customer_id for order in orders if order.customer_id})

    payment_rows = (
        db.query(Payment.method, func.sum(Payment.amount))
        .filter(
            Payment.tenant_id == tenant_id,
            Payment.status == PaymentStatus.COMPLETED,
            Payment.created_at >= start_dt,
            Payment.created_at < end_dt,
        )
        .group_by(Payment.method)
        .all()
    )
    payment_total = sum(row[1] or 0.0 for row in payment_rows)
    payment_breakdown = [
        PaymentBreakdownItem(
            method=method.value if isinstance(method, PaymentMethod) else str(method),
            amount=float(amount or 0.0),
            percentage=(float(amount or 0.0) / payment_total * 100) if payment_total else 0.0,
        )
        for method, amount in payment_rows
    ]

    product_rows = (
        db.query(
            OrderItem.product_id,
            Product.name,
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .join(Product, OrderItem.product_id == Product.id)
        .filter(
            Order.tenant_id == tenant_id,
            Order.status == OrderStatus.PAID,
            Order.closed_at >= start_dt,
            Order.closed_at < end_dt,
        )
        .group_by(OrderItem.product_id, Product.name)
        .order_by(func.sum(OrderItem.quantity * OrderItem.unit_price).desc())
        .all()
    )
    sold_products = [
        TopProductItem(
            product_id=product_id,
            name=name,
            quantity_sold=float(quantity or 0.0),
            revenue=float(revenue or 0.0),
        )
        for product_id, name, quantity, revenue in product_rows
    ]
    top_products = sold_products[:top_limit]

    return SalesDailyOverview(
        date=target,
        generated_at=datetime.utcnow(),
        total_orders=total_orders,
        total_revenue=float(total_revenue),
        average_ticket=float(average_ticket),
        customers_served=customers_served,
        payment_breakdown=payment_breakdown,
        top_products=top_products,
        sold_products=sold_products,
    )


def build_periodic_report(
    db: Session,
    tenant_id: str,
    start: date | None = None,
    end: date | None = None,
    granularity: str = "weekly",
) -> SalesPeriodicReport:
    start_dt, end_dt, start_date, end_date = _normalize_start_end(start, end)
    orders = (
        db.query(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .filter(
            Order.tenant_id == tenant_id,
            Order.status == OrderStatus.PAID,
            Order.closed_at >= start_dt,
            Order.closed_at < end_dt,
        )
        .all()
    )

    buckets: Dict[str, Dict[str, object]] = {}
    summary_products: Dict[int, Dict[str, float | str]] = {}
    summary_total = 0.0
    summary_count = 0

    for order in orders:
        if not order.closed_at:
            continue
        period_start, period_end, label = _compute_period_boundaries(order.closed_at.date(), granularity)
        bucket = buckets.setdefault(
            label,
            {
                "start": period_start,
                "end": period_end,
                "total": 0.0,
                "count": 0,
                "products": {},
            },
        )
        bucket["total"] = float(bucket["total"]) + float(order.total or 0.0)
        bucket["count"] = int(bucket["count"]) + 1
        summary_total += float(order.total or 0.0)
        summary_count += 1

        for item in order.items:
            product = getattr(item, "product", None)
            product_id = item.product_id
            product_name = product.name if product else f"Produto #{product_id}"
            quantity = float(item.quantity or 0.0)
            unit_price = item.unit_price
            if unit_price is None and product is not None:
                unit_price = product.sale_price
            revenue = float(unit_price or 0.0) * quantity

            bucket_products: Dict[int, Dict[str, float | str]] = bucket["products"]  # type: ignore[assignment]
            product_slot = bucket_products.setdefault(
                product_id,
                {"name": product_name, "quantity": 0.0, "revenue": 0.0},
            )
            product_slot["quantity"] = float(product_slot["quantity"]) + quantity  # type: ignore[index]
            product_slot["revenue"] = float(product_slot["revenue"]) + revenue  # type: ignore[index]

            summary_slot = summary_products.setdefault(
                product_id,
                {"name": product_name, "quantity": 0.0, "revenue": 0.0},
            )
            summary_slot["quantity"] = float(summary_slot["quantity"]) + quantity  # type: ignore[index]
            summary_slot["revenue"] = float(summary_slot["revenue"]) + revenue  # type: ignore[index]

    entries: List[SalesPeriodEntry] = []
    for label, data in buckets.items():
        total_value = float(data["total"])
        count_value = int(data["count"])
        average_ticket = total_value / count_value if count_value else 0.0
        products_dict: Dict[int, Dict[str, float | str]] = data["products"]  # type: ignore[assignment]
        products = [
            TopProductItem(
                product_id=product_id,
                name=str(values["name"]),
                quantity_sold=float(values["quantity"]),
                revenue=float(values["revenue"]),
            )
            for product_id, values in products_dict.items()
        ]
        products.sort(key=lambda item: item.revenue, reverse=True)
        entries.append(
            SalesPeriodEntry(
                label=label,
                start=data["start"],
                end=data["end"],
                total_orders=count_value,
                total_revenue=total_value,
                average_ticket=average_ticket,
                products=products,
            )
        )

    entries.sort(key=lambda item: item.start, reverse=True)

    summary_products_list = [
        TopProductItem(
            product_id=product_id,
            name=str(values["name"]),
            quantity_sold=float(values["quantity"]),
            revenue=float(values["revenue"]),
        )
        for product_id, values in summary_products.items()
    ]
    summary_products_list.sort(key=lambda item: item.revenue, reverse=True)

    summary = SalesPeriodicSummary(
        total_orders=summary_count,
        total_revenue=summary_total,
        average_ticket=(summary_total / summary_count) if summary_count else 0.0,
        products=summary_products_list,
    )

    return SalesPeriodicReport(
        granularity=granularity,
        start=start_date,
        end=end_date,
        entries=entries,
        summary=summary,
    )


def build_payment_breakdown(
    db: Session,
    tenant_id: str,
    start: date | None = None,
    end: date | None = None,
) -> List[PaymentBreakdownItem]:
    start_dt, end_dt, _, _ = _normalize_start_end(start, end)
    rows = (
        db.query(Payment.method, func.sum(Payment.amount))
        .filter(
            Payment.tenant_id == tenant_id,
            Payment.status == PaymentStatus.COMPLETED,
            Payment.created_at >= start_dt,
            Payment.created_at < end_dt,
        )
        .group_by(Payment.method)
        .all()
    )
    total_amount = sum(float(amount or 0.0) for _, amount in rows)
    breakdown = [
        PaymentBreakdownItem(
            method=method.value if isinstance(method, PaymentMethod) else str(method),
            amount=float(amount or 0.0),
            percentage=(float(amount or 0.0) / total_amount * 100) if total_amount else 0.0,
        )
        for method, amount in rows
    ]
    breakdown.sort(key=lambda item: item.amount, reverse=True)
    return breakdown


def build_top_products(
    db: Session,
    tenant_id: str,
    start: date | None = None,
    end: date | None = None,
    limit: int = 5,
) -> List[TopProductItem]:
    start_dt, end_dt, _, _ = _normalize_start_end(start, end)
    rows = (
        db.query(
            OrderItem.product_id,
            Product.name,
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .join(Product, OrderItem.product_id == Product.id)
        .filter(
            Order.tenant_id == tenant_id,
            Order.status == OrderStatus.PAID,
            Order.closed_at >= start_dt,
            Order.closed_at < end_dt,
        )
        .group_by(OrderItem.product_id, Product.name)
        .order_by(func.sum(OrderItem.quantity * OrderItem.unit_price).desc())
        .limit(limit)
        .all()
    )
    return [
        TopProductItem(
            product_id=product_id,
            name=name,
            quantity_sold=float(quantity or 0.0),
            revenue=float(revenue or 0.0),
        )
        for product_id, name, quantity, revenue in rows
    ]
