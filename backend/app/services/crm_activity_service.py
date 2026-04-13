import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm_activity import CrmActivity
from app.schemas.crm_activity import CrmActivityCreate, CrmActivityUpdate
from app.services.crud_base import CRUDBase


class CrmActivityService(CRUDBase[CrmActivity, CrmActivityCreate, CrmActivityUpdate]):
    def __init__(self) -> None:
        super().__init__(CrmActivity)

    async def create_for_user(
        self,
        db: AsyncSession,
        *,
        data: CrmActivityCreate,
        created_by_id: uuid.UUID,
    ) -> CrmActivity:
        payload: dict[str, Any] = data.model_dump(exclude_unset=True)
        if not payload.get("occurred_at"):
            payload["occurred_at"] = datetime.now(UTC)
        payload["created_by"] = created_by_id
        db_obj = CrmActivity(**payload)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj


crm_activity_service = CrmActivityService()
