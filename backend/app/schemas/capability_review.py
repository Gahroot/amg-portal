"""Pydantic schemas for capability review endpoints."""

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str100, Str255, Str2000


class CapabilityReviewFinding(BaseModel):
    """A finding from a capability review."""

    finding_type: Str100 = Field(..., description="Type of finding")
    description: Str2000 = Field(..., description="Description of the finding")
    severity: Str50 = Field(default="medium", description="Severity: low, medium, high, critical")
    recommendation: Str2000 | None = Field(default=None, description="Recommended action")


class CapabilityReviewResponse(BaseModel):
    """Full capability review response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    partner_id: uuid.UUID
    review_year: int
    status: Str50
    reviewer_id: uuid.UUID | None = None
    scheduled_date: date | None = None
    completed_date: date | None = None
    capabilities_reviewed: list[str] | None = None
    certifications_reviewed: list[str] | None = None
    qualifications_reviewed: list[str] | None = None
    findings: list[dict[str, Any]] | None = None
    notes: Str2000 | None = None
    recommendations: Str2000 | None = None
    reminder_sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    # Computed fields
    partner_name: Str255 | None = None
    reviewer_name: Str255 | None = None


class CapabilityReviewListResponse(BaseModel):
    """Paginated list of capability reviews."""

    reviews: list[CapabilityReviewResponse]
    total: int


class CreateCapabilityReviewRequest(BaseModel):
    """Request to create a new capability review."""

    partner_id: uuid.UUID
    review_year: int = Field(..., ge=2020, le=2100)
    reviewer_id: uuid.UUID | None = None
    scheduled_date: date | None = None
    notes: Str2000 | None = None


class UpdateCapabilityReviewRequest(BaseModel):
    """Request to update a capability review."""

    status: Str50 | None = None
    reviewer_id: uuid.UUID | None = None
    scheduled_date: date | None = None
    capabilities_reviewed: list[str] | None = None
    certifications_reviewed: list[str] | None = None
    qualifications_reviewed: list[str] | None = None
    findings: list[dict[str, Any]] | None = None
    notes: Str2000 | None = None
    recommendations: Str2000 | None = None


class CompleteCapabilityReviewRequest(BaseModel):
    """Request to complete a capability review."""

    findings: list[dict[str, Any]] | None = None
    recommendations: Str2000 | None = None
    notes: Str2000 | None = None


class CapabilityReviewStatistics(BaseModel):
    """Statistics for capability reviews."""

    total: int = 0
    pending: int = 0
    scheduled: int = 0
    in_progress: int = 0
    completed: int = 0
    overdue: int = 0
    waived: int = 0
    by_year: dict[int, int] = Field(default_factory=dict)


class GenerateAnnualReviewsRequest(BaseModel):
    """Request to generate annual reviews for all active partners."""

    review_year: int = Field(..., ge=2020, le=2100)
    scheduled_date: date | None = None
