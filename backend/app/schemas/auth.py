from typing import List, Optional
from pydantic import BaseModel

from .common import ORMModel


class LoginRequest(BaseModel):
    username: str
    password: str
    tenant: Optional[str] = None


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserRole(ORMModel):
    id: int
    name: str


class UserOut(ORMModel):
    id: int
    username: str
    email: Optional[str]
    roles: List[UserRole] = []
