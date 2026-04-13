from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import CrmActivityType


class CrmActivityBase(BaseModel):
    type: CrmActivityType = CrmActivityType.note
    subject: str = Field(..., max_length=255)
    body: str | None = None
    occurred_at: datetime | None = None
    lead_id: UUID | None = None
    opportunity_id: UUID | None = None
    client_profile_id: UUID | None = None


class CrmActivityCreate(CrmActivityBase):
    @model_validator(mode="after")
    def at_least_one_parent(self) -> "CrmActivityCreate":
        if not (self.lead_id or self.opportunity_id or self.client_profile_id):
            raise ValueError("Activity must be linked to a lead, opportunity, or client profile")
        return self


class CrmActivityUpdate(BaseModel):
    type: CrmActivityType | None = None
    subject: str | None = Field(None, max_length=255)
    body: str | None = None
    occurred_at: datetime | None = None


class CrmActivityResponse(BaseModel):
    id: UUID
    type: CrmActivityType
    subject: str
    body: str | None
    occurred_at: datetime
    lead_id: UUID | None
    opportunity_id: UUID | None
    client_profile_id: UUID | None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CrmActivityListResponse(BaseModel):
    activities: list[CrmActivityResponse]
    total: int
