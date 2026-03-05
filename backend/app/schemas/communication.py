"""Schemas for communication/message operations."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class Recipient(BaseModel):
    user_id: UUID
    role: str  # to, cc, bcc
    email: str | None = None
    name: str | None = None


class CommunicationCreate(BaseModel):
    conversation_id: UUID | None = None
    channel: str = "in_portal"
    recipients: list[Recipient] | None = None
    subject: str | None = None
    body: str
    attachment_ids: list[str] | None = None
    client_id: UUID | None = None
    program_id: UUID | None = None
    partner_id: UUID | None = None


class CommunicationResponse(BaseModel):
    id: UUID
    conversation_id: UUID | None = None
    channel: str
    status: str
    sender_id: UUID | None = None
    sender_name: str | None = None
    recipients: dict[str, Any] | None = None
    subject: str | None = None
    body: str
    attachment_ids: list[str] | None = None
    client_id: UUID | None = None
    program_id: UUID | None = None
    partner_id: UUID | None = None
    read_receipts: dict[str, Any] | None = None
    sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommunicationListResponse(BaseModel):
    communications: list[CommunicationResponse]
    total: int


class CommunicationMarkReadRequest(BaseModel):
    communication_id: UUID


class UnreadCountResponse(BaseModel):
    total: int
    by_conversation: dict[str, int]


class SendMessageRequest(BaseModel):
    conversation_id: UUID | None = None
    body: str
    attachment_ids: list[str] | None = None
