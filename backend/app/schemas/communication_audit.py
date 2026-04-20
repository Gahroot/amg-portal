"""Pydantic schemas for communication audit trail."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str255, Str2000


class CommunicationAuditResponse(BaseModel):
    """Single communication audit entry."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    communication_id: uuid.UUID | None = None
    conversation_id: uuid.UUID | None = None
    action: Str50
    actor_id: uuid.UUID
    actor_name: Str255 | None = None
    actor_email: Str255 | None = None
    details: dict[str, object] | None = None
    ip_address: Str50 | None = None
    user_agent: Str2000 | None = None
    created_at: datetime


class CommunicationAuditListResponse(BaseModel):
    """List of communication audit entries."""

    audits: list[CommunicationAuditResponse]
    total: int


class CommunicationAuditCreate(BaseModel):
    """Data for creating an audit entry (internal use)."""

    communication_id: uuid.UUID | None = None
    conversation_id: uuid.UUID | None = None
    action: Str50
    details: dict[str, object] | None = None
