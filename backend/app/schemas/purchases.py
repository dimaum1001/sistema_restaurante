from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel

from .common import IDModel, ORMModel
from .products import ProductOut, UnitOut


class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit_id: Optional[int] = None
    unit_price: float


class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    items: List[PurchaseItemCreate]


class PurchaseItemOut(IDModel):
    product: ProductOut
    quantity: float
    unit: Optional[UnitOut]
    unit_price: float


class PurchaseOrderOut(IDModel):
    supplier_id: int
    status: str
    created_at: datetime
    approved_at: Optional[datetime]
    received_at: Optional[datetime]
    items: List[PurchaseItemOut] = []


class SupplierSummary(ORMModel):
    id: int
    name: str


class PayableCreate(BaseModel):
    description: Optional[str] = None
    amount: float
    due_date: date
    supplier_id: Optional[int] = None


class PayableOut(IDModel):
    description: Optional[str]
    amount: float
    due_date: date
    status: str
    supplier: Optional[SupplierSummary]
    purchase_order_id: Optional[int]
