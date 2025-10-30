from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from .base import TenantBase, TenantMixin


class Customer(TenantBase, TenantMixin):
    __tablename__ = "customers"
    name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    preferences = Column(String, nullable=True)
    allergies = Column(String, nullable=True)

    consents = relationship("Consent", back_populates="customer")
    vouchers = relationship("Voucher", back_populates="customer")
    orders = relationship("Order", back_populates="customer")


class Address(TenantBase, TenantMixin):
    __tablename__ = "addresses"
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    street = Column(String, nullable=False)
    number = Column(String, nullable=True)
    complement = Column(String, nullable=True)
    district = Column(String, nullable=True)
    city = Column(String, nullable=False)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)

    customer = relationship("Customer")


class Loyalty(TenantBase, TenantMixin):
    __tablename__ = "loyalties"
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    points = Column(Float, default=0)
    visits = Column(Integer, default=0)

    customer = relationship("Customer")


class Voucher(TenantBase, TenantMixin):
    __tablename__ = "vouchers"
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    code = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    valid_from = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)
    used = Column(Boolean, default=False)

    customer = relationship("Customer", back_populates="vouchers")


class Consent(TenantBase, TenantMixin):
    __tablename__ = "consents"
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    purpose = Column(String, nullable=False)  # ex.: marketing, fidelidade
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    customer = relationship("Customer", back_populates="consents")


class AuditLog(TenantBase, TenantMixin):
    __tablename__ = "audit_logs"
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    entity = Column(String, nullable=False)
    entity_id = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    reason = Column(String, nullable=True)

    user = relationship("User")
