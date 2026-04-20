"""Pydantic schemas for client self-service preferences."""

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str10, Str50, Str100, Str255, Str2000


class ClientPreferencesResponse(BaseModel):
    """Response body for client preferences."""

    digest_frequency: Str50 | None = None
    report_format: Str50 | None = None
    notification_channels: dict[str, bool] | None = None


class ClientPreferencesUpdate(BaseModel):
    """Request body for updating client preferences."""

    digest_frequency: Str50 | None = None
    report_format: Str50 | None = None
    notification_channels: dict[str, bool] | None = None


class CommunicationPreferencesResponse(BaseModel):
    """Response body for client communication preferences."""

    model_config = ConfigDict(from_attributes=True)

    preferred_channels: list[str] | None = None
    contact_hours_start: Str10 | None = None
    contact_hours_end: Str10 | None = None
    contact_timezone: Str50 | None = None
    language_preference: Str50 | None = None
    do_not_contact: bool = False
    opt_out_marketing: bool = False
    communication_preference: Str50 | None = None
    special_instructions: Str2000 | None = None


class CommunicationPreferencesUpdate(BaseModel):
    """Request body for updating client communication preferences."""

    preferred_channels: list[str] | None = None
    contact_hours_start: Str10 | None = None
    contact_hours_end: Str10 | None = None
    contact_timezone: Str50 | None = None
    language_preference: Str50 | None = None
    do_not_contact: bool | None = None
    opt_out_marketing: bool | None = None
    communication_preference: Str50 | None = None
    special_instructions: Str2000 | None = None


class EngagementHistoryItem(BaseModel):
    """A single program in the client engagement history."""

    program_id: Str100
    title: Str255
    status: Str50
    start_date: Str50 | None = None
    end_date: Str50 | None = None
    created_at: Str50


class EngagementHistoryResponse(BaseModel):
    """Response body for client engagement history."""

    programs: list[EngagementHistoryItem]
    total: int
