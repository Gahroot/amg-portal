"""Access audit endpoints for quarterly access review and compliance."""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, require_compliance, require_internal
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.models.access_audit import AccessAudit, AccessAuditFinding
from app.models.user import User
from app.schemas.access_audit import (
    AccessAuditFindingListResponse,
    AccessAuditFindingResponse,
    AccessAuditListResponse,
    AccessAuditResponse,
    AccessAuditStatistics,
    AcknowledgeFindingRequest,
    CreateAccessAuditFindingRequest,
    CreateAccessAuditRequest,
    RemediateFindingRequest,
    UpdateAccessAuditFindingRequest,
    UpdateAccessAuditRequest,
    WaiveFindingRequest,
)
from app.services.access_audit_service import access_audit_service

router = APIRouter()


def _enrich_audit(audit: AccessAudit) -> dict:
    """Add computed fields to audit response."""
    data = {
        "id": audit.id,
        "audit_period": audit.audit_period,
        "quarter": audit.quarter,
        "year": audit.year,
        "status": audit.status,
        "auditor_id": audit.auditor_id,
        "started_at": audit.started_at,
        "completed_at": audit.completed_at,
        "users_reviewed": audit.users_reviewed,
        "permissions_verified": audit.permissions_verified,
        "anomalies_found": audit.anomalies_found,
        "summary": audit.summary,
        "recommendations": audit.recommendations,
        "created_at": audit.created_at,
        "updated_at": audit.updated_at,
        "auditor_name": audit.auditor.full_name if audit.auditor else None,
        "findings": [_enrich_finding(f) for f in (audit.findings or [])],
    }
    return data


def _enrich_finding(finding: AccessAuditFinding) -> dict:
    """Add computed fields to finding response."""
    data = {
        "id": finding.id,
        "audit_id": finding.audit_id,
        "user_id": finding.user_id,
        "finding_type": finding.finding_type,
        "severity": finding.severity,
        "description": finding.description,
        "recommendation": finding.recommendation,
        "status": finding.status,
        "remediation_notes": finding.remediation_notes,
        "remediated_by": finding.remediated_by,
        "remediated_at": finding.remediated_at,
        "acknowledged_by": finding.acknowledged_by,
        "acknowledged_at": finding.acknowledged_at,
        "waived_reason": finding.waived_reason,
        "waived_by": finding.waived_by,
        "waived_at": finding.waived_at,
        "created_at": finding.created_at,
        "updated_at": finding.updated_at,
        "user_email": finding.user.email if finding.user else None,
        "user_name": finding.user.full_name if finding.user else None,
        "remediator_name": finding.remediator.full_name if finding.remediator else None,
    }
    return data


@router.get("/", response_model=AccessAuditListResponse)
async def list_access_audits(
    db: DB,
    current_user: User = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = Query(None),
    year: int | None = Query(None),
) -> AccessAuditListResponse:
    """List all access audits with optional filters."""
    base = select(AccessAudit).options(
        selectinload(AccessAudit.auditor),
        selectinload(AccessAudit.findings),
    )

    if status:
        base = base.where(AccessAudit.status == status)
    if year:
        base = base.where(AccessAudit.year == year)

    count_query = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_query)).scalar_one()

    result = await db.execute(
        base.order_by(AccessAudit.year.desc(), AccessAudit.quarter.desc())
        .offset(skip)
        .limit(limit)
    )
    audits = result.scalars().all()

    return AccessAuditListResponse(
        audits=[AccessAuditResponse(**_enrich_audit(a)) for a in audits],
        total=total,
    )


@router.get("/statistics", response_model=AccessAuditStatistics)
async def get_access_audit_statistics(
    db: DB,
    current_user: User = Depends(require_internal),
) -> AccessAuditStatistics:
    """Get access audit statistics."""
    stats = await access_audit_service.get_audit_statistics(db)
    return AccessAuditStatistics(**stats)


@router.get("/current", response_model=AccessAuditResponse | None)
async def get_current_quarter_audit(
    db: DB,
    current_user: User = Depends(require_internal),
) -> AccessAuditResponse | None:
    """Get the audit for the current quarter."""
    audit = await access_audit_service.get_current_quarter_audit(db)
    if not audit:
        return None
    return AccessAuditResponse(**_enrich_audit(audit))


