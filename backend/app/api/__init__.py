"""Aggregates all API routers."""

from fastapi import APIRouter

from .routes import (
    analytics,
    auth,
    cash,
    customers,
    inventory,
    orders,
    privacy,
    products,
    purchases,
    reports,
    stock,
)

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
router.include_router(cash.router, prefix="/cash", tags=["Cash"])
router.include_router(customers.router, prefix="/customers", tags=["Customers"])
router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
router.include_router(orders.router, prefix="/orders", tags=["Orders"])
router.include_router(privacy.router, prefix="/privacy", tags=["Privacy"])
router.include_router(products.router, prefix="/products", tags=["Products"])
router.include_router(purchases.router, prefix="/purchases", tags=["Purchases"])
router.include_router(reports.router, prefix="/reports", tags=["Reports"])
router.include_router(stock.router, prefix="/stock", tags=["Stock"])
