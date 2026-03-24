"""Pydantic schemas for partner threshold configuration."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PartnerThresholdCreate(BaseModel):
    sla_compliance_threshold: float = Field(
        90.0, ge=0, le=100, description="Minimum SLA compliance % (0–100)"
    )
    quality_score_threshold: float = Field(
        3.0, ge=1, le=5, description="Minimum quality score (1–5)"
    )
    overall_score_threshold: float = Field(
        3.0, ge=1, le=5, description="Minimum overall score (1–5)"
    )
    trend_window_weeks: int = Field(
        4, ge=1, le=52, description="Consecutive declining weeks to trigger alert"
    )


class PartnerThresholdUpdate(BaseModel):
    sla_compliance_threshold: float | None = Field(
        None, ge=0, le=100, description="Minimum SLA compliance % (0–100)"
    )
    quality_score_threshold: float | None = Field(
        None, ge=1, le=5, description="Minimum quality score (1–5)"
    )
    overall_score_threshold: float | None = Field(
        None, ge=1, le=5, description="Minimum overall score (1–5)"
    )
    trend_window_weeks: int | None = Field(
        None, ge=1, le=52, description="Consecutive declining weeks to trigger alert"
    )


class PartnerThresholdResponse(BaseModel):
    id: uuid.UUID
    partner_id: uuid.UUID | None = None
    sla_compliance_threshold: float
    quality_score_threshold: float
    overall_score_threshold: float
    trend_window_weeks: int
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
