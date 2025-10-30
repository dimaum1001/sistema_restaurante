"""Resolução de tenant para multi‑tenancy.

Define a estratégia de resolução do tenant atual a partir da requisição.
Atualmente suporta estratégia `column`, que utiliza uma coluna `tenant_id`
em todas as tabelas. Estratégias `db` (um banco por tenant) e `schema`
(um schema por tenant) podem ser implementadas futuramente.
"""
from fastapi import Request, HTTPException, status
from .config import settings
from .database import tenant_ctx


class TenantResolver:
    """Resolve o tenant a partir da requisição."""

    @staticmethod
    def resolve_tenant(request: Request) -> str:
        """Obtém o tenant_id a partir do header X-Tenant ou do subdomínio."""
        tenant_header = request.headers.get("X-Tenant")
        if tenant_header:
            return tenant_header
        # Futuro: extrair do subdomínio
        return "default"

    @staticmethod
    def get_tenant_id(request: Request) -> str:
        tenant_id = TenantResolver.resolve_tenant(request)
        if not tenant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant não especificado")
        tenant_ctx.set(tenant_id)
        return tenant_id