from enum import Enum
from sqlalchemy import Column, Integer, String, Float, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship

from .base import TenantBase, TenantMixin


class ProductType(str, Enum):
    INGREDIENT = "ingredient"
    MERCHANDISE = "merchandise"
    DISH = "dish"


class Unit(TenantBase, TenantMixin):
    __tablename__ = "units"
    name = Column(String, nullable=False)
    abbreviation = Column(String, nullable=False)

    products = relationship("Product", back_populates="unit")


class Conversion(TenantBase, TenantMixin):
    __tablename__ = "conversions"
    from_unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    to_unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    factor = Column(Float, nullable=False)

    from_unit = relationship("Unit", foreign_keys=[from_unit_id])
    to_unit = relationship("Unit", foreign_keys=[to_unit_id])


class Product(TenantBase, TenantMixin):
    __tablename__ = "products"
    name = Column(String, nullable=False)
    type = Column(SAEnum(ProductType), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    cost_price = Column(Float, nullable=True)
    sale_price = Column(Float, nullable=True)
    markup = Column(Float, nullable=True)

    unit = relationship("Unit", back_populates="products")
    recipe = relationship("Recipe", back_populates="product", uselist=False)
    recipe_items = relationship("RecipeItem", back_populates="ingredient")
    inventory_rule = relationship("InventoryRule", back_populates="product", uselist=False)


class Recipe(TenantBase, TenantMixin):
    __tablename__ = "recipes"
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    yield_qty = Column(Float, nullable=False, default=1)
    yield_unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)

    product = relationship("Product", back_populates="recipe", foreign_keys=[product_id])
    yield_unit = relationship("Unit", foreign_keys=[yield_unit_id])
    items = relationship("RecipeItem", back_populates="recipe")


class RecipeItem(TenantBase, TenantMixin):
    __tablename__ = "recipe_items"
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    ingredient_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)

    recipe = relationship("Recipe", back_populates="items", foreign_keys=[recipe_id])
    ingredient = relationship("Product", back_populates="recipe_items", foreign_keys=[ingredient_id])
    unit = relationship("Unit", foreign_keys=[unit_id])
