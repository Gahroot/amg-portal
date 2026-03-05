"""Schemas for decision request operations."""

from datetime import date, datetime, time
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DecisionOption(BaseModel):
    id: str
    label: str
    description: str | None = None


class DecisionRequestCreate(BaseModel):
    client_id: UUID
    program_id: UUID | None = None
    title: str
    prompt: str
    response_type: str = "choice"  # choice, text, yes_no, multi_choice
    options: list[DecisionOption] | None = None
    deadline_date: date | None = None
    deadline_time: time | None = None
    consequence_text: str | None = None


class DecisionRequestResponse(BaseModel):
    id: UUID
    client_id: UUID
    program_id: UUID | None = None
    title: str
    prompt: str
    response_type: str
    options: list[DecisionOption] | None = None
    deadline_date: date | None = None
    deadline_time: time | None = None
    consequence_text: str | None = None
    status: str
    response: dict[str, Any] | None = None
    responded_at: datetime | None = None
    responded_by: UUID | None = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DecisionListResponse(BaseModel):
    decisions: list[DecisionRequestResponse]
    total: int


class DecisionSubmitResponse(BaseModel):
    option_id: str | None = None
    text: str | None = None


class DecisionRespondRequest(BaseModel):
    response: DecisionSubmitResponse


class DecisionRequestUpdate(BaseModel):
    title: str | None = None
    prompt: str | None = None
    options: list[DecisionOption] | None = None
    deadline_date: date | None = None
    deadline_time: time | None = None
    consequence_text: str | None = None
    status: str | None = None
