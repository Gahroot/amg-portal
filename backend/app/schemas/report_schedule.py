"""Pydantic schemas for report scheduling."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str100, Str255


class ReportScheduleCreate(BaseModel):
    """Request body for creating a report schedule."""

    report_type: Str50 = Field(
        ...,
        description=(
            "Report type: portfolio, program_status, completion, annual_review, partner_performance"
        ),
    )
    entity_id: Str100 | None = None
    frequency: Str50 = Field(..., description="Frequency: daily, weekly, monthly, quarterly")
    recipients: list[Str255] = Field(..., description="List of recipient email addresses")
    format: Str50 = Field(default="pdf", description="Output format: pdf or csv")


class ReportScheduleUpdate(BaseModel):
    """Request body for updating a report schedule."""

    frequency: Str50 | None = None
    recipients: list[Str255] | None = None
    format: Str50 | None = None
    is_active: bool | None = None


class ReportScheduleResponse(BaseModel):
    """Response body for a report schedule."""

    id: UUID
    report_type: Str50
    entity_id: Str100 | None
    frequency: Str50
    next_run: datetime
    recipients: list[Str255]
    format: Str50
    created_by: UUID
    is_active: bool
    last_run: datetime | None
    last_generated_document_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
