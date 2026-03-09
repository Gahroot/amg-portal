"""Pydantic schemas for client self-service preferences."""

from pydantic import BaseModel


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
