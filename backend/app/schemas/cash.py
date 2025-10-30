from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from .common import IDModel


class CashSessionOpen(BaseModel):
    opening_amount: Optional[float] = 0.0


class CashSessionOut(IDModel):
    user_id: int
    opened_at: datetime
    closed_at: Optional[datetime]
    opening_amount: Optional[float]
    closing_amount: Optional[float]
    is_open: bool


class CashSessionClose(BaseModel):
    closing_amount: float


class CashMovementCreate(BaseModel):
    session_id: int
    type: str  # supply ou withdrawal
    amount: float
    reason: Optional[str] = None


class CashMovementOut(IDModel):
    session_id: int
    type: str
    amount: float
    reason: Optional[str]
    created_at: datetime