"""Pydantic schemas for access audit endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AccessAuditFindingResponse(BaseModel):
    """Full access audit finding response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    audit_id: uuid.UUID
    user_id: uuid.UUID | None = None
    finding_type: str
    severity: str
    description: str
    recommendation: str | None = None
    status: str
    remediation_notes: str | None = None
    remediated_by: uuid.UUID | None = None
    remediated_at: datetime | None = None
    acknowledged_by: uuid.UUID | None = None
    acknowledged_at: datetime | None = None
    waived_reason: str | None = None
    waived_by: uuid.UUID | None = None
    waived_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    # Computed fields
    user_email: str | None = None
    user_name: str | None = None
    remediator_name: str | None = None


class AccessAuditResponse(BaseModel):
    """Full access audit response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    audit_period: str
    quarter: int
    year: int
    status: str
    auditor_id: uuid.UUID | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    users_reviewed: int
    permissions_verified: int
    anomalies_found: int
    summary: str | None = None
    recommendations: str | None = None
    created_at: datetime
    updated_at: datetime
    # Nested
    findings: list[AccessAuditFindingResponse] = []
    # Computed fields
    auditor_name: str | None = None


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
    summary: str | None = None


class UpdateAccessAuditRequest(BaseModel):
    """Request to update an access audit."""

    status: str | None = None
    auditor_id: uuid.UUID | None = None
    users_reviewed: int | None = None
    permissions_verified: int | None = None
    anomalies_found: int | None = None
    summary: str | None = None
    recommendations: str | None = None


class CreateAccessAuditFindingRequest(BaseModel):
    """Request to create a new audit finding."""

    user_id: uuid.UUID | None = None
    finding_type: str
    severity: str = Field(default="medium")
    description: str
    recommendation: str | None = None


class UpdateAccessAuditFindingRequest(BaseModel):
    """Request to update an audit finding."""

    finding_type: str | None = None
    severity: str | None = None
    description: str | None = None
    recommendation: str | None = None
    status: str | None = None
    remediation_notes: str | None = None


class RemediateFindingRequest(BaseModel):
    """Request to remediate a finding."""

    remediation_notes: str | None = None


class AcknowledgeFindingRequest(BaseModel):
    """Request to acknowledge a finding."""

    notes: str | None = None


class WaiveFindingRequest(BaseModel):
    """Request to waive a finding."""

    waived_reason: str


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
