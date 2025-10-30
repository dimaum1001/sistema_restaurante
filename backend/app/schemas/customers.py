from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .common import IDModel


class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    preferences: Optional[str] = None
    allergies: Optional[str] = None


class CustomerOut(IDModel):
    name: str
    phone: Optional[str]
    email: Optional[str]
    preferences: Optional[str]
    allergies: Optional[str]


class ConsentCreate(BaseModel):
    purpose: str


class ConsentOut(IDModel):
    purpose: str
    granted_at: datetime
