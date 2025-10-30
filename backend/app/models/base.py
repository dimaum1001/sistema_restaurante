"""Define classes base para o ORM.

Todas as tabelas (exceto Tenants) devem herdar de `TenantBase` para suportar multi‑tenancy.
"""
from datetime import datetime
from sqlalchemy.orm import declarative_base, declared_attr
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey


Base = declarative_base()


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    version = Column(Integer, default=1, nullable=False)


class TenantMixin:
    @declared_attr
    def tenant_id(cls):
        return Column(String, ForeignKey("tenants.slug"), nullable=False, index=True)


class TenantBase(Base, TimestampMixin):
    __abstract__ = True
    id = Column(Integer, primary_key=True, index=True)
    # Coluna tenant é adicionada via TenantMixin nas subclasses
