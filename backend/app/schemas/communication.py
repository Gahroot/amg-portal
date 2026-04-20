"""Schemas for communication/message operations."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255, Str500, Str2000, TextStr


class Recipient(BaseModel):
    user_id: UUID
    role: Str50  # to, cc, bcc
    email: Str255 | None = None
    name: Str255 | None = None


class CommunicationCreate(BaseModel):
    conversation_id: UUID | None = None
    channel: Str50 = "in_portal"
    recipients: list[Recipient] | None = None
    subject: Str500 | None = None
    body: TextStr
    attachment_ids: list[Str100] | None = None
    client_id: UUID | None = None
    program_id: UUID | None = None
    partner_id: UUID | None = None


class CommunicationResponse(BaseModel):
    id: UUID
    conversation_id: UUID | None = None
    channel: Str50
    status: Str50
    sender_id: UUID | None = None
    sender_name: Str255 | None = None
    recipients: dict[str, Any] | None = None
    subject: Str500 | None = None
    body: TextStr
    attachment_ids: list[Str100] | None = None
    client_id: UUID | None = None
    program_id: UUID | None = None
    partner_id: UUID | None = None
    read_receipts: dict[str, Any] | None = None
    approval_status: Str50 = "draft"
    reviewer_id: UUID | None = None
    reviewed_at: datetime | None = None
    reviewer_notes: Str2000 | None = None
    sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


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
    body: TextStr
    attachment_ids: list[Str100] | None = None


class TemplatePreviewRequest(BaseModel):
    template_id: UUID
    variables: dict[str, Any]


class TemplatePreviewResponse(BaseModel):
    subject: Str500 | None = None
    body: TextStr


class SendFromTemplateRequest(BaseModel):
    template_id: UUID
    recipient_user_ids: list[UUID]
    variables: dict[str, Any]
    client_id: UUID | None = None
    program_id: UUID | None = None
    partner_id: UUID | None = None


class CommunicationSubmitForReview(BaseModel):
    """Request to submit a communication for review. No extra fields needed."""

    pass


class CommunicationReviewAction(BaseModel):
    """Request to approve or reject a communication."""

    action: Str50  # "approve" or "reject"
    notes: Str2000 | None = None


class AudioUploadResponse(BaseModel):
    """Response after uploading a voice message audio file."""

    object_path: Str500
    url: Str2000
    file_size: int
