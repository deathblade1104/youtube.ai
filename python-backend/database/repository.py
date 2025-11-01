"""Generic CRUD repository pattern similar to nest-be."""
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.base import BaseEntity

ModelType = TypeVar("ModelType", bound=BaseEntity)


class GenericRepository(Generic[ModelType]):
    """Generic CRUD repository following nest-be pattern."""

    def __init__(self, model: Type[ModelType], session: Session):
        """Initialize repository with model and session."""
        self.model = model
        self.session = session

    def create(self, data: Dict[str, Any]) -> ModelType:
        """Create a new record."""
        try:
            instance = self.model(**data)
            self.session.add(instance)
            self.session.commit()
            self.session.refresh(instance)
            return instance
        except IntegrityError as e:
            self.session.rollback()
            raise ValueError(f"Failed to create {self.model.__name__}: {str(e)}") from e

    def find_one(
        self, where: Optional[Dict[str, Any]] = None
    ) -> Optional[ModelType]:
        """Find a single record matching criteria."""
        query = select(self.model)
        if where:
            query = query.filter_by(**where)
        result = self.session.execute(query).scalar_one_or_none()
        return result

    def find_all(
        self,
        where: Optional[Dict[str, Any]] = None,
        skip: int = 0,
        limit: Optional[int] = None,
        order_by: Optional[str] = None,
    ) -> List[ModelType]:
        """Find all records matching criteria."""
        query = select(self.model)
        if where:
            query = query.filter_by(**where)
        if order_by:
            query = query.order_by(order_by)
        if skip:
            query = query.offset(skip)
        if limit:
            query = query.limit(limit)
        results = self.session.execute(query).scalars().all()
        return list(results)

    def update(
        self, where: Dict[str, Any], data: Dict[str, Any]
    ) -> Optional[ModelType]:
        """Update records matching criteria."""
        instance = self.find_one(where)
        if not instance:
            return None
        for key, value in data.items():
            setattr(instance, key, value)
        self.session.commit()
        self.session.refresh(instance)
        return instance

    def delete(self, where: Dict[str, Any]) -> bool:
        """Delete records matching criteria."""
        instance = self.find_one(where)
        if not instance:
            return False
        self.session.delete(instance)
        self.session.commit()
        return True

    def count(self, where: Optional[Dict[str, Any]] = None) -> int:
        """Count records matching criteria."""
        query = select(func.count(self.model.id))
        if where:
            query = query.filter_by(**where)
        result = self.session.execute(query).scalar()
        return result or 0

