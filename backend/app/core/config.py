from functools import lru_cache
from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Define variaveis de configuracao da aplicacao.

    As variaveis sao lidas de variaveis de ambiente ou do arquivo `.env` se existir.
    """

    # Banco de dados
    DATABASE_URL: str = "sqlite:///./data.db"

    # Estrategia de multi-tenant: db, schema ou column
    TENANCY_STRATEGY: str = "column"

    # Segurança JWT
    JWT_SECRET: str = "changeme"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # CORS
    CORS_ORIGINS: str = "*"

    # Contato de privacidade (LGPD)
    PRIVACY_CONTACT_EMAIL: str = "privacidade@example.com"

    # SMTP (opcional)
    SMTP_SERVER: Optional[str] = None
    SMTP_PORT: Optional[int] = None
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None

    # Uvicorn
    UVICORN_WORKERS: int = 1

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("TENANCY_STRATEGY")
    def validate_tenant_strategy(cls, v: str) -> str:
        allowed = {"db", "schema", "column"}
        if v not in allowed:
            raise ValueError(f"TENANCY_STRATEGY deve ser um destes valores: {allowed}")
        return v


@lru_cache()
def get_settings() -> Settings:
    """Cacheia as configuracoes para evitar reprocessamento."""
    return Settings()


settings = get_settings()
