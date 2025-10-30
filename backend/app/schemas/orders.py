from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from .common import IDModel
from .products import ProductOut


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: float
    notes: Optional[str] = None


class OrderCreate(BaseModel):
    table_id: Optional[int] = None
    customer_id: Optional[int] = None
    items: List[OrderItemCreate]


class OrderItemOut(IDModel):
    product: ProductOut
    quantity: float
    unit_price: float
    notes: Optional[str] = None


class PaymentCreate(BaseModel):
    method: str
    amount: float


class PaymentOut(IDModel):
    method: str
    amount: float
    status: str
    created_at: datetime


class OrderOut(IDModel):
    table_id: Optional[int]
    customer_id: Optional[int]
    status: str
    opened_at: datetime
    closed_at: Optional[datetime]
    total: Optional[float]
    items: List[OrderItemOut] = []
    payments: List[PaymentOut] = []
