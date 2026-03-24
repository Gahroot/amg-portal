from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DeliverableCreate(BaseModel):
    assignment_id: UUID
    title: str
    deliverable_type: str = "document"
    description: str | None = None
    due_date: date | None = None


class DeliverableUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: date | None = None
    client_visible: bool | None = None


class DeliverableResponse(BaseModel):
    id: UUID
    assignment_id: UUID
    title: str
    deliverable_type: str
    description: str | None = None
    due_date: date | None = None
    file_path: str | None = None
    file_name: str | None = None
    file_size: int | None = None
    submitted_at: datetime | None = None
    submitted_by: UUID | None = None
    status: str
    review_comments: str | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    client_visible: bool
    created_at: datetime
    updated_at: datetime
    download_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DeliverableListResponse(BaseModel):
    deliverables: list[DeliverableResponse]
    total: int


class DeliverableReview(BaseModel):
    status: str  # approved, returned, rejected
    review_comments: str | None = None


# ── Bulk Submit ────────────────────────────────────────────────────────────────


class BulkSubmitItemMeta(BaseModel):
    assignment_id: UUID
    title: str | None = None
    notes: str | None = None


class BulkSubmitFileResult(BaseModel):
    filename: str
    success: bool
    deliverable_id: UUID | None = None
    error: str | None = None


class BulkSubmitResponse(BaseModel):
    results: list[BulkSubmitFileResult]
    total: int
    succeeded: int
    failed: int
