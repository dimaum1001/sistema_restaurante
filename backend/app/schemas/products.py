from typing import Optional, List
from pydantic import BaseModel

from .common import IDModel, ORMModel


class UnitCreate(BaseModel):
    name: str
    abbreviation: str


class UnitOut(IDModel):
    name: str
    abbreviation: str


class ProductCreate(BaseModel):
    name: str
    type: str  # ingredient, merchandise, dish
    unit_id: Optional[int] = None
    cost_price: Optional[float] = None
    sale_price: Optional[float] = None
    markup: Optional[float] = None


class ProductOut(IDModel):
    name: str
    type: str
    unit: Optional[UnitOut] = None
    cost_price: Optional[float] = None
    sale_price: Optional[float] = None
    markup: Optional[float] = None


class RecipeItemCreate(BaseModel):
    ingredient_id: int
    quantity: float
    unit_id: Optional[int] = None


class RecipeCreate(BaseModel):
    yield_qty: float
    yield_unit_id: Optional[int] = None
    items: List[RecipeItemCreate]


class RecipeItemOut(ORMModel):
    id: int
    ingredient: ProductOut
    quantity: float
    unit: Optional[UnitOut] = None


class RecipeOut(IDModel):
    product: ProductOut
    yield_qty: float
    yield_unit: Optional[UnitOut]
    items: List[RecipeItemOut]
