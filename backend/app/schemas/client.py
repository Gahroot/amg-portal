from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import ClientType


class ClientCreate(BaseModel):
    name: str
    client_type: ClientType
    rm_id: UUID
    notes: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    client_type: ClientType | None = None
    rm_id: UUID | None = None
    status: str | None = None
    notes: str | None = None


class ClientResponse(BaseModel):
    id: UUID
    name: str
    client_type: str
    rm_id: UUID
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientListResponse(BaseModel):
    clients: list[ClientResponse]
    total: int


class UpcomingDateItemResponse(BaseModel):
    """A single upcoming birthday or important date for a client."""

    client_id: UUID
    client_name: str
    rm_id: UUID
    date_type: str
    label: str
    days_until: int
    occurs_on: date
    years_since: int | None
