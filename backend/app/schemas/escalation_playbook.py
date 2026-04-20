"""Pydantic schemas for escalation playbooks and executions."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str100, Str255, Str500, Str2000

# ── Playbook step shape ────────────────────────────────────────────────


class PlaybookStepResource(BaseModel):
    label: Str255
    url: Str500 | None = None


class PlaybookStep(BaseModel):
    order: int
    title: Str255
    description: Str2000
    time_estimate_minutes: int | None = None
    resources: list[PlaybookStepResource] = Field(default_factory=list)


# ── Escalation path shape ──────────────────────────────────────────────


class EscalationPath(BaseModel):
    condition: Str500
    action: Str500
    contact_role: Str50 | None = None


# ── Playbook CRUD ──────────────────────────────────────────────────────


class PlaybookCreate(BaseModel):
    escalation_type: Str50
    name: Str255
    description: Str2000 | None = None
    steps: list[PlaybookStep] = Field(default_factory=list)
    success_criteria: list[str] = Field(default_factory=list)
    escalation_paths: list[EscalationPath] = Field(default_factory=list)
    is_active: bool = True


class PlaybookUpdate(BaseModel):
    name: Str255 | None = None
    description: Str2000 | None = None
    steps: list[PlaybookStep] | None = None
    success_criteria: list[str] | None = None
    escalation_paths: list[EscalationPath] | None = None
    is_active: bool | None = None


class PlaybookResponse(BaseModel):
    id: UUID
    escalation_type: Str50
    name: Str255
    description: Str2000 | None = None
    steps: list[dict[str, object]]
    success_criteria: list[str]
    escalation_paths: list[dict[str, object]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlaybookListResponse(BaseModel):
    playbooks: list[PlaybookResponse]
    total: int


# ── Execution schemas ──────────────────────────────────────────────────


class StepStateUpdate(BaseModel):
    step_order: int
    completed: bool | None = None
    skipped: bool | None = None
    skip_reason: Str2000 | None = None
    notes: Str2000 | None = None


class StepState(BaseModel):
    step_order: int
    completed: bool = False
    skipped: bool = False
    skip_reason: Str2000 | None = None
    notes: Str2000 | None = None
    completed_at: Str50 | None = None
    completed_by: Str100 | None = None


class ProgressSummary(BaseModel):
    completed: int
    skipped: int
    total: int
    percentage: int


class ExecutionResponse(BaseModel):
    id: UUID
    playbook_id: UUID
    escalation_id: UUID
    status: Str50
    step_states: list[dict[str, object]]
    started_by: UUID
    completed_steps: int
    total_steps: int
    completed_at: datetime | None = None
    progress: ProgressSummary
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlaybookWithExecutionResponse(BaseModel):
    """Combined response: playbook template + current execution state."""

    playbook: PlaybookResponse
    execution: ExecutionResponse | None = None
    suggested_actions: list[dict[str, object]] = Field(default_factory=list)
