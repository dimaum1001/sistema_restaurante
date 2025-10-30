from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...models.order import CashSession, CashMovement, CashMovementType
from ...schemas.cash import (
    CashSessionOpen,
    CashSessionOut,
    CashSessionClose,
    CashMovementCreate,
    CashMovementOut,
)
from ...api.deps import get_db_dep, get_tenant_id, require_roles, get_current_user


router = APIRouter()


@router.post("/sessions", response_model=CashSessionOut)
def open_session(
    session_in: CashSessionOpen,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "cashier")),
):
    # Verifica se há sessão aberta para este usuário
    existing = db.query(CashSession).filter(
        CashSession.user_id == user.id,
        CashSession.tenant_id == tenant_id,
        CashSession.is_open == True,
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sessão de caixa já aberta para este usuário")
    cash_session = CashSession(
        user_id=user.id,
        opening_amount=session_in.opening_amount or 0.0,
        is_open=True,
        tenant_id=tenant_id,
    )
    db.add(cash_session)
    db.commit()
    db.refresh(cash_session)
    return cash_session


@router.post("/sessions/{session_id}/close", response_model=CashSessionOut)
def close_session(
    session_id: int,
    closing: CashSessionClose,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "cashier")),
):
    session_obj = db.query(CashSession).filter(
        CashSession.id == session_id,
        CashSession.tenant_id == tenant_id,
    ).first()
    if not session_obj or not session_obj.is_open:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessão não encontrada ou já fechada")
    # Apenas o usuário que abriu ou gerente/owner pode fechar
    if session_obj.user_id != user.id and not user.has_role("owner") and not user.has_role("manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Não autorizado a fechar esta sessão")
    session_obj.closing_amount = closing.closing_amount
    session_obj.closed_at = datetime.utcnow()
    session_obj.is_open = False
    db.add(session_obj)
    db.commit()
    db.refresh(session_obj)
    return session_obj


@router.get("/sessions", response_model=List[CashSessionOut])
def list_sessions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "cashier")),
):
    sessions = db.query(CashSession).filter(CashSession.tenant_id == tenant_id).offset(skip).limit(limit).all()
    return sessions


@router.post("/movements", response_model=CashMovementOut)
def register_movement(
    movement_in: CashMovementCreate,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "cashier")),
):
    session_obj = db.query(CashSession).filter(
        CashSession.id == movement_in.session_id,
        CashSession.tenant_id == tenant_id,
        CashSession.is_open == True,
    ).first()
    if not session_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessão de caixa não encontrada ou fechada")
    try:
        mtype = CashMovementType(movement_in.type)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de movimento inválido")
    movement = CashMovement(
        session_id=movement_in.session_id,
        type=mtype,
        amount=movement_in.amount,
        reason=movement_in.reason,
        tenant_id=tenant_id,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement