"""Pydantic schemas for access audit endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str100, Str255, Str2000


class AccessAuditFindingResponse(BaseModel):
    """Full access audit finding response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    audit_id: uuid.UUID
    user_id: uuid.UUID | None = None
    finding_type: Str100
    severity: Str50
    description: Str2000
    recommendation: Str2000 | None = None
    status: Str50
    remediation_notes: Str2000 | None = None
    remediated_by: uuid.UUID | None = None
    remediated_at: datetime | None = None
    acknowledged_by: uuid.UUID | None = None
    acknowledged_at: datetime | None = None
    waived_reason: Str2000 | None = None
    waived_by: uuid.UUID | None = None
    waived_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    # Computed fields
    user_email: Str255 | None = None
    user_name: Str255 | None = None
    remediator_name: Str255 | None = None


class AccessAuditResponse(BaseModel):
    """Full access audit response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    audit_period: Str50
    quarter: int
    year: int
    status: Str50
    auditor_id: uuid.UUID | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    users_reviewed: int
    permissions_verified: int
    anomalies_found: int
    summary: Str2000 | None = None
    recommendations: Str2000 | None = None
    created_at: datetime
    updated_at: datetime
    # Nested
    findings: list[AccessAuditFindingResponse] = []
    # Computed fields
    auditor_name: Str255 | None = None


class AccessAuditListResponse(BaseModel):
    """Paginated list of access audits."""

    audits: list[AccessAuditResponse]
    total: int


class AccessAuditFindingListResponse(BaseModel):
    """Paginated list of access audit findings."""

    findings: list[AccessAuditFindingResponse]
    total: int


class CreateAccessAuditRequest(BaseModel):
    """Request to create a new access audit."""

    quarter: int = Field(..., ge=1, le=4)
    year: int = Field(..., ge=2020, le=2100)
    auditor_id: uuid.UUID | None = None
    summary: Str2000 | None = None


class UpdateAccessAuditRequest(BaseModel):
    """Request to update an access audit."""

    status: Str50 | None = None
    auditor_id: uuid.UUID | None = None
    users_reviewed: int | None = None
    permissions_verified: int | None = None
    anomalies_found: int | None = None
    summary: Str2000 | None = None
    recommendations: Str2000 | None = None


class CreateAccessAuditFindingRequest(BaseModel):
    """Request to create a new audit finding."""

    user_id: uuid.UUID | None = None
    finding_type: Str100
    severity: Str50 = Field(default="medium")
    description: Str2000
    recommendation: Str2000 | None = None


class UpdateAccessAuditFindingRequest(BaseModel):
    """Request to update an audit finding."""

    finding_type: Str100 | None = None
    severity: Str50 | None = None
    description: Str2000 | None = None
    recommendation: Str2000 | None = None
    status: Str50 | None = None
    remediation_notes: Str2000 | None = None


class RemediateFindingRequest(BaseModel):
    """Request to remediate a finding."""

    remediation_notes: Str2000 | None = None


class AcknowledgeFindingRequest(BaseModel):
    """Request to acknowledge a finding."""

    notes: Str2000 | None = None


class WaiveFindingRequest(BaseModel):
    """Request to waive a finding."""

    waived_reason: Str2000


class AccessAuditStatistics(BaseModel):
    """Statistics for access audits."""

    total: int = 0
    draft: int = 0
    in_review: int = 0
    completed: int = 0
    total_findings: int = 0
    open_findings: int = 0
    remediated_findings: int = 0
    waived_findings: int = 0
    by_severity: dict[str, int] = Field(default_factory=dict)
    by_quarter: dict[str, int] = Field(default_factory=dict)
