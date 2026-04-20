"""Pydantic schemas for travel booking endpoints."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str100, Str255


class TravelBookingCreate(BaseModel):
    """Schema for creating a new travel booking."""

    booking_ref: str = Field(..., min_length=1, max_length=100)
    vendor: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., max_length=50, pattern="^(flight|hotel|transfer|venue)$")
    departure_at: datetime | None = None
    arrival_at: datetime | None = None
    passengers: list[Str255] | None = None
    details: dict[str, Any] | None = None
    status: str = Field(
        default="confirmed", max_length=50, pattern="^(confirmed|pending|cancelled|completed)$"
    )


class TravelBookingUpdate(BaseModel):
    """Schema for updating a travel booking."""

    booking_ref: str | None = Field(None, min_length=1, max_length=100)
    vendor: str | None = Field(None, min_length=1, max_length=255)
    type: str | None = Field(None, max_length=50, pattern="^(flight|hotel|transfer|venue)$")
    departure_at: datetime | None = None
    arrival_at: datetime | None = None
    passengers: list[Str255] | None = None
    details: dict[str, Any] | None = None
    status: str | None = Field(
        None, max_length=50, pattern="^(confirmed|pending|cancelled|completed)$"
    )


class TravelBookingResponse(BaseModel):
    """Schema for travel booking response."""

    id: UUID
    program_id: UUID
    booking_ref: Str100
    vendor: Str255
    type: Str50
    departure_at: datetime | None
    arrival_at: datetime | None
    passengers: list[Str255] | None
    details: dict[str, Any] | None
    status: Str50
    source: Str50
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
    booking_ref: Str100
    vendor: Str255
    type: str = Field(..., max_length=50, pattern="^(flight|hotel|transfer|venue)$")
    departure_at: datetime | None = None
    arrival_at: datetime | None = None
    passengers: list[Str255] | None = None
    details: dict[str, Any] | None = None
    status: Str50 = "confirmed"
    raw_data: dict[str, Any] | None = None  # Original webhook payload
