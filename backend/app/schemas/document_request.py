"""Schemas for document request operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentRequestCreate(BaseModel):
    client_id: UUID
    document_type: str = "other"
    title: str
    description: str | None = None
    message: str | None = None
    deadline: datetime | None = None
    estimated_completion: datetime | None = None
    rm_notes: str | None = None


class DocumentRequestUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    message: str | None = None
    deadline: datetime | None = None
    estimated_completion: datetime | None = None
    rm_notes: str | None = None
    status: str | None = None


class DocumentRequestTransition(BaseModel):
    """Request body for staff to transition a request to a new status."""

    status: str
    rm_notes: str | None = None
    estimated_completion: datetime | None = None


class AddClientNoteBody(BaseModel):
    """Request body for client to add a note to a document request."""

    note: str


class DocumentRequestResponse(BaseModel):
    id: UUID
    client_id: UUID
    requested_by: UUID
    document_type: str
    title: str
    description: str | None = None
    message: str | None = None
    status: str
    deadline: datetime | None = None
    estimated_completion: datetime | None = None
    requested_at: datetime
    in_progress_at: datetime | None = None
    received_at: datetime | None = None
    processing_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    rm_notes: str | None = None
    client_notes: str | None = None
    fulfilled_document_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentRequestListResponse(BaseModel):
    requests: list[DocumentRequestResponse]
    total: int


class FulfillDocumentRequestBody(BaseModel):
    document_id: UUID
