from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SLATrackerResponse(BaseModel):
    id: UUID
    entity_type: str
    entity_id: str
    communication_type: str
    sla_hours: int
    started_at: datetime
    responded_at: datetime | None = None
    breach_status: str
    assigned_to: UUID
    assigned_to_email: str | None = None
    assigned_to_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SLATrackerListResponse(BaseModel):
    trackers: list[SLATrackerResponse]
    total: int


class SLACreate(BaseModel):
    entity_type: str
    entity_id: str
    communication_type: str
    sla_hours: int | None = None
    assigned_to: UUID


class SLABreachAlertResponse(BaseModel):
    id: UUID
    entity_type: str
    entity_id: str
    communication_type: str
    sla_hours: int
    started_at: datetime
    breach_status: str
    assigned_to: UUID
    hours_elapsed: float
    hours_remaining: float | None = None
    overdue_hours: float | None = None

    model_config = {"from_attributes": True}
