"""Pydantic schemas for communication audit trail."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CommunicationAuditResponse(BaseModel):
    """Single communication audit entry."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    communication_id: uuid.UUID | None = None
    conversation_id: uuid.UUID | None = None
    action: str
    actor_id: uuid.UUID
    actor_name: str | None = None
    actor_email: str | None = None
    details: dict[str, object] | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime


class CommunicationAuditListResponse(BaseModel):
    """List of communication audit entries."""

    audits: list[CommunicationAuditResponse]
    total: int


class CommunicationAuditCreate(BaseModel):
    """Data for creating an audit entry (internal use)."""

    communication_id: uuid.UUID | None = None
    conversation_id: uuid.UUID | None = None
    action: str
    details: dict[str, object] | None = None
