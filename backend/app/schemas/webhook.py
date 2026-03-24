"""Schemas for webhook operations."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

if TYPE_CHECKING:
    from app.models.webhook import Webhook

# Valid webhook event types
WEBHOOK_EVENT_TYPES = [
    "assignment.created",
    "assignment.accepted",
    "assignment.completed",
    "deliverable.uploaded",
    "payment.processed",
]

WEBHOOK_EVENT_DESCRIPTIONS = {
    "assignment.created": "Triggered when a new assignment is dispatched to you",
    "assignment.accepted": "Triggered when you accept an assignment",
    "assignment.completed": "Triggered when an assignment is marked complete",
    "deliverable.uploaded": "Triggered when a deliverable is submitted",
    "payment.processed": "Triggered when a payment is processed for your account",
}


class WebhookCreate(BaseModel):
    """Request to create a new webhook."""

    url: str = Field(..., min_length=1, max_length=500, description="Webhook endpoint URL")
    secret: str = Field(
        ..., min_length=16, max_length=100, description="Secret key for HMAC signatures"
    )
    events: list[str] = Field(..., min_length=1, description="Event types to subscribe to")
    description: str | None = Field(None, max_length=255, description="Optional description")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: list[str]) -> list[str]:
        invalid = [e for e in v if e not in WEBHOOK_EVENT_TYPES]
        if invalid:
            raise ValueError(f"Invalid event types: {invalid}. Valid types: {WEBHOOK_EVENT_TYPES}")
        return v


class WebhookUpdate(BaseModel):
    """Request to update a webhook."""

    url: str | None = Field(None, min_length=1, max_length=500)
    secret: str | None = Field(None, min_length=16, max_length=100)
    events: list[str] | None = Field(None, min_length=1)
    is_active: bool | None = None
    description: str | None = Field(None, max_length=255)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        if v is not None and not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: list[str] | None) -> list[str] | None:
        if v is not None:
            invalid = [e for e in v if e not in WEBHOOK_EVENT_TYPES]
            if invalid:
                raise ValueError(
                    f"Invalid event types: {invalid}. Valid types: {WEBHOOK_EVENT_TYPES}"
                )
        return v


class WebhookResponse(BaseModel):
    """Response for a webhook configuration."""

    id: UUID
    partner_id: UUID
    url: str
    events: list[str]
    is_active: bool
    last_triggered_at: datetime | None = None
    failure_count: int
    description: str | None = None
    created_at: datetime
    updated_at: datetime
    # Secret is never returned in full, only a hint
    secret_hint: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_webhook(cls, webhook: "Webhook") -> "WebhookResponse":
        """Create response from webhook model, masking the secret."""
        return cls(
            id=webhook.id,
            partner_id=webhook.partner_id,
            url=webhook.url,
            events=webhook.events,
            is_active=webhook.is_active,
            last_triggered_at=webhook.last_triggered_at,
            failure_count=webhook.failure_count,
            description=webhook.description,
            created_at=webhook.created_at,
            updated_at=webhook.updated_at,
            secret_hint=f"...{webhook.secret[-4:]}" if len(webhook.secret) >= 4 else None,
        )


class WebhookListResponse(BaseModel):
    """Response for listing webhooks."""

    webhooks: list[WebhookResponse]
    total: int


class WebhookDeliveryResponse(BaseModel):
    """Response for a webhook delivery log."""

    id: UUID
    webhook_id: UUID
    event_type: str
    payload: str
    status_code: int | None = None
    response_body: str | None = None
    error_message: str | None = None
    success: bool
    attempt_number: int
    duration_ms: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WebhookDeliveryListResponse(BaseModel):
    """Response for listing webhook deliveries."""

    deliveries: list[WebhookDeliveryResponse]
    total: int


class WebhookTestRequest(BaseModel):
    """Request to test a webhook endpoint."""

    event_type: str = Field(..., description="Event type to test")

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if v not in WEBHOOK_EVENT_TYPES:
            raise ValueError(f"Invalid event type. Valid types: {WEBHOOK_EVENT_TYPES}")
        return v


class WebhookTestResponse(BaseModel):
    """Response for a webhook test."""

    success: bool
    status_code: int | None = None
    error_message: str | None = None
    duration_ms: int | None = None
    payload: str
