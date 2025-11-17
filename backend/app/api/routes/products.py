from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ...api.deps import get_db_dep, get_tenant_id, require_roles, get_current_user
from ...models.product import Product, ProductType, Unit, Recipe, RecipeItem
from ...schemas.products import (
    ProductCreate,
    ProductOut,
    UnitCreate,
    UnitOut,
    RecipeCreate,
    RecipeOut,
)

router = APIRouter()


@router.post("/units", response_model=UnitOut)
def create_unit(
    unit_in: UnitCreate,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager")),
):
    unit = Unit(name=unit_in.name, abbreviation=unit_in.abbreviation, tenant_id=tenant_id)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@router.get("/units", response_model=List[UnitOut])
def list_units(
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(get_current_user),
):
    units = db.query(Unit).filter(Unit.tenant_id == tenant_id).all()
    return units


@router.post("", response_model=ProductOut)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "purchasing", "chef")),
):
    try:
        ptype = ProductType(product_in.type)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de produto inválido")
    product = Product(
        name=product_in.name,
        type=ptype,
        unit_id=product_in.unit_id,
        cost_price=product_in.cost_price,
        sale_price=product_in.sale_price,
        markup=product_in.markup,
        tenant_id=tenant_id,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("", response_model=List[ProductOut])
def list_products(
    skip: int = 0,
    limit: int = 100,
    product_type: str | None = None,
    stockable: bool = Query(default=False, description="Quando verdadeiro, retorna ingredientes e mercadorias."),
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(get_current_user),
):
    query = db.query(Product).filter(Product.tenant_id == tenant_id)
    if stockable:
        query = query.filter(Product.type.in_([ProductType.INGREDIENT, ProductType.MERCHANDISE]))
    elif product_type:
        try:
            ptype = ProductType(product_type)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de produto invalido")
        query = query.filter(Product.type == ptype)
    products = query.order_by(Product.name.asc()).offset(skip).limit(limit).all()
    return products


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id, Product.tenant_id == tenant_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado")
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    product_in: ProductCreate,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "purchasing", "chef")),
):
    product = db.query(Product).filter(Product.id == product_id, Product.tenant_id == tenant_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado")
    try:
        ptype = ProductType(product_in.type)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de produto inválido")
    product.name = product_in.name
    product.type = ptype
    product.unit_id = product_in.unit_id
    product.cost_price = product_in.cost_price
    product.sale_price = product_in.sale_price
    product.markup = product_in.markup
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager")),
):
    product = db.query(Product).filter(Product.id == product_id, Product.tenant_id == tenant_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado")
    db.delete(product)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Produto não pode ser excluido pois existem registros dependentes (pedidos, estoque ou compras).",
        )
    return {"detail": "Produto removido"}


@router.get("/{product_id}/recipe", response_model=RecipeOut)
def get_recipe(
    product_id: int,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    _: object = Depends(get_current_user),
):
    recipe = db.query(Recipe).filter(Recipe.product_id == product_id, Recipe.tenant_id == tenant_id).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ficha técnica não encontrada")
    return recipe


@router.post("/{product_id}/recipe", response_model=RecipeOut)
def create_or_update_recipe(
    product_id: int,
    recipe_in: RecipeCreate,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
    user = Depends(require_roles("owner", "manager", "chef")),
):
    # Verifica que produto é um prato
    product = db.query(Product).filter(Product.id == product_id, Product.tenant_id == tenant_id).first()
    if not product or product.type != ProductType.DISH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ficha técnica apenas para pratos (dish)")
    # Remove receita existente
    recipe = db.query(Recipe).filter(Recipe.product_id == product_id, Recipe.tenant_id == tenant_id).first()
    if recipe:
        # remove itens antigos
        for item in recipe.items:
            db.delete(item)
        recipe.yield_qty = recipe_in.yield_qty
        recipe.yield_unit_id = recipe_in.yield_unit_id
    else:
        recipe = Recipe(product_id=product_id, yield_qty=recipe_in.yield_qty, yield_unit_id=recipe_in.yield_unit_id, tenant_id=tenant_id)
        db.add(recipe)
        db.flush()  # obtém id para itens
    # adiciona itens
    for itm in recipe_in.items:
        recipe_item = RecipeItem(
            recipe_id=recipe.id,
            ingredient_id=itm.ingredient_id,
            quantity=itm.quantity,
            unit_id=itm.unit_id,
            tenant_id=tenant_id,
        )
        db.add(recipe_item)
    db.commit()
    db.refresh(recipe)
    return recipe
