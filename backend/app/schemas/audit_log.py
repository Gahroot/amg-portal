from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: UUID
    user_id: UUID | None = None
    user_email: str | None = None
    action: str
    entity_type: str
    entity_id: str
    before_state: dict[str, object] | None = None
    after_state: dict[str, object] | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    logs: list[AuditLogResponse]
    total: int
