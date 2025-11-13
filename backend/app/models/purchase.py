from enum import Enum
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime

from .base import TenantBase, TenantMixin


class PurchaseStatus(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    RECEIVED = "received"


class Supplier(TenantBase, TenantMixin):
    __tablename__ = "suppliers"
    name = Column(String, nullable=False)
    contact = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)

    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")


class PurchaseOrder(TenantBase, TenantMixin):
    __tablename__ = "purchase_orders"
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    status = Column(SAEnum(PurchaseStatus), default=PurchaseStatus.DRAFT, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    approved_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)

    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship("PurchaseItem", back_populates="purchase_order")


class PurchaseItem(TenantBase, TenantMixin):
    __tablename__ = "purchase_items"
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    unit_price = Column(Float, nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product")
    unit = relationship("Unit")


class PayableStatus(str, Enum):
    OPEN = "open"
    PAID = "paid"
    CANCELED = "canceled"


class Payable(TenantBase, TenantMixin):
    __tablename__ = "payables"
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True)
    due_date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(SAEnum(PayableStatus), default=PayableStatus.OPEN, nullable=False)
    description = Column(String, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    supplier = relationship("Supplier")
    purchase_order = relationship("PurchaseOrder")
