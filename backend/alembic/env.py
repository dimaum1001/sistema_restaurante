import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy import engine_from_config
from alembic import context

from app.core.config import settings
from app.models import Base  # noqa


config = context.config

# Interpreta o arquivo config ini do Alembic, se existir.
fileConfig(config.config_file_name) if config.config_file_name else None

# Define a URL para a conexão
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Executa migrações em modo offline (gera o SQL)."""
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Executa migrações em modo online (aplica no DB)."""
    connectable = engine_from_config(
        configuration=config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()