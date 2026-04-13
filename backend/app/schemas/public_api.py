"""Public API schemas for external integrations (Zapier, Make, etc.)."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.url_safety import validate_safe_webhook_url

# ============ Event Types ============

PUBLIC_API_EVENT_TYPES = [
    "task.created",
    "task.updated",
    "task.completed",
    "assignment.created",
    "assignment.status_changed",
    "assignment.completed",
    "program.created",
    "program.status_changed",
    "document.uploaded",
    "document.approved",
    "deliverable.submitted",
    "deliverable.approved",
]

PUBLIC_API_EVENT_DESCRIPTIONS = {
    "task.created": "Triggered when a new task is created",
    "task.updated": "Triggered when a task is updated",
    "task.completed": "Triggered when a task is marked as complete",
    "assignment.created": "Triggered when a new partner assignment is created",
    "assignment.status_changed": "Triggered when an assignment status changes",
    "assignment.completed": "Triggered when an assignment is completed",
    "program.created": "Triggered when a new program is created",
    "program.status_changed": "Triggered when a program status changes",
    "document.uploaded": "Triggered when a document is uploaded",
    "document.approved": "Triggered when a document is approved",
    "deliverable.submitted": "Triggered when a deliverable is submitted",
    "deliverable.approved": "Triggered when a deliverable is approved",
}


# ============ Webhook Subscription ============


class PublicWebhookCreate(BaseModel):
    """Request to create a public webhook subscription."""

    url: str = Field(..., min_length=1, max_length=500, description="Webhook endpoint URL")
    events: list[str] = Field(..., min_length=1, description="Event types to subscribe to")
    description: str | None = Field(None, max_length=255, description="Optional description")

    @field_validator("url")
    @classmethod
    def _validate_url(cls, v: str) -> str:
        return validate_safe_webhook_url(v)

    @field_validator("events")
    @classmethod
    def _validate_events(cls, v: list[str]) -> list[str]:
        invalid = [e for e in v if e not in PUBLIC_API_EVENT_TYPES]
        if invalid:
            raise ValueError(f"Invalid event types: {invalid}")
        return v


class PublicWebhookResponse(BaseModel):
    """Response for a public webhook subscription."""

    id: UUID
    url: str
    events: list[str]
    secret: str  # Show secret on creation only
    is_active: bool
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicWebhookListResponse(BaseModel):
    """Response for listing webhooks."""

    webhooks: list[PublicWebhookResponse]
    total: int


# ============ Event Data Payloads ============


class EventActor(BaseModel):
    """Actor information in events."""

    id: UUID
    name: str
    email: str
    role: str


class EventTask(BaseModel):
    """Task data in events."""

    id: UUID
    title: str
    description: str | None = None
    status: str
    priority: str
    due_date: str | None = None
    program_id: UUID | None = None
    program_name: str | None = None
    assigned_to: EventActor | None = None
    created_at: datetime
    updated_at: datetime | None = None


class EventAssignment(BaseModel):
    """Assignment data in events."""

    id: UUID
    title: str
    status: str
    program_id: UUID
    program_name: str
    partner_id: UUID
    partner_name: str
    due_date: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class EventProgram(BaseModel):
    """Program data in events."""

    id: UUID
    name: str
    status: str
    client_id: UUID
    client_name: str
    description: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class EventDocument(BaseModel):
    """Document data in events."""

    id: UUID
    title: str
    status: str
    document_type: str
    program_id: UUID | None = None
    program_name: str | None = None
    uploaded_by: EventActor
    created_at: datetime
    updated_at: datetime | None = None


class EventDeliverable(BaseModel):
    """Deliverable data in events."""

    id: UUID
    title: str
    status: str
    assignment_id: UUID
    assignment_title: str
    submitted_by: EventActor
    created_at: datetime
    updated_at: datetime | None = None


class PublicEventPayload(BaseModel):
    """Standard event payload for webhooks."""

    id: UUID
    event_type: str
    timestamp: datetime
    data: dict[str, Any]
    actor: EventActor | None = None


# ============ Zapier/Make Specific Schemas ============


class ZapierPollResponse(BaseModel):
    """Response for Zapier polling triggers."""

    results: list[dict[str, Any]]
    has_more: bool = False
    next_cursor: str | None = None


class ZapierTestRequest(BaseModel):
    """Request to test Zapier connection."""

    api_key: str = Field(..., description="API key to test")


class ZapierTestResponse(BaseModel):
    """Response for Zapier connection test."""

    success: bool
    user: dict[str, Any] | None = None
    message: str | None = None


# ============ Action Schemas ============


class CreateTaskRequest(BaseModel):
    """Request to create a task via public API."""

    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=5000)
    program_id: UUID | None = None
    milestone_id: UUID | None = None
    priority: str = Field("medium", pattern="^(low|medium|high|urgent)$")
    due_date: str | None = None  # ISO date string
    assigned_to_id: UUID | None = None


class UpdateTaskRequest(BaseModel):
    """Request to update a task via public API."""

    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(None, pattern="^(todo|in_progress|review|done|cancelled)$")
    priority: str | None = Field(None, pattern="^(low|medium|high|urgent)$")
    due_date: str | None = None
    assigned_to_id: UUID | None = None


class CreateTaskResponse(BaseModel):
    """Response for task creation."""

    id: UUID
    title: str
    description: str | None = None
    status: str
    priority: str
    due_date: str | None = None
    program_id: UUID | None = None
    milestone_id: UUID | None = None
    assigned_to_id: UUID | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UpdateStatusRequest(BaseModel):
    """Request to update status via public API."""

    status: str = Field(..., description="New status value")
    notes: str | None = Field(None, max_length=1000, description="Optional notes for the change")


class UpdateStatusResponse(BaseModel):
    """Response for status update."""

    id: UUID
    status: str
    updated_at: datetime
    message: str = "Status updated successfully"

    model_config = ConfigDict(from_attributes=True)


# ============ API Info ============


class APIInfoResponse(BaseModel):
    """Response for API info endpoint."""

    name: str = "AMG Portal API"
    version: str = "1.0.0"
    description: str = "Public API for AMG Portal integrations"
    event_types: list[dict[str, str]]
    documentation_url: str = "/api/v1/public/docs"
    openapi_url: str = "/api/v1/openapi.json"
