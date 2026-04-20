"""Schemas for decision request operations."""

from datetime import date, datetime, time
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255, Str2000, TextStr


class DecisionOption(BaseModel):
    id: Str100
    label: Str255
    description: Str2000 | None = None
    # Plain-language impact explanation shown to the client
    impact_description: Str2000 | None = None
    # What happens next if this option is chosen
    what_happens_next: Str2000 | None = None
    # Key considerations the client should think about
    considerations: list[str] | None = None
    # Whether this option is recommended by the advisory team
    recommended: bool = False


class DecisionRequestCreate(BaseModel):
    client_id: UUID
    program_id: UUID | None = None
    title: Str255
    prompt: TextStr
    response_type: Str50 = "choice"  # choice, text, yes_no, multi_choice
    options: list[DecisionOption] | None = None
    deadline_date: date | None = None
    deadline_time: time | None = None
    consequence_text: Str2000 | None = None


class DecisionRequestResponse(BaseModel):
    id: UUID
    client_id: UUID
    program_id: UUID | None = None
    title: Str255
    prompt: TextStr
    response_type: Str50
    options: list[DecisionOption] | None = None
    deadline_date: date | None = None
    deadline_time: time | None = None
    consequence_text: Str2000 | None = None
    status: Str50
    response: dict[str, Any] | None = None
    responded_at: datetime | None = None
    responded_by: UUID | None = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DecisionListResponse(BaseModel):
    decisions: list[DecisionRequestResponse]
    total: int


class DecisionSubmitResponse(BaseModel):
    option_id: Str100 | None = None
    text: TextStr | None = None


class DecisionRespondRequest(BaseModel):
    response: DecisionSubmitResponse


class DecisionRequestUpdate(BaseModel):
    title: Str255 | None = None
    prompt: TextStr | None = None
    options: list[DecisionOption] | None = None
    deadline_date: date | None = None
    deadline_time: time | None = None
    consequence_text: Str2000 | None = None
    status: Str50 | None = None
