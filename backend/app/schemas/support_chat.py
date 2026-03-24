"""Schemas for support chat operations."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# Support Conversation schemas
class SupportConversationCreate(BaseModel):
    subject: str | None = None
    message: str
    priority: str = "normal"


class SupportConversationUpdate(BaseModel):
    subject: str | None = None
    priority: str | None = None
    status: str | None = None


class SupportConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    status: str
    priority: str
    subject: str | None = None
    assigned_agent_id: UUID | None = None
    assigned_agent_name: str | None = None
    last_message_at: datetime | None = None
    last_message_preview: str | None = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupportConversationListResponse(BaseModel):
    conversations: list[SupportConversationResponse]
    total: int


# Support Message schemas
class SupportMessageCreate(BaseModel):
    body: str
    attachment_ids: list[str] | None = None


class SupportMessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID | None = None
    sender_name: str | None = None
    sender_type: str
    body: str
    attachment_ids: list[str] | None = None
    is_internal: bool = False
    read_at: datetime | None = None
    read_by_user_at: datetime | None = None
    read_by_agent_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupportMessageListResponse(BaseModel):
    messages: list[SupportMessageResponse]
    total: int


# Offline Message schemas
class OfflineMessageCreate(BaseModel):
    name: str
    email: str
    subject: str | None = None
    message: str


class OfflineMessageResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    email: str
    subject: str | None = None
    message: str
    processed: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Agent Status schemas
class AgentStatusUpdate(BaseModel):
    status: str  # online, away, busy, offline
    max_conversations: int | None = None


class AgentStatusResponse(BaseModel):
    user_id: UUID
    user_name: str | None = None
    is_online: bool
    status: str
    active_conversations: int
    max_conversations: int
    last_seen_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# Support Availability
class SupportAvailabilityResponse(BaseModel):
    is_online: bool
    available_agents: int
    expected_wait_minutes: int | None = None
    support_hours: dict[str, Any] | None = None
    message: str | None = None


# Typing indicator
class TypingIndicator(BaseModel):
    conversation_id: UUID
    is_typing: bool


# Satisfaction survey
class SatisfactionSurveySubmit(BaseModel):
    conversation_id: UUID
    rating: int  # 1-5
    comment: str | None = None


# Assignment
class AssignConversationRequest(BaseModel):
    agent_id: UUID


# Read receipts
class MarkMessagesReadRequest(BaseModel):
    conversation_id: UUID
    last_message_id: UUID
