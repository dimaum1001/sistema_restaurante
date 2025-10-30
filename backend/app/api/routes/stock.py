from typing import List, Dict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from ...api.deps import get_db_dep, get_tenant_id, require_roles
from ...models.stock import StockMove, StockMoveType, Batch
from ...models.product import Product, Unit
from ...schemas.stock import (
    StockMoveCreate,
    StockMoveOut,
    BatchCreate,
    BatchOut,
)

router = APIRouter()


@router.post("/moves", response_model=StockMoveOut)
def create_move(
    move_in: StockMoveCreate,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "purchasing", "chef")),
):
    try:
        mtype = StockMoveType(move_in.type)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de movimentação inválido")
    # Verifica produto
    product = db.query(Product).filter(Product.id == move_in.product_id, Product.tenant_id == tenant_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado")
    move = StockMove(
        product_id=move_in.product_id,
        quantity=move_in.quantity,
        unit_id=move_in.unit_id or product.unit_id,
        from_location_id=move_in.from_location_id,
        to_location_id=move_in.to_location_id,
        type=mtype,
        reason=move_in.reason,
        tenant_id=tenant_id,
    )
    db.add(move)
    db.commit()
    db.refresh(move)
    return move


@router.get("/moves", response_model=List[StockMoveOut])
def list_moves(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "purchasing", "chef")),
):
    moves = db.query(StockMove).filter(StockMove.tenant_id == tenant_id).offset(skip).limit(limit).all()
    return moves


@router.post("/batches", response_model=BatchOut)
def create_batch(
    batch_in: BatchCreate,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "purchasing")),
):
    # verifica produto e unidade
    product = db.query(Product).filter(Product.id == batch_in.product_id, Product.tenant_id == tenant_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado")
    batch = Batch(
        product_id=batch_in.product_id,
        quantity=batch_in.quantity,
        unit_id=batch_in.unit_id or product.unit_id,
        cost_price=batch_in.cost_price,
        expiration_date=batch_in.expiration_date,
        lot_code=batch_in.lot_code,
        tenant_id=tenant_id,
    )
    db.add(batch)
    # também insere movimentação de entrada
    move = StockMove(
        product_id=batch.product_id,
        quantity=batch.quantity,
        unit_id=batch.unit_id,
        type=StockMoveType.IN,
        reason="Entrada de lote",
        tenant_id=tenant_id,
    )
    db.add(move)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/batches", response_model=List[BatchOut])
def list_batches(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "purchasing", "chef")),
):
    batches = db.query(Batch).filter(Batch.tenant_id == tenant_id).offset(skip).limit(limit).all()
    return batches


@router.get("/inventory")
def inventory(
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "purchasing", "chef")),
):
    """Calcula o saldo atual de estoque por produto."""
    balance_case = case(
        (StockMove.type == StockMoveType.IN, StockMove.quantity),
        (StockMove.type == StockMoveType.OUT, -StockMove.quantity),
        (StockMove.type == StockMoveType.ADJUST, StockMove.quantity),
        else_=0.0,
    )

    rows = (
        db.query(
            Product.name.label("product_name"),
            func.coalesce(func.sum(balance_case), 0.0).label("quantity"),
        )
        .join(Product, Product.id == StockMove.product_id)
        .filter(
            StockMove.tenant_id == tenant_id,
            Product.tenant_id == tenant_id,
        )
        .group_by(Product.id, Product.name)
        .order_by(Product.name.asc())
        .all()
    )
    return {name: float(quantity or 0.0) for name, quantity in rows}
