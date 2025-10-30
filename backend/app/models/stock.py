from enum import Enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Enum as SAEnum, Boolean
from sqlalchemy.orm import relationship

from .base import TenantBase, TenantMixin


class StockMoveType(str, Enum):
    IN = "in"
    OUT = "out"
    TRANSFER = "transfer"
    ADJUST = "adjust"


class StockLocation(TenantBase, TenantMixin):
    __tablename__ = "stock_locations"
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    moves_from = relationship("StockMove", back_populates="from_location", foreign_keys="StockMove.from_location_id")
    moves_to = relationship("StockMove", back_populates="to_location", foreign_keys="StockMove.to_location_id")


class StockMove(TenantBase, TenantMixin):
    __tablename__ = "stock_moves"
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    from_location_id = Column(Integer, ForeignKey("stock_locations.id"), nullable=True)
    to_location_id = Column(Integer, ForeignKey("stock_locations.id"), nullable=True)
    type = Column(SAEnum(StockMoveType), nullable=False)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    product = relationship("Product")
    unit = relationship("Unit")
    from_location = relationship("StockLocation", back_populates="moves_from", foreign_keys=[from_location_id])
    to_location = relationship("StockLocation", back_populates="moves_to", foreign_keys=[to_location_id])


class Batch(TenantBase, TenantMixin):
    __tablename__ = "batches"
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    cost_price = Column(Float, nullable=False)
    expiration_date = Column(Date, nullable=True)
    lot_code = Column(String, nullable=True)

    product = relationship("Product")
    unit = relationship("Unit")


class InventoryRule(TenantBase, TenantMixin):
    __tablename__ = "inventory_rules"
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, unique=True)
    reorder_point = Column(Float, nullable=False, default=0.0)
    par_level = Column(Float, nullable=True)
    lead_time_days = Column(Integer, nullable=True)
    auto_restock = Column(Boolean, nullable=False, default=False)

    product = relationship("Product", back_populates="inventory_rule")
