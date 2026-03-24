"""Pydantic schemas for NPS survey API."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    NPSFollowUpActionType,
    NPSFollowUpPriority,
    NPSFollowUpStatus,
    NPSSurveyStatus,
)

# ==================== Survey Schemas ====================


class NPSSurveyCreate(BaseModel):
    """Schema for creating a new NPS survey."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    quarter: int = Field(..., ge=1, le=4)
    year: int = Field(..., ge=2020, le=2100)
    questions: list[dict[str, Any]] | dict[str, Any] = Field(default_factory=dict)
    distribution_method: str = "email"
    reminder_enabled: bool = True
    reminder_days: int = Field(default=7, ge=1, le=30)
    scheduled_at: datetime | None = None
    closes_at: datetime | None = None
    target_client_types: list[str] | None = None
    target_client_ids: list[str] | None = None


class NPSSurveyUpdate(BaseModel):
    """Schema for updating an NPS survey."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    questions: list[dict[str, Any]] | dict[str, Any] | None = None
    distribution_method: str | None = None
    reminder_enabled: bool | None = None
    reminder_days: int | None = Field(None, ge=1, le=30)
    scheduled_at: datetime | None = None
    closes_at: datetime | None = None
    target_client_types: list[str] | None = None
    target_client_ids: list[str] | None = None
    status: NPSSurveyStatus | None = None


class NPSSurveyResponse(BaseModel):
    """Schema for NPS survey response."""

    id: UUID
    name: str
    description: str | None
    quarter: int
    year: int
    status: str
    questions: list[dict[str, Any]] | dict[str, Any]
    distribution_method: str
    reminder_enabled: bool
    reminder_days: int
    scheduled_at: datetime | None
    sent_at: datetime | None
    closes_at: datetime | None
    target_client_types: list[str] | None
    target_client_ids: list[str] | None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NPSSurveyListResponse(BaseModel):
    """Schema for list of NPS surveys."""

    surveys: list[NPSSurveyResponse]
    total: int


# ==================== Response Schemas ====================


class NPSResponseCreate(BaseModel):
    """Schema for submitting an NPS response."""

    score: int = Field(..., ge=0, le=10)
    comment: str | None = Field(None, max_length=5000)
    custom_responses: dict[str, Any] | None = None
    response_channel: str = "portal"


class NPSResponseUpdate(BaseModel):
    """Schema for updating an NPS response (admin only)."""

    follow_up_required: bool | None = None
    follow_up_completed: bool | None = None


class NPSResponseDetail(BaseModel):
    """Schema for NPS response detail."""

    id: UUID
    survey_id: UUID
    client_profile_id: UUID
    score: int
    score_category: str
    comment: str | None
    custom_responses: dict[str, Any] | None
    responded_at: datetime
    response_channel: str
    follow_up_required: bool
    follow_up_completed: bool

    model_config = ConfigDict(from_attributes=True)


class NPSResponseListResponse(BaseModel):
    """Schema for list of NPS responses."""

    responses: list[NPSResponseDetail]
    total: int


# ==================== Follow-Up Schemas ====================


class NPSFollowUpCreate(BaseModel):
    """Schema for creating an NPS follow-up."""

    response_id: UUID
    assigned_to: UUID
    priority: NPSFollowUpPriority = NPSFollowUpPriority.medium
    action_type: NPSFollowUpActionType = NPSFollowUpActionType.personal_reach_out
    notes: str | None = None
    due_at: datetime | None = None


class NPSFollowUpUpdate(BaseModel):
    """Schema for updating an NPS follow-up."""

    assigned_to: UUID | None = None
    priority: NPSFollowUpPriority | None = None
    status: NPSFollowUpStatus | None = None
    action_type: NPSFollowUpActionType | None = None
    notes: str | None = None
    resolution_notes: str | None = None
    due_at: datetime | None = None


class NPSFollowUpResponse(BaseModel):
    """Schema for NPS follow-up response."""

    id: UUID
    survey_id: UUID
    response_id: UUID
    client_profile_id: UUID
    assigned_to: UUID
    priority: str
    status: str
    action_type: str
    notes: str | None
    resolution_notes: str | None
    due_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NPSFollowUpListResponse(BaseModel):
    """Schema for list of NPS follow-ups."""

    follow_ups: list[NPSFollowUpResponse]
    total: int


# ==================== Analytics Schemas ====================


class NPSSurveyStats(BaseModel):
    """Schema for NPS survey statistics."""

    survey_id: UUID
    survey_name: str
    quarter: int
    year: int
    total_sent: int
    total_responses: int
    response_rate: float
    nps_score: float
    promoters_count: int
    passives_count: int
    detractors_count: int
    promoters_percent: float
    passives_percent: float
    detractors_percent: float
    average_score: float
    follow_ups_pending: int
    follow_ups_completed: int


class NPSTrendPoint(BaseModel):
    """Schema for a single point in NPS trend data."""

    period: str  # e.g., "Q1 2024"
    quarter: int
    year: int
    nps_score: float
    response_count: int
    promoters_percent: float
    passives_percent: float
    detractors_percent: float


class NPSTrendAnalysis(BaseModel):
    """Schema for NPS trend analysis."""

    trends: list[NPSTrendPoint]
    current_nps: float
    previous_nps: float | None
    change: float | None
    trend_direction: str  # "up", "down", "stable"


class NPSClientSummary(BaseModel):
    """Schema for client NPS summary in a survey."""

    client_profile_id: UUID
    legal_name: str
    score: int | None
    score_category: str | None
    responded_at: datetime | None
    follow_up_status: str | None


class NPSSurveyClientListResponse(BaseModel):
    """Schema for list of clients in a survey with their status."""

    clients: list[NPSClientSummary]
    total: int
