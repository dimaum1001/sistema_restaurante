from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...api.deps import get_db_dep, get_tenant_id, require_roles
from ...models.order import Order, OrderItem, Payment, PaymentMethod, PaymentStatus, OrderStatus
from ...models.product import Product, ProductType, Recipe, RecipeItem
from ...models.stock import StockMove, StockMoveType
from ...schemas.orders import (
    OrderCreate,
    OrderOut,
    PaymentCreate,
)

router = APIRouter()


@router.post("", response_model=OrderOut)
def create_order(
    order_in: OrderCreate,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "cashier", "waiter")),
):
    if not order_in.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pedido deve conter ao menos um item")
    order = Order(
        table_id=order_in.table_id,
        customer_id=order_in.customer_id,
        status=OrderStatus.OPEN,
        tenant_id=tenant_id,
    )
    db.add(order)
    db.flush()  # obtém id
    total = 0.0
    for item_in in order_in.items:
        product = db.query(Product).filter(Product.id == item_in.product_id, Product.tenant_id == tenant_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Produto {item_in.product_id} não encontrado")
        unit_price = product.sale_price or 0.0
        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=item_in.quantity,
            unit_price=unit_price,
            notes=item_in.notes,
            tenant_id=tenant_id,
        )
        db.add(order_item)
        total += unit_price * item_in.quantity
    order.total = total
    db.commit()
    db.refresh(order)
    return order


@router.get("", response_model=List[OrderOut])
def list_orders(
    skip: int = 0,
    limit: int = 100,
    status_filter: str = None,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "cashier", "waiter")),
):
    query = db.query(Order).filter(Order.tenant_id == tenant_id)
    if status_filter:
        try:
            _ = OrderStatus(status_filter)
            query = query.filter(Order.status == status_filter)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status inválido")
    orders = query.offset(skip).limit(limit).all()
    return orders


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "cashier", "waiter")),
):
    order = db.query(Order).filter(Order.id == order_id, Order.tenant_id == tenant_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido não encontrado")
    return order


@router.put("/{order_id}/pay", response_model=OrderOut)
def pay_order(
    order_id: int,
    payments: List[PaymentCreate],
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "cashier")),
):
    order = db.query(Order).filter(Order.id == order_id, Order.tenant_id == tenant_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido não encontrado")
    if order.status == OrderStatus.PAID:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pedido já pago")
    if not payments:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informar métodos de pagamento")
    total_paid = sum([p.amount for p in payments])
    if order.total is None:
        order.total = 0.0
    if abs(total_paid - order.total) > 0.01:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valor pago diferente do total do pedido")
    # Cria pagamentos
    for pay in payments:
        try:
            method = PaymentMethod(pay.method)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Método de pagamento {pay.method} inválido")
        payment = Payment(
            order_id=order.id,
            method=method,
            amount=pay.amount,
            status=PaymentStatus.COMPLETED,
            tenant_id=tenant_id,
        )
        db.add(payment)
    # Atualiza pedido
    order.status = OrderStatus.PAID
    order.closed_at = datetime.utcnow()
    db.add(order)
    # Baixa do estoque via ficha técnica
    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id, Product.tenant_id == tenant_id).first()
        if not product:
            continue
        # se for prato (dish) e tiver receita, consome ingredientes
        if product.type == ProductType.DISH:
            recipe = db.query(Recipe).filter(Recipe.product_id == product.id, Recipe.tenant_id == tenant_id).first()
            if recipe:
                for r_item in recipe.items:
                    qty = (item.quantity * r_item.quantity) / recipe.yield_qty
                    stock_move = StockMove(
                        product_id=r_item.ingredient_id,
                        quantity=qty,
                        unit_id=r_item.unit_id,
                        type=StockMoveType.OUT,
                        reason=f"Saída por venda do prato {product.name}",
                        tenant_id=tenant_id,
                    )
                    db.add(stock_move)
        else:
            # produtos simples (mercadoria ou ingrediente vendido diretamente)
            qty = item.quantity
            stock_move = StockMove(
                product_id=product.id,
                quantity=qty,
                unit_id=product.unit_id,
                type=StockMoveType.OUT,
                reason=f"Saída por venda do produto {product.name}",
                tenant_id=tenant_id,
            )
            db.add(stock_move)
    db.commit()
    db.refresh(order)
    return order
