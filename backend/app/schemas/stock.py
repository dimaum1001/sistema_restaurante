from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel

from .common import IDModel
from .products import ProductOut, UnitOut


class StockMoveCreate(BaseModel):
    product_id: int
    quantity: float
    unit_id: Optional[int] = None
    type: str  # in, out, transfer, adjust
    from_location_id: Optional[int] = None
    to_location_id: Optional[int] = None
    reason: Optional[str] = None


class StockMoveOut(IDModel):
    product: ProductOut
    quantity: float
    unit: Optional[UnitOut]
    type: str
    from_location_id: Optional[int]
    to_location_id: Optional[int]
    reason: Optional[str]
    created_at: datetime


class BatchCreate(BaseModel):
    product_id: int
    quantity: float
    unit_id: Optional[int] = None
    cost_price: float
    expiration_date: Optional[date] = None
    lot_code: Optional[str] = None


class BatchOut(IDModel):
    product: ProductOut
    quantity: float
    unit: Optional[UnitOut]
    cost_price: float
    expiration_date: Optional[date]
    lot_code: Optional[str]
