from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str255, Str500, Str2000, TextStr


class AssignmentCreate(BaseModel):
    partner_id: UUID
    program_id: UUID
    title: Str255
    brief: TextStr
    sla_terms: Str2000 | None = None
    due_date: date | None = None
    # Hours from dispatch until offer expires (default 48 h)
    offer_hours: int = Field(default=48, ge=1, le=720)


class AssignmentUpdate(BaseModel):
    title: Str255 | None = None
    brief: TextStr | None = None
    sla_terms: Str2000 | None = None
    status: Str50 | None = None
    due_date: date | None = None


class DeclineRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)


class AssignmentHistoryEntry(BaseModel):
    id: UUID
    assignment_id: UUID
    actor_id: UUID
    event: Str50
    reason: Str2000 | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssignmentResponse(BaseModel):
    id: UUID
    partner_id: UUID
    program_id: UUID
    assigned_by: UUID
    title: Str255
    brief: TextStr
    sla_terms: Str2000 | None = None
    status: Str50
    due_date: date | None = None
    offer_expires_at: datetime | None = None
    accepted_at: datetime | None = None
    completed_at: datetime | None = None
    declined_at: datetime | None = None
    decline_reason: Str2000 | None = None
    created_at: datetime
    updated_at: datetime
    brief_pdf_path: Str500 | None = None
    partner_firm_name: Str255 | None = None
    program_title: Str255 | None = None

    model_config = ConfigDict(from_attributes=True)


class AssignmentListResponse(BaseModel):
    assignments: list[AssignmentResponse]
    total: int


class AssignmentDispatch(BaseModel):
    pass
