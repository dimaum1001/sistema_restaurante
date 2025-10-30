from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class InventoryAlert(BaseModel):
    product_id: int
    product_name: str
    unit: Optional[str]
    current_stock: float
    reorder_point: float
    par_level: Optional[float]
    avg_daily_consumption: Optional[float]
    coverage_days: Optional[float]
    status: str


class InventoryAlertResponse(BaseModel):
    generated_at: datetime
    alerts: List[InventoryAlert]