@router.post("/", response_model=AccessAuditResponse, status_code=status.HTTP_201_CREATED)
async def create_access_audit(
    data: CreateAccessAuditRequest,
    db: DB,
    current_user: User = Depends(require_compliance),
) -> AccessAuditResponse:
    """Create a new access audit."""
    # Check for existing audit for same quarter/year
    existing = await db.execute(
        select(AccessAudit).where(
            AccessAudit.quarter == data.quarter,
            AccessAudit.year == data.year,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException("Audit already exists for this quarter and year")

    audit = await access_audit_service.create_quarterly_audit(
        db,
        quarter=data.quarter,
        year=data.year,
        auditor_id=data.auditor_id or current_user.id,
    )
    audit = await access_audit_service.get_audit_with_findings(db, audit.id)
    return AccessAuditResponse(**_enrich_audit(audit))


@router.get("/findings", response_model=AccessAuditFindingListResponse)
async def list_all_findings(
    db: DB,
    current_user: User = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = Query(None),
    severity: str | None = Query(None),
    finding_type: str | None = Query(None),
) -> AccessAuditFindingListResponse:
    """List all findings across audits with optional filters."""
    findings, total = await access_audit_service.list_findings(
        db,
        status=status,
        severity=severity,
        finding_type=finding_type,
        skip=skip,
        limit=limit,
    )
    return AccessAuditFindingListResponse(
        findings=[AccessAuditFindingResponse(**_enrich_finding(f)) for f in findings],
        total=total,
    )


@router.get("/{audit_id}", response_model=AccessAuditResponse)
async def get_access_audit(
    audit_id: uuid.UUID,
    db: DB,
    current_user: User = Depends(require_internal),
) -> AccessAuditResponse:
    """Get a single access audit by ID with all findings."""
    audit = await access_audit_service.get_audit_with_findings(db, audit_id)
    if not audit:
        raise NotFoundException("Access audit not found")
    return AccessAuditResponse(**_enrich_audit(audit))


@router.put("/{audit_id}", response_model=AccessAuditResponse)
async def update_access_audit(
    audit_id: uuid.UUID,
    data: UpdateAccessAuditRequest,
    db: DB,
    current_user: User = Depends(require_compliance),
) -> AccessAuditResponse:
    """Update an access audit."""
    audit = await access_audit_service.update(db, audit_id, data)
    if not audit:
        raise NotFoundException("Access audit not found")
    audit = await access_audit_service.get_audit_with_findings(db, audit.id)
    return AccessAuditResponse(**_enrich_audit(audit))


@router.post("/{audit_id}/scan", response_model=AccessAuditResponse)
async def scan_dormant_accounts(
    audit_id: uuid.UUID,
    db: DB,
    current_user: User = Depends(require_compliance),
    days_threshold: int = Query(90, ge=1, le=365, description="Inactivity threshold in days"),
) -> AccessAuditResponse:
    """Scan for dormant accounts and add inactive_user findings to the audit.

    Safe to re-run — users already flagged with an open finding are skipped.
    """
    audit = await access_audit_service.get(db, audit_id)
    if not audit:
        raise NotFoundException("Access audit not found")

    if audit.status == "completed":
        raise BadRequestException("Cannot scan a completed audit")

    await access_audit_service.generate_dormant_findings(db, audit_id, days_threshold)
    refreshed = await access_audit_service.get_audit_with_findings(db, audit_id)
    assert refreshed is not None
    return AccessAuditResponse(**_enrich_audit(refreshed))


@router.post("/{audit_id}/complete", response_model=AccessAuditResponse)
async def complete_access_audit(
    audit_id: uuid.UUID,
    db: DB,
    current_user: User = Depends(require_compliance),
) -> AccessAuditResponse:
    """Mark an access audit as complete."""
    audit = await access_audit_service.complete_audit(db, audit_id)
    if not audit:
        raise NotFoundException("Access audit not found")
    audit = await access_audit_service.get_audit_with_findings(db, audit.id)
    return AccessAuditResponse(**_enrich_audit(audit))


@router.post(
    "/{audit_id}/findings",
    response_model=AccessAuditFindingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_audit_finding(
    audit_id: uuid.UUID,
    data: CreateAccessAuditFindingRequest,
    db: DB,
    current_user: User = Depends(require_compliance),
) -> AccessAuditFindingResponse:
    """Add a finding to an access audit."""
    # Verify audit exists
    audit = await access_audit_service.get(db, audit_id)
    if not audit:
        raise NotFoundException("Access audit not found")

    if audit.status == "completed":
        raise BadRequestException("Cannot add findings to a completed audit")

    finding = await access_audit_service.add_finding(db, audit_id, data)

    # Reload with relationships
    result = await db.execute(
        select(AccessAuditFinding)
        .options(
            selectinload(AccessAuditFinding.audit),
            selectinload(AccessAuditFinding.user),
        )
        .where(AccessAuditFinding.id == finding.id)
    )
    finding = result.scalar_one()
    return AccessAuditFindingResponse(**_enrich_finding(finding))


@router.put("/findings/{finding_id}", response_model=AccessAuditFindingResponse)
async def update_audit_finding(
    finding_id: uuid.UUID,
    data: UpdateAccessAuditFindingRequest,
    db: DB,
    current_user: User = Depends(require_compliance),
) -> AccessAuditFindingResponse:
    """Update an audit finding."""
    finding = await access_audit_service.update_finding(db, finding_id, data)
    if not finding:
        raise NotFoundException("Finding not found")

    # Reload with relationships
    result = await db.execute(
        select(AccessAuditFinding)
        .options(
            selectinload(AccessAuditFinding.audit),
            selectinload(AccessAuditFinding.user),
        )
        .where(AccessAuditFinding.id == finding_id)
    )
    finding = result.scalar_one()
    return AccessAuditFindingResponse(**_enrich_finding(finding))


@router.post("/findings/{finding_id}/acknowledge", response_model=AccessAuditFindingResponse)
async def acknowledge_finding(
    finding_id: uuid.UUID,
    data: AcknowledgeFindingRequest,
    db: DB,
    current_user: User = Depends(require_compliance),
) -> AccessAuditFindingResponse:
    """Acknowledge an audit finding."""
    finding = await access_audit_service.acknowledge_finding(db, finding_id, current_user.id)
    if not finding:
        raise NotFoundException("Finding not found")

    # Reload with relationships
    result = await db.execute(
        select(AccessAuditFinding)
        .options(
            selectinload(AccessAuditFinding.audit),
            selectinload(AccessAuditFinding.user),
        )
        .where(AccessAuditFinding.id == finding_id)
    )
    finding = result.scalar_one()
    return AccessAuditFindingResponse(**_enrich_finding(finding))


@router.post("/findings/{finding_id}/remediate", response_model=AccessAuditFindingResponse)
async def remediate_finding(
    finding_id: uuid.UUID,
    data: RemediateFindingRequest,
    db: DB,
    current_user: User = Depends(require_compliance),
) -> AccessAuditFindingResponse:
    """Mark a finding as remediated."""
    finding = await access_audit_service.remediate_finding(
        db, finding_id, current_user.id, data.remediation_notes
    )
    if not finding:
        raise NotFoundException("Finding not found")

    # Reload with relationships
    result = await db.execute(
        select(AccessAuditFinding)
        .options(
            selectinload(AccessAuditFinding.audit),
            selectinload(AccessAuditFinding.user),
        )
        .where(AccessAuditFinding.id == finding_id)
    )
    finding = result.scalar_one()
    return AccessAuditFindingResponse(**_enrich_finding(finding))


@router.post("/findings/{finding_id}/waive", response_model=AccessAuditFindingResponse)
async def waive_finding(
    finding_id: uuid.UUID,
    data: WaiveFindingRequest,
    db: DB,
    current_user: User = Depends(require_compliance),
) -> AccessAuditFindingResponse:
    """Waive a finding with a reason."""
    finding = await access_audit_service.waive_finding(
        db, finding_id, current_user.id, data.waived_reason
    )
    if not finding:
        raise NotFoundException("Finding not found")

    # Reload with relationships
    result = await db.execute(
        select(AccessAuditFinding)
        .options(
            selectinload(AccessAuditFinding.audit),
            selectinload(AccessAuditFinding.user),
        )
        .where(AccessAuditFinding.id == finding_id)
    )
    finding = result.scalar_one()
    return AccessAuditFindingResponse(**_enrich_finding(finding))
