import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
import jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status

from .config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_token(subject: Dict[str, Any], expires_delta: Optional[timedelta], token_type: str) -> str:
    to_encode = subject.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "type": token_type})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt


def create_access_token(data: Dict[str, Any]) -> str:
    expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return create_token(data, expires, token_type="access")


def create_refresh_token(data: Dict[str, Any]) -> str:
    expires = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    return create_token(data, expires, token_type="refresh")


def decode_token(token: str) -> Dict[str, Any]:
    try:
        decoded = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    return decoded