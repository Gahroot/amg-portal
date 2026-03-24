"""Schemas for client timeline."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TimelineEventType(StrEnum):
    """Types of events that appear on the client timeline."""

    communication = "communication"
    document = "document"
    milestone = "milestone"
    program_status = "program_status"
    approval = "approval"
    compliance = "compliance"
    note = "note"


class TimelineEventResponse(BaseModel):
    """A single timeline event."""

    id: UUID
    event_type: TimelineEventType
    title: str
    description: str | None = None
    occurred_at: datetime
    metadata: dict[str, Any] = {}
    # For linking to detail views
    entity_id: UUID | None = None
    entity_type: str | None = None
    # Actor info
    actor_name: str | None = None
    actor_id: UUID | None = None

    model_config = ConfigDict(from_attributes=True)


class TimelineListResponse(BaseModel):
    """Paginated list of timeline events."""

    items: list[TimelineEventResponse]
    total: int
    has_more: bool


class TimelineExportResponse(BaseModel):
    """Response for timeline export."""

    file_url: str
    file_name: str
