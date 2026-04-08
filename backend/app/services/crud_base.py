import uuid
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def paginate(
    db: AsyncSession,
    query: Select[Any],
    *,
    skip: int = 0,
    limit: int = 50,
    unique: bool = False,
) -> tuple[list[Any], int]:
    """Execute a paginated query, returning ``(items, total_count)``.

    The caller supplies a fully-built ``SELECT`` statement; this helper
    derives a ``COUNT`` from it, then applies offset/limit and returns
    both the result rows and the total.

    Set *unique=True* when the query uses ``selectinload`` with joins
    that may produce duplicate parent rows.
    """
    count_query = select(func.count()).select_from(query.subquery())
    total: int = (await db.execute(count_query)).scalar_one()
    result = await db.execute(query.offset(skip).limit(limit))
    scalars = result.scalars()
    if unique:
        scalars = scalars.unique()
    return list(scalars.all()), total


class CRUDBase[ModelType, CreateSchemaType, UpdateSchemaType]:
    def __init__(self, model: type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: uuid.UUID) -> ModelType | None:
        result = await db.execute(
            select(self.model).where(self.model.id == id)  # type: ignore[attr-defined]
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 50,
        filters: list[Any] | None = None,
        order_by: Any | None = None,
    ) -> tuple[list[ModelType], int]:
        query = select(self.model)
        count_query = select(func.count()).select_from(self.model)
        if filters:
            for f in filters:
                query = query.where(f)
                count_query = count_query.where(f)
        total = (await db.execute(count_query)).scalar_one()
        if order_by is not None:
            query = query.order_by(order_by)
        else:
            query = query.order_by(self.model.created_at.desc())  # type: ignore[attr-defined]
        result = await db.execute(query.offset(skip).limit(limit))
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
