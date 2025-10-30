"""Modelos Pydantic compartilhados."""
from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base para modelos compatíveis com objetos ORM."""

    model_config = ConfigDict(from_attributes=True)


class IDModel(ORMModel):
    id: int


class TimestampModel(ORMModel):
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    version: int
