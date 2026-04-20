from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import ApprovalType
from app.schemas.base import Str50, Str255, Str2000, TextStr


class BulkApprovalItem(BaseModel):
    approval_id: UUID
    comments: Str2000 | None = None


class BulkApprovalRequest(BaseModel):
    items: list[BulkApprovalItem]
    action: Literal["approved", "rejected"]
    shared_comments: Str2000 | None = None


class ApprovalRequest(BaseModel):
    program_id: UUID
    approval_type: ApprovalType
    comments: Str2000 | None = None


class ApprovalDecision(BaseModel):
    status: Literal["approved", "rejected"]
    comments: Str2000 | None = None


class ApprovalResponse(BaseModel):
    id: UUID
    program_id: UUID
    approval_type: Str50
    requested_by: UUID
    approved_by: UUID | None
    status: Str50
    comments: Str2000 | None
    requester_name: Str255 = ""
    approver_name: Str255 | None = None
    decided_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Approval Comments ────────────────────────────────────────────────────────


class ApprovalCommentCreate(BaseModel):
    """Request body to post a new comment."""

    content: TextStr
    is_internal: bool = True
    parent_id: UUID | None = None
    mentioned_user_ids: list[UUID] = []


class ApprovalCommentResponse(BaseModel):
    """Single comment in a thread."""

    id: UUID
    entity_type: Str50
    entity_id: UUID
    parent_id: UUID | None
    author_id: UUID
    author_name: Str255
    content: TextStr
    is_internal: bool
    mentioned_user_ids: list[UUID]
    created_at: datetime
    updated_at: datetime
    replies: list["ApprovalCommentResponse"] = []

    model_config = ConfigDict(from_attributes=True)


ApprovalCommentResponse.model_rebuild()


class ApprovalCommentThreadResponse(BaseModel):
    """Full comment thread for an entity."""

    entity_type: Str50
    entity_id: UUID
    total: int
    comments: list[ApprovalCommentResponse]
