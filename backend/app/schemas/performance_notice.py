"""Pydantic schemas for PerformanceNotice."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str255, Str500, TextStr

NoticeType = Literal["sla_breach", "quality_issue", "general_performance"]
NoticeSeverity = Literal["warning", "formal_notice", "final_notice"]
NoticeStatus = Literal["open", "acknowledged"]


class PerformanceNoticeCreate(BaseModel):
    partner_id: UUID
    program_id: UUID | None = None
    notice_type: NoticeType
    severity: NoticeSeverity = "formal_notice"
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1, max_length=10000)
    required_action: TextStr | None = None


class PerformanceNoticeResponse(BaseModel):
    id: UUID
    partner_id: UUID
    program_id: UUID | None
    issued_by: UUID
    notice_type: NoticeType
    severity: NoticeSeverity
    title: Str500
    description: TextStr
    required_action: TextStr | None
    status: NoticeStatus
    acknowledged_at: datetime | None
    program_title: Str255 | None = None
    issuer_name: Str255 | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PerformanceNoticeListResponse(BaseModel):
    notices: list[PerformanceNoticeResponse]
    total: int
    unacknowledged_count: int
