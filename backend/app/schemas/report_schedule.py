"""Pydantic schemas for report scheduling."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReportScheduleCreate(BaseModel):
    """Request body for creating a report schedule."""

    report_type: str = Field(
        ...,
        description=(
            "Report type: portfolio, program_status, completion, annual_review, partner_performance"
        ),
    )
    entity_id: str | None = None
    frequency: str = Field(..., description="Frequency: daily, weekly, monthly, quarterly")
    recipients: list[str] = Field(..., description="List of recipient email addresses")
    format: str = Field(default="pdf", description="Output format: pdf or csv")


class ReportScheduleUpdate(BaseModel):
    """Request body for updating a report schedule."""

    frequency: str | None = None
    recipients: list[str] | None = None
    format: str | None = None
    is_active: bool | None = None


class ReportScheduleResponse(BaseModel):
    """Response body for a report schedule."""

    id: UUID
    report_type: str
    entity_id: str | None
    frequency: str
    next_run: datetime
    recipients: list[str]
    format: str
    created_by: UUID
    is_active: bool
    last_run: datetime | None
    last_generated_document_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
