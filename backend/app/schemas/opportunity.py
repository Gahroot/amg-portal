from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import OpportunityStage
from app.schemas.base import Str100, Str255, Str500, Str2000


class OpportunityBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Str2000 | None = None
    stage: OpportunityStage = OpportunityStage.qualifying
    value: Decimal | None = None
    probability: int = Field(50, ge=0, le=100)
    expected_close_date: date | None = None
    program_type: str | None = Field(None, max_length=100)
    next_step: str | None = Field(None, max_length=500)
    next_step_at: date | None = None
    lead_id: UUID | None = None
    client_profile_id: UUID | None = None


class OpportunityCreate(OpportunityBase):
    owner_id: UUID | None = None


class OpportunityUpdate(BaseModel):
    title: str | None = Field(None, max_length=255)
    description: Str2000 | None = None
    stage: OpportunityStage | None = None
    value: Decimal | None = None
    probability: int | None = Field(None, ge=0, le=100)
    expected_close_date: date | None = None
    program_type: str | None = Field(None, max_length=100)
    next_step: str | None = Field(None, max_length=500)
    next_step_at: date | None = None
    owner_id: UUID | None = None
    lost_reason: str | None = Field(None, max_length=500)


class OpportunityResponse(BaseModel):
    id: UUID
    title: Str255
    description: Str2000 | None
    stage: OpportunityStage
    position: int
    value: Decimal | None
    probability: int
    expected_close_date: date | None
    program_type: Str100 | None
    next_step: Str500 | None
    next_step_at: date | None
    owner_id: UUID
    lead_id: UUID | None
    client_profile_id: UUID | None
    won_at: datetime | None
    lost_at: datetime | None
    lost_reason: Str500 | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OpportunityListResponse(BaseModel):
    opportunities: list[OpportunityResponse]
    total: int


class OpportunityReorderRequest(BaseModel):
    """Drag-and-drop reorder payload for kanban."""

    new_stage: OpportunityStage
    after_opportunity_id: UUID | None = None


class PipelineSummary(BaseModel):
    """Aggregate stats for the pipeline dashboard."""

    stage: OpportunityStage
    count: int
    total_value: Decimal
    weighted_value: Decimal
