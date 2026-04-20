"""Schemas for the two-person deletion authorization workflow."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str100, Str2000


class DeletionRequestCreate(BaseModel):
    entity_type: Str100 = Field(..., description="ORM table name of the entity to delete")
    entity_id: Str100 = Field(..., description="UUID of the entity to delete")
    reason: str = Field(
        ..., min_length=10, max_length=2000, description="Why this entity should be deleted"
    )


class DeletionRequestResponse(BaseModel):
    id: UUID
    entity_type: Str100
    entity_id: Str100
    requested_by: UUID
    requested_at: datetime
    reason: Str2000
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    rejection_reason: Str2000 | None = None
    status: Str50
    executed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DeletionRequestListResponse(BaseModel):
    requests: list[DeletionRequestResponse]
    total: int


class RejectDeletionRequest(BaseModel):
    reason: str = Field(
        ..., min_length=5, max_length=2000, description="Why this deletion request is rejected"
    )
