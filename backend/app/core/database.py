"""Configuração e dependências de banco de dados.

Suporta multi‑tenancy via coluna (por padrão). Outras estratégias podem ser
implementadas no futuro (db ou schema) utilizando funções da classe
``TenantResolver`` em `tenant.py`.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextvars import ContextVar
from typing import Generator

from .config import settings

tenant_ctx: ContextVar[str] = ContextVar("tenant", default="default")


def get_engine():
    """Cria e retorna o engine conforme a estratégia de tenancy.

    No modo 'column', o mesmo banco é usado para todos os tenants.
    """
    # Para SQLite, desativar check_same_thread
    if settings.DATABASE_URL.startswith("sqlite"):
        return create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
    return create_engine(settings.DATABASE_URL)


engine = get_engine()

# Session maker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency que provê uma sessão de banco de dados para cada request.

    A função lê o tenant atual do `tenant_ctx` para uso posterior (filtros são
    aplicados na camada de CRUD ou nas consultas dentro das rotas).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()