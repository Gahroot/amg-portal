from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import ClientType
from app.schemas.base import Str50, Str255, Str2000


class ClientCreate(BaseModel):
    name: Str255
    client_type: ClientType
    rm_id: UUID
    notes: Str2000 | None = None


class ClientUpdate(BaseModel):
    name: Str255 | None = None
    client_type: ClientType | None = None
    rm_id: UUID | None = None
    status: Str50 | None = None
    notes: Str2000 | None = None


class ClientResponse(BaseModel):
    id: UUID
    name: Str255
    client_type: Str50
    rm_id: UUID
    status: Str50
    notes: Str2000 | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientListResponse(BaseModel):
    clients: list[ClientResponse]
    total: int


class UpcomingDateItemResponse(BaseModel):
    """A single upcoming birthday or important date for a client."""

    client_id: UUID
    client_name: Str255
    rm_id: UUID
    date_type: Str50
    label: Str255
    days_until: int
    occurs_on: date
    years_since: int | None
