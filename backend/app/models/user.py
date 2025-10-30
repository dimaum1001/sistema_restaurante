from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Table
from sqlalchemy.orm import relationship

from .base import TenantBase, TenantMixin, Base


class Tenant(TenantBase):
    __tablename__ = "tenants"
    # Tenants nao possuem coluna tenant_id; sao entidades raiz.
    tenant_id = None  # type: ignore

    slug = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)

    users = relationship("User", back_populates="tenant")


user_roles_association = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
)


class Role(TenantBase, TenantMixin):
    __tablename__ = "roles"
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    users = relationship(
        "User",
        secondary=user_roles_association,
        back_populates="roles",
    )


class User(TenantBase, TenantMixin):
    __tablename__ = "users"
    username = Column(String, unique=False, nullable=False)
    email = Column(String, unique=False, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    tenant = relationship("Tenant", back_populates="users")
    roles = relationship(
        "Role",
        secondary=user_roles_association,
        back_populates="users",
    )

    def has_role(self, role_name: str) -> bool:
        return any(r.name == role_name for r in self.roles)
