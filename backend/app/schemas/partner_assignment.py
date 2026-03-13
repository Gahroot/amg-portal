from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class AssignmentCreate(BaseModel):
    partner_id: UUID
    program_id: UUID
    title: str
    brief: str
    sla_terms: str | None = None
    due_date: date | None = None
    status: str = "draft"


class AssignmentUpdate(BaseModel):
    title: str | None = None
    brief: str | None = None
    sla_terms: str | None = None
    status: str | None = None
    due_date: date | None = None


class AssignmentResponse(BaseModel):
    id: UUID
    partner_id: UUID
    program_id: UUID
    assigned_by: UUID
    title: str
    brief: str
    sla_terms: str | None = None
    status: str
    due_date: date | None = None
    accepted_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    partner_firm_name: str | None = None
    program_title: str | None = None

    model_config = {"from_attributes": True}


class AssignmentListResponse(BaseModel):
    assignments: list[AssignmentResponse]
    total: int


class AssignmentDispatch(BaseModel):
    pass
