from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...api.deps import get_db_dep, get_tenant_id, require_roles
from ...models.purchase import PurchaseOrder, PurchaseItem, Supplier, PurchaseStatus, Payable, PayableStatus
from ...models.stock import StockMove, StockMoveType
from ...models.product import Product
from ...schemas.purchases import (
    PurchaseOrderCreate,
    PurchaseOrderOut,
    PayableCreate,
    PayableOut,
)

router = APIRouter()


@router.post("/orders", response_model=PurchaseOrderOut)
def create_purchase_order(
    po_in: PurchaseOrderCreate,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "purchasing")),
):
    supplier = db.query(Supplier).filter(Supplier.id == po_in.supplier_id, Supplier.tenant_id == tenant_id).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fornecedor nao encontrado")
    po = PurchaseOrder(
        supplier_id=po_in.supplier_id,
        status=PurchaseStatus.DRAFT,
        tenant_id=tenant_id,
    )
    db.add(po)
    db.flush()
    for item in po_in.items:
        product = db.query(Product).filter(Product.id == item.product_id, Product.tenant_id == tenant_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Produto {item.product_id} nao encontrado")
        po_item = PurchaseItem(
            purchase_order_id=po.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_id=item.unit_id or product.unit_id,
            unit_price=item.unit_price,
            tenant_id=tenant_id,
        )
        db.add(po_item)
    db.commit()
    db.refresh(po)
    return po


@router.get("/orders", response_model=List[PurchaseOrderOut])
def list_purchase_orders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "purchasing")),
):
    pos = db.query(PurchaseOrder).filter(PurchaseOrder.tenant_id == tenant_id).offset(skip).limit(limit).all()
    return pos


@router.put("/orders/{po_id}/approve", response_model=PurchaseOrderOut)
def approve_purchase_order(
    po_id: int,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager")),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id, PurchaseOrder.tenant_id == tenant_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido de compra nao encontrado")
    if po.status != PurchaseStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pedido de compra ja aprovado ou recebido")
    po.status = PurchaseStatus.APPROVED
    po.approved_at = datetime.utcnow()
    db.add(po)
    db.commit()
    db.refresh(po)
    return po


@router.put("/orders/{po_id}/receive", response_model=PurchaseOrderOut)
def receive_purchase_order(
    po_id: int,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "purchasing")),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id, PurchaseOrder.tenant_id == tenant_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido de compra nao encontrado")
    if po.status == PurchaseStatus.RECEIVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pedido de compra ja recebido")
    po.status = PurchaseStatus.RECEIVED
    po.received_at = datetime.utcnow()
    db.add(po)
    # Para cada item, insere entrada de estoque
    total_amount = 0.0
    for item in po.items:
        stock_move = StockMove(
            product_id=item.product_id,
            quantity=item.quantity,
            unit_id=item.unit_id,
            type=StockMoveType.IN,
            reason=f"Recebimento pedido de compra #{po.id}",
            tenant_id=tenant_id,
        )
        db.add(stock_move)
        total_amount += item.quantity * item.unit_price
    # Cria conta a pagar
    due_date = datetime.utcnow().date() + timedelta(days=30)
    payable = Payable(
        supplier_id=po.supplier_id,
        purchase_order_id=po.id,
        due_date=due_date,
        amount=total_amount,
        status=PayableStatus.OPEN,
        description=f"Compra pedido #{po.id}",
        tenant_id=tenant_id,
    )
    db.add(payable)
    db.commit()
    db.refresh(po)
    return po


@router.get("/payables", response_model=List[PayableOut])
def list_payables(
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "accountant")),
):
    payables = (
        db.query(Payable)
        .filter(Payable.tenant_id == tenant_id)
        .order_by(Payable.due_date.asc())
        .all()
    )
    return payables


@router.post("/payables", response_model=PayableOut, status_code=status.HTTP_201_CREATED)
def create_payable(
    payable_in: PayableCreate,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "accountant")),
):
    supplier_id = payable_in.supplier_id
    if supplier_id is not None:
        supplier = (
            db.query(Supplier)
            .filter(Supplier.id == supplier_id, Supplier.tenant_id == tenant_id)
            .first()
        )
        if not supplier:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fornecedor nao encontrado")
    payable = Payable(
        supplier_id=supplier_id,
        description=payable_in.description,
        amount=payable_in.amount,
        due_date=payable_in.due_date,
        status=PayableStatus.OPEN,
        tenant_id=tenant_id,
    )
    db.add(payable)
    db.commit()
    db.refresh(payable)
    return payable


@router.put("/payables/{payable_id}/settle", response_model=PayableOut)
def settle_payable(
    payable_id: int,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "accountant")),
):
    payable = db.query(Payable).filter(Payable.id == payable_id, Payable.tenant_id == tenant_id).first()
    if not payable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conta a pagar nao encontrada")
    if payable.status != PayableStatus.OPEN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conta a pagar nao esta em aberto")
    payable.status = PayableStatus.PAID
    db.add(payable)
    db.commit()
    db.refresh(payable)
    return payable


@router.put("/payables/{payable_id}/cancel", response_model=PayableOut)
def cancel_payable(
    payable_id: int,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "accountant")),
):
    payable = db.query(Payable).filter(Payable.id == payable_id, Payable.tenant_id == tenant_id).first()
    if not payable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conta a pagar nao encontrada")
    if payable.status == PayableStatus.PAID:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conta a pagar ja foi quitada")
    if payable.status == PayableStatus.CANCELED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conta a pagar ja cancelada")
    payable.status = PayableStatus.CANCELED
    db.add(payable)
    db.commit()
    db.refresh(payable)
    return payable
