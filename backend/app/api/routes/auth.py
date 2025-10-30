from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...schemas.auth import LoginRequest, Token, UserOut
from ...core.security import verify_password, create_access_token, create_refresh_token, decode_token
from ...api.deps import get_db_dep, get_tenant_id, get_current_user
from ...models.user import User


router = APIRouter()


@router.post("/login", response_model=Token)
def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
):
    effective_tenant = (credentials.tenant or tenant_id).strip()
    if not effective_tenant:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant nao especificado")
    user = db.query(User).filter(User.username == credentials.username, User.tenant_id == effective_tenant).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuário ou senha inválidos")
    # Gera tokens
    access_token = create_access_token({
        "sub": str(user.id),
        "username": user.username,
        "tenant_id": effective_tenant,
        "roles": [role.name for role in user.roles],
    })
    refresh_token = create_refresh_token({
        "sub": str(user.id),
        "tenant_id": effective_tenant,
    })
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=Token)
def refresh(
    token: str,
    db: Session = Depends(get_db_dep),
    tenant_id: str = Depends(get_tenant_id),
):
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token de refresh inválido")
    user_id = payload.get("sub")
    token_tenant = payload.get("tenant_id")
    if token_tenant != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant incompatível")
    user = db.query(User).filter(User.id == int(user_id), User.tenant_id == tenant_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    access_token = create_access_token({
        "sub": str(user.id),
        "username": user.username,
        "tenant_id": tenant_id,
        "roles": [role.name for role in user.roles],
    })
    refresh_token = create_refresh_token({
        "sub": str(user.id),
        "tenant_id": tenant_id,
    })
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
