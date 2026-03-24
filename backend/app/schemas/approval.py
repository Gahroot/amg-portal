from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import ApprovalType


class BulkApprovalItem(BaseModel):
    approval_id: UUID
    comments: str | None = None


class BulkApprovalRequest(BaseModel):
    items: list[BulkApprovalItem]
    action: Literal["approved", "rejected"]
    shared_comments: str | None = None


class ApprovalRequest(BaseModel):
    program_id: UUID
    approval_type: ApprovalType
    comments: str | None = None


class ApprovalDecision(BaseModel):
    status: Literal["approved", "rejected"]
    comments: str | None = None


class ApprovalResponse(BaseModel):
    id: UUID
    program_id: UUID
    approval_type: str
    requested_by: UUID
    approved_by: UUID | None
    status: str
    comments: str | None
    requester_name: str = ""
    approver_name: str | None = None
    decided_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Approval Comments ────────────────────────────────────────────────────────


class ApprovalCommentCreate(BaseModel):
    """Request body to post a new comment."""

    content: str
    is_internal: bool = True
    parent_id: UUID | None = None
    mentioned_user_ids: list[UUID] = []


class ApprovalCommentResponse(BaseModel):
    """Single comment in a thread."""

    id: UUID
    entity_type: str
    entity_id: UUID
    parent_id: UUID | None
    author_id: UUID
    author_name: str
    content: str
    is_internal: bool
    mentioned_user_ids: list[UUID]
    created_at: datetime
    updated_at: datetime
    replies: list["ApprovalCommentResponse"] = []

    model_config = ConfigDict(from_attributes=True)


ApprovalCommentResponse.model_rebuild()


class ApprovalCommentThreadResponse(BaseModel):
    """Full comment thread for an entity."""

    entity_type: str
    entity_id: UUID
    total: int
    comments: list[ApprovalCommentResponse]
