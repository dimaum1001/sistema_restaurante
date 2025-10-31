from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...api.deps import get_db_dep, get_tenant_id, require_roles
from ...modules.analytics import (
    build_daily_overview,
    build_payment_breakdown,
    build_periodic_report,
    build_top_products,
)
from ...modules.analytics.schemas import (
    PaymentBreakdownItem,
    SalesDailyOverview,
    SalesPeriodicReport,
    TopProductItem,
)

router = APIRouter()


@router.get("/daily", response_model=SalesDailyOverview)
def daily_sales_overview(
    target_date: Optional[date] = Query(default=None, description="Data alvo no formato ISO (AAAA-MM-DD)"),
    top_limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(require_roles("owner", "manager", "accountant")),
) -> SalesDailyOverview:
    """Retorna o snapshot de vendas do dia informado (padrão: hoje)."""
    return build_daily_overview(db, tenant_id, target_date=target_date, top_limit=top_limit)


@router.get("/periodic", response_model=SalesPeriodicReport)
def periodic_sales_report(
    start_date: Optional[date] = Query(default=None, description="Data inicial (inclusive)"),
    end_date: Optional[date] = Query(default=None, description="Data final (inclusive)"),
    granularity: str = Query(default="weekly", pattern="^(daily|weekly|monthly)$"),
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(require_roles("owner", "manager", "accountant")),
) -> SalesPeriodicReport:
    """Relatório consolidado por dia, semana ou mês."""
    return build_periodic_report(db, tenant_id, start=start_date, end=end_date, granularity=granularity)


@router.get("/payment-mix", response_model=list[PaymentBreakdownItem])
def payment_mix(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(require_roles("owner", "manager", "accountant")),
) -> list[PaymentBreakdownItem]:
    """Quebra por método de pagamento dentro do intervalo informado."""
    return build_payment_breakdown(db, tenant_id, start=start_date, end=end_date)


@router.get("/top-products", response_model=list[TopProductItem])
def top_products(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(require_roles("owner", "manager", "accountant", "chef", "cashier", "waiter")),
) -> list[TopProductItem]:
    """Produtos mais vendidos no período."""
    return build_top_products(db, tenant_id, start=start_date, end=end_date, limit=limit)
