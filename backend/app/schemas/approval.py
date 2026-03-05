from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import ApprovalType


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

    model_config = {"from_attributes": True}
