"""Pydantic schemas for travel booking endpoints."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TravelBookingCreate(BaseModel):
    """Schema for creating a new travel booking."""

    booking_ref: str = Field(..., min_length=1, max_length=100)
    vendor: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., pattern="^(flight|hotel|transfer|venue)$")
    departure_at: datetime | None = None
    arrival_at: datetime | None = None
    passengers: list[str] | None = None
    details: dict[str, Any] | None = None
    status: str = Field(default="confirmed", pattern="^(confirmed|pending|cancelled|completed)$")


class TravelBookingUpdate(BaseModel):
    """Schema for updating a travel booking."""

    booking_ref: str | None = Field(None, min_length=1, max_length=100)
    vendor: str | None = Field(None, min_length=1, max_length=255)
    type: str | None = Field(None, pattern="^(flight|hotel|transfer|venue)$")
    departure_at: datetime | None = None
    arrival_at: datetime | None = None
    passengers: list[str] | None = None
    details: dict[str, Any] | None = None
    status: str | None = Field(None, pattern="^(confirmed|pending|cancelled|completed)$")


class TravelBookingResponse(BaseModel):
    """Schema for travel booking response."""

    id: UUID
    program_id: UUID
    booking_ref: str
    vendor: str
    type: str
    departure_at: datetime | None
    arrival_at: datetime | None
    passengers: list[str] | None
    details: dict[str, Any] | None
    status: str
    source: str
    raw_data: dict[str, Any] | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TravelBookingListResponse(BaseModel):
    """Schema for list of travel bookings."""

    bookings: list[TravelBookingResponse]
    total: int


class TravelWebhookPayload(BaseModel):
    """Schema for incoming travel webhook payload.

    This is a flexible schema that can handle various travel API formats.
    The service normalizes the data into our standard format.
    """

    program_id: UUID | None = None  # May be provided in webhook or matched by ref
    booking_ref: str
    vendor: str
    type: str = Field(..., pattern="^(flight|hotel|transfer|venue)$")
    departure_at: datetime | None = None
    arrival_at: datetime | None = None
    passengers: list[str] | None = None
    details: dict[str, Any] | None = None
    status: str = "confirmed"
    raw_data: dict[str, Any] | None = None  # Original webhook payload
