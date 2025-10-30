"""Importa todos os modelos para que o SQLAlchemy registre as tabelas.

Ao importar este módulo, todas as classes ORM são carregadas e as
associações são garantidas. Isso é usado pelo Alembic e pelo FastAPI
para criar as tabelas e gerar migrações.
"""
from .base import Base  # noqa: F401

from .user import Tenant, Role, User  # noqa: F401
from .product import Unit, Conversion, Product, Recipe, RecipeItem, ProductType  # noqa: F401
from .purchase import Supplier, PurchaseOrder, PurchaseItem, Payable, PurchaseStatus, PayableStatus  # noqa: F401
from .stock import StockLocation, StockMove, StockMoveType, Batch, InventoryRule  # noqa: F401
from .order import Table, Order, OrderItem, Payment, PaymentMethod, PaymentStatus, CashSession, CashMovement, CashMovementType, TableStatus, OrderStatus  # noqa: F401
from .customer import Customer, Address, Loyalty, Voucher, Consent, AuditLog  # noqa: F401
