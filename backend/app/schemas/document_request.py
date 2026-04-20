"""Schemas for document request operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str255, Str2000, TextStr


class DocumentRequestCreate(BaseModel):
    client_id: UUID
    document_type: Str50 = "other"
    title: Str255
    description: Str2000 | None = None
    message: TextStr | None = None
    deadline: datetime | None = None
    estimated_completion: datetime | None = None
    rm_notes: Str2000 | None = None


class DocumentRequestUpdate(BaseModel):
    title: Str255 | None = None
    description: Str2000 | None = None
    message: TextStr | None = None
    deadline: datetime | None = None
    estimated_completion: datetime | None = None
    rm_notes: Str2000 | None = None
    status: Str50 | None = None


class DocumentRequestTransition(BaseModel):
    """Request body for staff to transition a request to a new status."""

    status: Str50
    rm_notes: Str2000 | None = None
    estimated_completion: datetime | None = None


class AddClientNoteBody(BaseModel):
    """Request body for client to add a note to a document request."""

    note: Str2000


class DocumentRequestResponse(BaseModel):
    id: UUID
    client_id: UUID
    requested_by: UUID
    document_type: Str50
    title: Str255
    description: Str2000 | None = None
    message: TextStr | None = None
    status: Str50
    deadline: datetime | None = None
    estimated_completion: datetime | None = None
    requested_at: datetime
    in_progress_at: datetime | None = None
    received_at: datetime | None = None
    processing_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    rm_notes: Str2000 | None = None
    client_notes: Str2000 | None = None
    fulfilled_document_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentRequestListResponse(BaseModel):
    requests: list[DocumentRequestResponse]
    total: int


class FulfillDocumentRequestBody(BaseModel):
    document_id: UUID
