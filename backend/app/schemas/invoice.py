from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str2000

VALID_STATUSES = {"draft", "sent", "paid", "overdue", "cancelled"}


class InvoiceCreate(BaseModel):
    client_id: UUID
    program_id: UUID | None = None
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    status: Str50 = "draft"
    due_date: date | None = None
    notes: Str2000 | None = None


class InvoiceUpdate(BaseModel):
    amount: Decimal | None = Field(None, gt=0, decimal_places=2)
    status: Str50 | None = None
    due_date: date | None = None
    notes: Str2000 | None = None
    program_id: UUID | None = None


class InvoiceResponse(BaseModel):
    id: UUID
    client_id: UUID
    program_id: UUID | None = None
    amount: Decimal
    status: Str50
    due_date: date | None = None
    notes: Str2000 | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvoiceListResponse(BaseModel):
    invoices: list[InvoiceResponse]
    total: int
