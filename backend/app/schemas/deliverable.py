from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str255, Str500, Str2000


class DeliverableCreate(BaseModel):
    assignment_id: UUID
    title: Str255
    deliverable_type: Str50 = "document"
    description: Str2000 | None = None
    due_date: date | None = None


class DeliverableUpdate(BaseModel):
    title: Str255 | None = None
    description: Str2000 | None = None
    due_date: date | None = None
    client_visible: bool | None = None


class DeliverableResponse(BaseModel):
    id: UUID
    assignment_id: UUID
    title: Str255
    deliverable_type: Str50
    description: Str2000 | None = None
    due_date: date | None = None
    file_path: Str500 | None = None
    file_name: Str255 | None = None
    file_size: int | None = None
    submitted_at: datetime | None = None
    submitted_by: UUID | None = None
    status: Str50
    review_comments: Str2000 | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    client_visible: bool
    created_at: datetime
    updated_at: datetime
    download_url: Str2000 | None = None

    model_config = ConfigDict(from_attributes=True)


class DeliverableListResponse(BaseModel):
    deliverables: list[DeliverableResponse]
    total: int


class DeliverableReview(BaseModel):
    status: Str50  # approved, returned, rejected
    review_comments: Str2000 | None = None


# ── Staff Attach ──────────────────────────────────────────────────────────────


class DeliverableAttachDocument(BaseModel):
    document_id: UUID = Field(..., description="ID of an existing document to attach")


# ── Bulk Submit ────────────────────────────────────────────────────────────────


class BulkSubmitItemMeta(BaseModel):
    assignment_id: UUID
    title: Str255 | None = None
    notes: Str2000 | None = None


class BulkSubmitFileResult(BaseModel):
    filename: Str255
    success: bool
    deliverable_id: UUID | None = None
    error: Str500 | None = None


class BulkSubmitResponse(BaseModel):
    results: list[BulkSubmitFileResult]
    total: int
    succeeded: int
    failed: int
