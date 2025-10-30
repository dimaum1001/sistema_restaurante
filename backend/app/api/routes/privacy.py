"""Rotas relacionadas à LGPD.

Delegam para as rotas de clientes quando aplicável.
"""
from fastapi import APIRouter, Depends
from fastapi import HTTPException, status

from sqlalchemy.orm import Session

from ...api.deps import get_db_dep, get_tenant_id, require_roles, get_current_user
from ...models.customer import Customer, Consent, AuditLog
from ...models.order import Order
from ...schemas.customers import ConsentCreate

import io
import json
import zipfile
from datetime import datetime
from fastapi.responses import StreamingResponse


router = APIRouter()


@router.post("/consents")
def create_consent(
    consent_in: ConsentCreate,
    customer_id: int,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "cashier", "waiter")),
):
    # Delegado para adicionar consentimento ao cliente
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == tenant_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    consent = Consent(
        customer_id=customer_id,
        purpose=consent_in.purpose,
        tenant_id=tenant_id,
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)
    return {"detail": "Consentimento registrado"}


@router.get("/export/{customer_id}")
def export_data(
    customer_id: int,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "cashier")),
):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == tenant_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    customer_data = {
        "id": customer.id,
        "name": customer.name,
        "phone": customer.phone,
        "email": customer.email,
        "preferences": customer.preferences,
        "allergies": customer.allergies,
        "consents": [
            {"purpose": c.purpose, "granted_at": c.granted_at.isoformat()}
            for c in customer.consents
        ],
    }
    orders = db.query(Order).filter(Order.customer_id == customer_id, Order.tenant_id == tenant_id).all()
    orders_data = []
    for order in orders:
        orders_data.append({
            "id": order.id,
            "status": order.status.value,
            "opened_at": order.opened_at.isoformat(),
            "closed_at": order.closed_at.isoformat() if order.closed_at else None,
            "total": order.total,
        })
    export = {"customer": customer_data, "orders": orders_data}
    json_bytes = json.dumps(export, ensure_ascii=False, indent=2).encode("utf-8")
    mem_zip = io.BytesIO()
    with zipfile.ZipFile(mem_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"customer_{customer_id}.json", json_bytes)
    mem_zip.seek(0)
    headers = {
        "Content-Disposition": f"attachment; filename=customer_{customer_id}_export.zip"
    }
    return StreamingResponse(mem_zip, media_type="application/zip", headers=headers)


@router.post("/delete/{customer_id}")
def delete_data(
    customer_id: int,
    reason: str = "Solicitação do titular",
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager")),
    current_user = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == tenant_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    customer.name = None  # type: ignore
    customer.phone = None  # type: ignore
    customer.email = None  # type: ignore
    customer.preferences = None  # type: ignore
    customer.allergies = None  # type: ignore
    customer.deleted_at = datetime.utcnow()
    db.add(customer)
    # registra log
    log = AuditLog(
        user_id=current_user.id,
        action="delete_customer",
        entity="customer",
        entity_id=customer_id,
        ip=None,
        user_agent=None,
        reason=reason,
        tenant_id=tenant_id,
    )
    db.add(log)
    db.commit()
    return {"detail": "Dados do cliente eliminados/anônimizados"}
