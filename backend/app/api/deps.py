"""Dependências comuns usadas nas rotas."""
from typing import Generator, Optional, List, Callable
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.tenant import TenantResolver
from ..core.security import decode_token
from ..models.user import User, Role


# Esquema de autenticação simples via header "Authorization: Bearer <token>"
oauth2_scheme = HTTPBearer(auto_error=False)


def get_tenant_id(request: Request) -> str:
    return TenantResolver.get_tenant_id(request)


def get_db_dep(db: Session = Depends(get_db)) -> Generator[Session, None, None]:
    yield db


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
) -> User:
    """Retorna o usuário atual a partir do token JWT."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais não fornecidas")
    token = credentials.credentials
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de acesso inválido")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sem usuário")
    # Verifica tenant no token
    token_tenant = payload.get("tenant_id")
    if token_tenant != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token pertence a outro tenant")
    # Busca usuário
    user = db.query(User).filter(User.id == int(user_id), User.tenant_id == tenant_id).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário inválido ou inativo")
    return user


def require_roles(*roles: str) -> Callable[[User], User]:
    """Cria uma dependência que exige que o usuário possua pelo menos um dos papéis fornecidos."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        if not any(user.has_role(role) for role in roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
        return user

    return dependency
