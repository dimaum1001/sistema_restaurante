from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...api.deps import get_db_dep, get_tenant_id, require_roles
from ...modules.inventory import build_inventory_alerts
from ...modules.inventory.schemas import InventoryAlertResponse

router = APIRouter()


@router.get("/alerts", response_model=InventoryAlertResponse)
def inventory_alerts(
    history_days: int = Query(default=14, ge=1, le=60),
    warning_multiplier: float = Query(default=1.15, ge=1.0, le=2.0),
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(require_roles("owner", "manager", "chef", "purchasing")),
) -> InventoryAlertResponse:
    """Lista produtos com estoque crítico ou em atenção."""
    return build_inventory_alerts(
        db,
        tenant_id,
        history_days=history_days,
        warning_multiplier=warning_multiplier,
    )
