from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


class PaymentBreakdownItem(BaseModel):
    method: str
    amount: float
    percentage: float


class TopProductItem(BaseModel):
    product_id: int
    name: str
    quantity_sold: float
    revenue: float


class SalesDailyOverview(BaseModel):
    date: date
    generated_at: datetime
    total_orders: int
    total_revenue: float
    average_ticket: float
    customers_served: int
    payment_breakdown: List[PaymentBreakdownItem]
    top_products: List[TopProductItem]
    sold_products: List[TopProductItem]


class SalesPeriodEntry(BaseModel):
    label: str
    start: date
    end: date
    total_orders: int
    total_revenue: float
    average_ticket: float


class SalesPeriodicReport(BaseModel):
    granularity: str
    start: date
    end: date
    entries: List[SalesPeriodEntry]


class SalesFilters(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    granularity: str = "weekly"
    top_limit: int = 5
