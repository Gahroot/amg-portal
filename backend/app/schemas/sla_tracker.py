from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255


class SLATrackerResponse(BaseModel):
    id: UUID
    entity_type: Str50
    entity_id: Str100
    communication_type: Str50
    sla_hours: int
    started_at: datetime
    responded_at: datetime | None = None
    breach_status: Str50
    assigned_to: UUID
    assigned_to_email: Str255 | None = None
    assigned_to_name: Str255 | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SLATrackerListResponse(BaseModel):
    trackers: list[SLATrackerResponse]
    total: int


class SLACreate(BaseModel):
    entity_type: Str50
    entity_id: Str100
    communication_type: Str50
    sla_hours: int | None = None
    assigned_to: UUID


class SLABreachAlertResponse(BaseModel):
    id: UUID
    entity_type: Str50
    entity_id: Str100
    communication_type: Str50
    sla_hours: int
    started_at: datetime
    breach_status: Str50
    assigned_to: UUID
    hours_elapsed: float
    hours_remaining: float | None = None
    overdue_hours: float | None = None

    model_config = ConfigDict(from_attributes=True)
