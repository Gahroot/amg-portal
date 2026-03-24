"""Pydantic schemas for client self-service preferences."""

from pydantic import BaseModel, ConfigDict


class ClientPreferencesResponse(BaseModel):
    """Response body for client preferences."""

    digest_frequency: str | None = None
    report_format: str | None = None
    notification_channels: dict[str, bool] | None = None


class ClientPreferencesUpdate(BaseModel):
    """Request body for updating client preferences."""

    digest_frequency: str | None = None
    report_format: str | None = None
    notification_channels: dict[str, bool] | None = None


class CommunicationPreferencesResponse(BaseModel):
    """Response body for client communication preferences."""

    model_config = ConfigDict(from_attributes=True)

    preferred_channels: list[str] | None = None
    contact_hours_start: str | None = None
    contact_hours_end: str | None = None
    contact_timezone: str | None = None
    language_preference: str | None = None
    do_not_contact: bool = False
    opt_out_marketing: bool = False
    communication_preference: str | None = None
    special_instructions: str | None = None


class CommunicationPreferencesUpdate(BaseModel):
    """Request body for updating client communication preferences."""

    preferred_channels: list[str] | None = None
    contact_hours_start: str | None = None
    contact_hours_end: str | None = None
    contact_timezone: str | None = None
    language_preference: str | None = None
    do_not_contact: bool | None = None
    opt_out_marketing: bool | None = None
    communication_preference: str | None = None
    special_instructions: str | None = None


class EngagementHistoryItem(BaseModel):
    """A single program in the client engagement history."""

    program_id: str
    title: str
    status: str
    start_date: str | None = None
    end_date: str | None = None
    created_at: str


class EngagementHistoryResponse(BaseModel):
    """Response body for client engagement history."""

    programs: list[EngagementHistoryItem]
    total: int
