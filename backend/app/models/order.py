from enum import Enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SAEnum, Boolean
from sqlalchemy.orm import relationship

from .base import TenantBase, TenantMixin


class TableStatus(str, Enum):
    FREE = "free"
    OCCUPIED = "occupied"
    RESERVED = "reserved"


class Table(TenantBase, TenantMixin):
    __tablename__ = "tables"
    name = Column(String, nullable=False)
    status = Column(SAEnum(TableStatus), default=TableStatus.FREE, nullable=False)
    capacity = Column(Integer, nullable=True)

    orders = relationship("Order", back_populates="table")


class OrderStatus(str, Enum):
    OPEN = "open"
    PAID = "paid"
    CANCELED = "canceled"


class Order(TenantBase, TenantMixin):
    __tablename__ = "orders"
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    status = Column(SAEnum(OrderStatus), default=OrderStatus.OPEN, nullable=False)
    opened_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)
    total = Column(Float, nullable=True)

    table = relationship("Table", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")
    payments = relationship("Payment", back_populates="order")


class OrderItem(TenantBase, TenantMixin):
    __tablename__ = "order_items"
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    notes = Column(String, nullable=True)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")


class PaymentMethod(str, Enum):
    CASH = "cash"
    PIX = "pix"
    CARD_DEBIT = "card_debit"
    CARD_CREDIT = "card_credit"
    VOUCHER = "voucher"
    HOUSE_ACCOUNT = "house_account"  # fiado/conta cliente


class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class Payment(TenantBase, TenantMixin):
    __tablename__ = "payments"
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    method = Column(SAEnum(PaymentMethod), nullable=False)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(SAEnum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)

    order = relationship("Order", back_populates="payments")


class CashSession(TenantBase, TenantMixin):
    __tablename__ = "cash_sessions"
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    opened_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)
    opening_amount = Column(Float, nullable=True)
    closing_amount = Column(Float, nullable=True)
    is_open = Column(Boolean, default=True, nullable=False)

    user = relationship("User")
    movements = relationship("CashMovement", back_populates="session")


class CashMovementType(str, Enum):
    SUPPLY = "supply"
    WITHDRAWAL = "withdrawal"


class CashMovement(TenantBase, TenantMixin):
    __tablename__ = "cash_movements"
    session_id = Column(Integer, ForeignKey("cash_sessions.id"), nullable=False)
    type = Column(SAEnum(CashMovementType), nullable=False)
    amount = Column(Float, nullable=False)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("CashSession", back_populates="movements")