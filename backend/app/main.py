import logging
import os
import pathlib
from contextlib import asynccontextmanager
from typing import Callable, Optional

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .core.config import settings
from .core.logger import init_logging, get_logger
from .api import router as api_router


class HealthResponse(BaseModel):
    status: str


def create_app() -> FastAPI:
    """Cria e configura a instância FastAPI."""
    init_logging()
    app = FastAPI(title="Sistema de Gestão para Restaurante",
                  version="0.1.0",
                  openapi_url="/openapi.json")

    # Middleware de CORS
    cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(',') if origin]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Protege contra hosts não confiáveis (pode ser configurado via env)
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]
    )

    # Middleware para request_id
    from .core.middleware import RequestIdMiddleware  # import local
    app.add_middleware(RequestIdMiddleware)

    # Registra roteadores
    app.include_router(api_router, prefix="/api")

    @app.get("/healthz", response_model=HealthResponse, tags=["Utils"])
    async def healthz() -> HealthResponse:
        """Endpoint simples de healthcheck."""
        return HealthResponse(status="ok")

    # Garante criação das pastas necessárias no primeiro startup (por exemplo, pasta de banco SQLite)
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        # Cria diretório para o banco SQLite se necessário
        db_url = settings.DATABASE_URL
        if db_url.startswith("sqlite"):  # ex: sqlite:///./data.db
            path = db_url.split("///")[-1]
            folder = pathlib.Path(path).resolve().parent
            folder.mkdir(parents=True, exist_ok=True)
        yield

    app.router.lifespan_context = lifespan  # type: ignore

    return app


app = create_app()
