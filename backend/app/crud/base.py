from typing import Generic, Type, TypeVar, Optional, List, Dict, Any

from sqlalchemy.orm import Session

from ..models.base import TenantMixin

ModelType = TypeVar("ModelType", bound=TenantMixin)


class CRUDBase(Generic[ModelType]):
    """Classe genérica com operações CRUD básicas que respeitam tenant.

    Todas as operações filtram pelo `tenant_id` e atribuem o `tenant_id`
    ao criar novos registros.
    """

    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: int, tenant_id: str) -> Optional[ModelType]:
        return db.query(self.model).filter(self.model.id == id, self.model.tenant_id == tenant_id).first()

    def list(self, db: Session, tenant_id: str, skip: int = 0, limit: int = 100) -> List[ModelType]:
        return db.query(self.model).filter(self.model.tenant_id == tenant_id).offset(skip).limit(limit).all()

    def create(self, db: Session, obj_in: Dict[str, Any], tenant_id: str) -> ModelType:
        obj = self.model(**obj_in, tenant_id=tenant_id)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def update(self, db: Session, db_obj: ModelType, obj_in: Dict[str, Any]) -> ModelType:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, id: int, tenant_id: str) -> Optional[ModelType]:
        obj = self.get(db, id, tenant_id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj