"""Pydantic schemas for communication logs."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import CommunicationLogChannel, CommunicationLogDirection


class CommunicationLogCreate(BaseModel):
    channel: CommunicationLogChannel
    direction: CommunicationLogDirection
    subject: str
    summary: str | None = None
    client_id: UUID | None = None
    partner_id: UUID | None = None
    program_id: UUID | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    occurred_at: datetime
    attachments: dict[str, object] | None = None
    tags: list[str] | None = None


class CommunicationLogUpdate(BaseModel):
    channel: CommunicationLogChannel | None = None
    direction: CommunicationLogDirection | None = None
    subject: str | None = None
    summary: str | None = None
    client_id: UUID | None = None
    partner_id: UUID | None = None
    program_id: UUID | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    occurred_at: datetime | None = None
    attachments: dict[str, object] | None = None
    tags: list[str] | None = None


class CommunicationLogResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    channel: str
    direction: str
    subject: str
    summary: str | None
    client_id: UUID | None
    partner_id: UUID | None
    program_id: UUID | None
    logged_by: UUID
    contact_name: str | None
    contact_email: str | None
    occurred_at: datetime
    attachments: dict[str, object] | None
    tags: list[str] | None
    created_at: datetime
    updated_at: datetime

    # Enriched fields from relationships
    client_name: str | None = None
    partner_name: str | None = None
    program_title: str | None = None
    logger_name: str | None = None


class CommunicationLogListResponse(BaseModel):
    logs: list[CommunicationLogResponse]
    total: int
