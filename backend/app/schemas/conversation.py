"""Schemas for conversation operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.communication import CommunicationResponse


class ConversationCreate(BaseModel):
    conversation_type: str = "rm_client"
    client_id: UUID | None = None
    partner_assignment_id: UUID | None = None
    title: str | None = None
    participant_ids: list[UUID] = Field(default_factory=list)


class ConversationUpdate(BaseModel):
    title: str | None = None
    participant_ids: list[UUID] | None = None


class ParticipantInfo(BaseModel):
    id: UUID
    full_name: str
    role: str


class ConversationResponse(BaseModel):
    id: UUID
    conversation_type: str
    client_id: UUID | None = None
    partner_assignment_id: UUID | None = None
    title: str | None = None
    participant_ids: list[UUID]
    last_activity_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    # Computed fields
    unread_count: int = 0
    participants: list[ParticipantInfo] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ConversationListResponse(BaseModel):
    conversations: list[ConversationResponse]
    total: int


class MessageListResponse(BaseModel):
    communications: list[CommunicationResponse]
    total: int


class ConversationMarkReadRequest(BaseModel):
    message_id: UUID


class AddParticipantRequest(BaseModel):
    user_id: UUID
