"""Pydantic schemas for communication logs."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import CommunicationLogChannel, CommunicationLogDirection
from app.schemas.base import Str50, Str255, Str500, Str2000


class CommunicationLogCreate(BaseModel):
    channel: CommunicationLogChannel
    direction: CommunicationLogDirection
    subject: Str500
    summary: Str2000 | None = None
    client_id: UUID | None = None
    partner_id: UUID | None = None
    program_id: UUID | None = None
    contact_name: Str255 | None = None
    contact_email: Str255 | None = None
    occurred_at: datetime
    attachments: dict[str, object] | None = None
    tags: list[str] | None = None


class CommunicationLogUpdate(BaseModel):
    channel: CommunicationLogChannel | None = None
    direction: CommunicationLogDirection | None = None
    subject: Str500 | None = None
    summary: Str2000 | None = None
    client_id: UUID | None = None
    partner_id: UUID | None = None
    program_id: UUID | None = None
    contact_name: Str255 | None = None
    contact_email: Str255 | None = None
    occurred_at: datetime | None = None
    attachments: dict[str, object] | None = None
    tags: list[str] | None = None


class CommunicationLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    channel: Str50
    direction: Str50
    subject: Str500
    summary: Str2000 | None
    client_id: UUID | None
    partner_id: UUID | None
    program_id: UUID | None
    logged_by: UUID
    contact_name: Str255 | None
    contact_email: Str255 | None
    occurred_at: datetime
    attachments: dict[str, object] | None
    tags: list[str] | None
    created_at: datetime
    updated_at: datetime

    # Enriched fields from relationships
    client_name: Str255 | None = None
    partner_name: Str255 | None = None
    program_title: Str255 | None = None
    logger_name: Str255 | None = None


class CommunicationLogListResponse(BaseModel):
    logs: list[CommunicationLogResponse]
    total: int
