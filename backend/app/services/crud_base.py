import uuid
from typing import Any, TypeVar

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase[ModelType, CreateSchemaType, UpdateSchemaType]:
    def __init__(self, model: type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: uuid.UUID) -> ModelType | None:
        result = await db.execute(
            select(self.model).where(self.model.id == id)  # type: ignore[attr-defined]
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 50, filters: list[Any] | None = None
    ) -> tuple[list[ModelType], int]:
        query = select(self.model)
        count_query = select(func.count()).select_from(self.model)
        if filters:
            for f in filters:
                query = query.where(f)
                count_query = count_query.where(f)
        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(
            query.order_by(self.model.created_at.desc()).offset(skip).limit(limit)  # type: ignore[attr-defined]
        )
        return list(result.scalars().all()), total

    async def create(
        self, db: AsyncSession, *, obj_in: CreateSchemaType, **kwargs: Any
    ) -> ModelType:
        obj_data = obj_in.model_dump(exclude_unset=True)  # type: ignore[attr-defined]
        obj_data.update(kwargs)
        db_obj = self.model(**obj_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self, db: AsyncSession, *, db_obj: ModelType, obj_in: UpdateSchemaType | dict[str, Any]
    ) -> ModelType:
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)  # type: ignore[attr-defined]
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, *, id: uuid.UUID) -> ModelType | None:
        obj = await self.get(db, id)
        if obj is None:
            return None
        await db.delete(obj)
        await db.commit()
        return obj
