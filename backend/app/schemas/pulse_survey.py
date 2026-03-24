"""Pydantic schemas for Pulse Survey API."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PulseSurveyResponseType, PulseSurveyStatus, PulseSurveyTrigger

# ==================== Survey Schemas ====================


class PulseSurveyCreate(BaseModel):
    """Schema for creating a new pulse survey."""

    title: str = Field(..., min_length=1, max_length=255)
    question: str = Field(..., min_length=1)
    response_type: PulseSurveyResponseType
    allow_comment: bool = True
    trigger_type: PulseSurveyTrigger = PulseSurveyTrigger.random
    active_from: datetime | None = None
    active_to: datetime | None = None
    max_responses: int | None = Field(None, ge=1)
    min_days_between_shows: int = Field(default=14, ge=1, le=365)


class PulseSurveyUpdate(BaseModel):
    """Schema for updating a pulse survey."""

    title: str | None = Field(None, min_length=1, max_length=255)
    question: str | None = Field(None, min_length=1)
    allow_comment: bool | None = None
    trigger_type: PulseSurveyTrigger | None = None
    active_from: datetime | None = None
    active_to: datetime | None = None
    max_responses: int | None = Field(None, ge=1)
    min_days_between_shows: int | None = Field(None, ge=1, le=365)
    status: PulseSurveyStatus | None = None


class PulseSurveyDetail(BaseModel):
    """Schema for pulse survey detail response."""

    id: UUID
    title: str
    question: str
    response_type: str
    allow_comment: bool
    status: str
    trigger_type: str
    active_from: datetime | None
    active_to: datetime | None
    max_responses: int | None
    min_days_between_shows: int
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    response_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class PulseSurveyListResponse(BaseModel):
    """Schema for list of pulse surveys."""

    surveys: list[PulseSurveyDetail]
    total: int


# ==================== Response Schemas ====================


class PulseSurveyResponseCreate(BaseModel):
    """Schema for submitting a pulse survey response."""

    response_value: str = Field(..., min_length=1, max_length=20)
    comment: str | None = Field(None, max_length=2000)
    trigger_context: dict[str, Any] | None = None


class PulseSurveyResponseDetail(BaseModel):
    """Schema for pulse survey response detail."""

    id: UUID
    survey_id: UUID
    client_profile_id: UUID
    response_value: str
    comment: str | None
    trigger_context: dict[str, Any] | None
    responded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PulseSurveyResponseListResponse(BaseModel):
    """Schema for list of pulse survey responses."""

    responses: list[PulseSurveyResponseDetail]
    total: int


# ==================== Analytics Schemas ====================


class PulseSurveyValueCount(BaseModel):
    """Count for a single response value."""

    value: str
    count: int
    percent: float


class PulseSurveyStats(BaseModel):
    """Statistics for a pulse survey."""

    survey_id: UUID
    survey_title: str
    response_type: str
    total_responses: int
    breakdown: list[PulseSurveyValueCount]
    has_comments: int  # number of responses with comments
    # Sentiment score: positive responses / total (0–1), None if not applicable
    sentiment_score: float | None


class PulseSurveyClientStatus(BaseModel):
    """Whether the current client has responded to a pulse survey."""

    survey_id: UUID
    has_responded: bool
    responded_at: datetime | None
