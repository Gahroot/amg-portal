from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str2000


class PartnerRatingCreate(BaseModel):
    partner_id: UUID
    quality_score: int = Field(ge=1, le=5)
    timeliness_score: int = Field(ge=1, le=5)
    communication_score: int = Field(ge=1, le=5)
    overall_score: int = Field(ge=1, le=5)
    comments: Str2000 | None = None


class PartnerRatingResponse(BaseModel):
    id: UUID
    program_id: UUID
    partner_id: UUID
    rated_by: UUID
    quality_score: int
    timeliness_score: int
    communication_score: int
    overall_score: int
    comments: Str2000 | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
