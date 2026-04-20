"""Schemas for support chat operations."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255, Str500, Str2000, TextStr


# Support Conversation schemas
class SupportConversationCreate(BaseModel):
    subject: Str500 | None = None
    message: TextStr
    priority: Str50 = "normal"


class SupportConversationUpdate(BaseModel):
    subject: Str500 | None = None
    priority: Str50 | None = None
    status: Str50 | None = None


class SupportConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    status: Str50
    priority: Str50
    subject: Str500 | None = None
    assigned_agent_id: UUID | None = None
    assigned_agent_name: Str255 | None = None
    last_message_at: datetime | None = None
    last_message_preview: Str500 | None = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupportConversationListResponse(BaseModel):
    conversations: list[SupportConversationResponse]
    total: int


# Support Message schemas
class SupportMessageCreate(BaseModel):
    body: TextStr
    attachment_ids: list[Str100] | None = None


class SupportMessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID | None = None
    sender_name: Str255 | None = None
    sender_type: Str50
    body: TextStr
    attachment_ids: list[Str100] | None = None
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
    name: Str255
    email: Str255
    subject: Str500 | None = None
    message: TextStr


class OfflineMessageResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: Str255
    email: Str255
    subject: Str500 | None = None
    message: TextStr
    processed: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Agent Status schemas
class AgentStatusUpdate(BaseModel):
    status: Str50  # online, away, busy, offline
    max_conversations: int | None = None


class AgentStatusResponse(BaseModel):
    user_id: UUID
    user_name: Str255 | None = None
    is_online: bool
    status: Str50
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
    message: Str2000 | None = None


# Typing indicator
class TypingIndicator(BaseModel):
    conversation_id: UUID
    is_typing: bool


# Satisfaction survey
class SatisfactionSurveySubmit(BaseModel):
    conversation_id: UUID
    rating: int  # 1-5
    comment: Str2000 | None = None


# Assignment
class AssignConversationRequest(BaseModel):
    agent_id: UUID


# Read receipts
class MarkMessagesReadRequest(BaseModel):
    conversation_id: UUID
    last_message_id: UUID
