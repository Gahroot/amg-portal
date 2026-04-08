"""KYC verification workflow endpoints."""

from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, require_internal
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.client import Client
from app.models.kyc_document import KYCDocument
from app.models.kyc_verification import KYCAlert, KYCCheck, KYCReport, KYCVerification
from app.schemas.kyc_verification import (
    KYCAlertCreate,
    KYCAlertListResponse,
    KYCAlertResponse,
    KYCAlertUpdate,
    KYCCheckCreate,
    KYCCheckListResponse,
    KYCCheckResponse,
    KYCCheckUpdate,
    KYCClientStatus,
    KYCDashboardResponse,
    KYCReportCreate,
    KYCReportListResponse,
    KYCReportResponse,
    KYCVerificationCreate,
    KYCVerificationListResponse,
    KYCVerificationResponse,
    KYCVerificationSummary,
    KYCVerificationUpdate,
)
from app.services.crud_base import paginate

router = APIRouter()


# === Verification Endpoints ===


@router.post("/verifications", response_model=KYCVerificationResponse, status_code=201)
async def create_verification(
    data: KYCVerificationCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCVerificationResponse:
    """Create a new KYC verification."""
    # Verify client exists
    client = await db.get(Client, data.client_id)
    if not client:
        raise NotFoundException("Client not found")

    verification = KYCVerification(
        client_id=data.client_id,
        verification_type=data.verification_type,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(verification)
    await db.commit()
    await db.refresh(verification)
    return KYCVerificationResponse.model_validate(verification)


@router.get("/verifications", response_model=KYCVerificationListResponse)
async def list_verifications(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    status: str | None = Query(None),
    client_id: UUID | None = Query(None),
    risk_level: str | None = Query(None),
    verification_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> KYCVerificationListResponse:
    """List KYC verifications with filtering."""
    query = select(KYCVerification).options(selectinload(KYCVerification.checks))

    conditions = []
    if status:
        conditions.append(KYCVerification.status == status)
    if client_id:
        conditions.append(KYCVerification.client_id == client_id)
    if risk_level:
        conditions.append(KYCVerification.risk_level == risk_level)
    if verification_type:
        conditions.append(KYCVerification.verification_type == verification_type)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(KYCVerification.created_at.desc())
    verifications, total = await paginate(db, query, skip=skip, limit=limit)

    return KYCVerificationListResponse(
        verifications=[
            KYCVerificationResponse.model_validate(v) for v in verifications
        ],
        total=total,
    )


@router.get("/verifications/{verification_id}", response_model=KYCVerificationResponse)
async def get_verification(
    verification_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCVerificationResponse:
    """Get a specific KYC verification."""
    result = await db.execute(
        select(KYCVerification)
        .options(selectinload(KYCVerification.checks))
        .where(KYCVerification.id == verification_id)
    )
    verification = result.scalar_one_or_none()
    if not verification:
        raise NotFoundException("Verification not found")
    return KYCVerificationResponse.model_validate(verification)


@router.put("/verifications/{verification_id}", response_model=KYCVerificationResponse)
async def update_verification(
    verification_id: UUID,
    data: KYCVerificationUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCVerificationResponse:
    """Update a KYC verification."""
    result = await db.execute(
        select(KYCVerification)
        .options(selectinload(KYCVerification.checks))
        .where(KYCVerification.id == verification_id)
    )
    verification = result.scalar_one_or_none()
    if not verification:
        raise NotFoundException("Verification not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(verification, field, value)

    await db.commit()
    await db.refresh(verification)
    return KYCVerificationResponse.model_validate(verification)


@router.post(
    "/verifications/{verification_id}/submit", response_model=KYCVerificationResponse
)
async def submit_verification(
    verification_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCVerificationResponse:
    """Submit a verification for processing."""
    result = await db.execute(
        select(KYCVerification)
        .options(selectinload(KYCVerification.checks))
        .where(KYCVerification.id == verification_id)
    )
    verification = result.scalar_one_or_none()
    if not verification:
        raise NotFoundException("Verification not found")

    if verification.status != "draft":
        raise BadRequestException("Only draft verifications can be submitted")

    verification.status = "pending"  # type: ignore[assignment]
    verification.submitted_at = datetime.now(UTC)  # type: ignore[assignment]

    await db.commit()
    await db.refresh(verification)
    return KYCVerificationResponse.model_validate(verification)


@router.post(
    "/verifications/{verification_id}/complete", response_model=KYCVerificationResponse
)
async def complete_verification(
    verification_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    status: str = Query(..., pattern="^(verified|rejected)$"),
    review_notes: str | None = Query(None),
) -> KYCVerificationResponse:
    """Complete a verification as verified or rejected."""
    result = await db.execute(
        select(KYCVerification)
        .options(selectinload(KYCVerification.checks))
        .where(KYCVerification.id == verification_id)
    )
    verification = result.scalar_one_or_none()
    if not verification:
        raise NotFoundException("Verification not found")

    if verification.status not in ("pending", "in_progress"):
        raise BadRequestException("Verification must be pending or in progress")

    verification.status = status  # type: ignore[assignment]
    verification.completed_at = datetime.now(UTC)  # type: ignore[assignment]
    verification.reviewed_by = current_user.id  # type: ignore[assignment]
    if review_notes:
        verification.review_notes = review_notes  # type: ignore[assignment]

    await db.commit()
    await db.refresh(verification)
    return KYCVerificationResponse.model_validate(verification)


# === Check Endpoints ===


@router.post(
    "/verifications/{verification_id}/checks",
    response_model=KYCCheckResponse,
    status_code=201,
)
async def add_check(
    verification_id: UUID,
    data: KYCCheckCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCCheckResponse:
    """Add a check to a verification."""
    verification = await db.get(KYCVerification, verification_id)
    if not verification:
        raise NotFoundException("Verification not found")

    check = KYCCheck(
        verification_id=verification_id,
        **data.model_dump(),
    )
    db.add(check)

    # Update verification status to in_progress if pending
    if verification.status == "pending":
        verification.status = "in_progress"  # type: ignore[assignment]

    await db.commit()
    await db.refresh(check)
    return KYCCheckResponse.model_validate(check)


@router.put(
    "/verifications/{verification_id}/checks/{check_id}",
    response_model=KYCCheckResponse,
)
async def update_check(
    verification_id: UUID,
    check_id: UUID,
    data: KYCCheckUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCCheckResponse:
    """Update a check result."""
    result = await db.execute(
        select(KYCCheck).where(
            KYCCheck.id == check_id, KYCCheck.verification_id == verification_id
        )
    )
    check = result.scalar_one_or_none()
    if not check:
        raise NotFoundException("Check not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(check, field, value)

    if data.status and data.status != "pending":
        check.checked_at = datetime.now(UTC)  # type: ignore[assignment]
        check.checked_by = current_user.id  # type: ignore[assignment]

    await db.commit()
    await db.refresh(check)
    return KYCCheckResponse.model_validate(check)


@router.get(
    "/verifications/{verification_id}/checks", response_model=KYCCheckListResponse
)
async def list_checks(
    verification_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> KYCCheckListResponse:
    """List checks for a verification."""
    count_query = (
        select(func.count())
        .select_from(KYCCheck)
        .where(KYCCheck.verification_id == verification_id)
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        select(KYCCheck)
        .where(KYCCheck.verification_id == verification_id)
        .offset(skip)
        .limit(limit)
        .order_by(KYCCheck.created_at)
    )
    result = await db.execute(query)
    checks = result.scalars().all()

    return KYCCheckListResponse(
        checks=[KYCCheckResponse.model_validate(c) for c in checks],
        total=total,
    )


# === Client KYC Status ===


@router.get("/clients/{client_id}/status", response_model=KYCClientStatus)
async def get_client_kyc_status(
    client_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCClientStatus:
    """Get a client's overall KYC status."""
    client = await db.get(Client, client_id)
    if not client:
        raise NotFoundException("Client not found")

    # Get latest verification
    verification_result = await db.execute(
        select(KYCVerification)
        .where(KYCVerification.client_id == client_id)
        .order_by(KYCVerification.created_at.desc())
        .limit(1)
    )
    verification = verification_result.scalar_one_or_none()

    # Get document counts
    doc_result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(
                func.cast(KYCDocument.status == "verified", type_=None)  # type: ignore
            ).label("verified"),
        ).where(KYCDocument.client_id == client_id)
    )
    doc_counts = doc_result.one()
    documents_count = doc_counts.total or 0
    documents_verified = doc_counts.verified or 0

    # Get check counts
    pending_checks = 0
    failed_checks = 0
    if verification:
        check_result = await db.execute(
            select(
                func.sum(
                    func.cast(KYCCheck.status == "pending", type_=None)  # type: ignore
                ).label("pending"),
                func.sum(
                    func.cast(KYCCheck.status == "failed", type_=None)  # type: ignore
                ).label("failed"),
            ).where(KYCCheck.verification_id == verification.id)
        )
        check_counts = check_result.one()
        pending_checks = check_counts.pending or 0
        failed_checks = check_counts.failed or 0

    # Calculate days until expiry
    days_until_expiry = None
    if verification and verification.expires_at:
        delta = verification.expires_at - date.today()
        days_until_expiry = delta.days

    return KYCClientStatus(
        client_id=client_id,
        client_name=client.name,
        has_verification=verification is not None,
        verification_status=verification.status if verification else None,
        verification_type=verification.verification_type if verification else None,
        risk_level=verification.risk_level if verification else None,
        verified_at=verification.completed_at if verification else None,
        expires_at=verification.expires_at if verification else None,
        days_until_expiry=days_until_expiry,
        documents_count=documents_count,
        documents_verified=documents_verified,
        pending_checks=pending_checks,
        failed_checks=failed_checks,
    )


# === Alert Endpoints ===


@router.get("/alerts", response_model=KYCAlertListResponse)
async def list_alerts(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    client_id: UUID | None = Query(None),
    alert_type: str | None = Query(None),
    severity: str | None = Query(None),
    is_read: bool | None = Query(None),
    is_resolved: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> KYCAlertListResponse:
    """List KYC alerts with filtering."""
    query = select(KYCAlert)

    conditions = []
    if client_id:
        conditions.append(KYCAlert.client_id == client_id)
    if alert_type:
        conditions.append(KYCAlert.alert_type == alert_type)
    if severity:
        conditions.append(KYCAlert.severity == severity)
    if is_read is not None:
        conditions.append(KYCAlert.is_read == (1 if is_read else 0))
    if is_resolved is not None:
        conditions.append(KYCAlert.is_resolved == (1 if is_resolved else 0))

    if conditions:
        query = query.where(and_(*conditions))

    # Get unread count (uses the same base filters + is_read==0)
    unread_base = select(KYCAlert).where(KYCAlert.is_read == 0)
    if conditions:
        unread_base = unread_base.where(and_(*conditions))
    unread_count_q = select(func.count()).select_from(unread_base.subquery())
    unread_count = (await db.execute(unread_count_q)).scalar_one()

    query = query.order_by(KYCAlert.created_at.desc())
    alerts, total = await paginate(db, query, skip=skip, limit=limit)

    return KYCAlertListResponse(
        alerts=[KYCAlertResponse.model_validate(a) for a in alerts],
        total=total,
        unread_count=unread_count,
    )


@router.post("/alerts", response_model=KYCAlertResponse, status_code=201)
async def create_alert(
    data: KYCAlertCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCAlertResponse:
    """Create a KYC alert manually."""
    alert = KYCAlert(**data.model_dump(), is_read=False, is_resolved=False)
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return KYCAlertResponse.model_validate(alert)


@router.put("/alerts/{alert_id}", response_model=KYCAlertResponse)
async def update_alert(
    alert_id: UUID,
    data: KYCAlertUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCAlertResponse:
    """Update an alert (mark as read or add resolution notes)."""
    alert = await db.get(KYCAlert, alert_id)
    if not alert:
        raise NotFoundException("Alert not found")

    if data.is_read is not None:
        alert.is_read = 1 if data.is_read else 0  # type: ignore[assignment]

    if data.resolution_notes:
        alert.resolution_notes = data.resolution_notes  # type: ignore[assignment]
        alert.is_resolved = 1  # type: ignore[assignment]
        alert.resolved_by = current_user.id  # type: ignore[assignment]
        alert.resolved_at = datetime.now(UTC)  # type: ignore[assignment]

    await db.commit()
    await db.refresh(alert)
    return KYCAlertResponse.model_validate(alert)


@router.post("/alerts/{alert_id}/resolve", response_model=KYCAlertResponse)
async def resolve_alert(
    alert_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    resolution_notes: str | None = Query(None),
) -> KYCAlertResponse:
    """Resolve an alert."""
    alert = await db.get(KYCAlert, alert_id)
    if not alert:
        raise NotFoundException("Alert not found")

    alert.is_resolved = 1  # type: ignore[assignment]
    alert.resolved_by = current_user.id  # type: ignore[assignment]
    alert.resolved_at = datetime.now(UTC)  # type: ignore[assignment]
    if resolution_notes:
        alert.resolution_notes = resolution_notes  # type: ignore[assignment]

    await db.commit()
    await db.refresh(alert)
    return KYCAlertResponse.model_validate(alert)


# === Report Endpoints ===


@router.get("/reports", response_model=KYCReportListResponse)
async def list_reports(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    client_id: UUID | None = Query(None),
    report_type: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> KYCReportListResponse:
    """List KYC reports with filtering."""
    query = select(KYCReport)

    conditions = []
    if client_id:
        conditions.append(KYCReport.client_id == client_id)
    if report_type:
        conditions.append(KYCReport.report_type == report_type)
    if status:
        conditions.append(KYCReport.status == status)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(KYCReport.created_at.desc())
    reports, total = await paginate(db, query, skip=skip, limit=limit)

    return KYCReportListResponse(
        reports=[KYCReportResponse.model_validate(r) for r in reports],
        total=total,
    )


@router.post("/reports", response_model=KYCReportResponse, status_code=201)
async def create_report(
    data: KYCReportCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCReportResponse:
    """Generate a KYC compliance report."""
    report = KYCReport(
        **data.model_dump(),
        status="pending",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # TODO: In production, trigger async report generation task
    # For now, mark as generating
    report.status = "generating"  # type: ignore[assignment]
    report.generated_by = current_user.id  # type: ignore[assignment]
    await db.commit()
    await db.refresh(report)

    return KYCReportResponse.model_validate(report)


@router.get("/reports/{report_id}", response_model=KYCReportResponse)
async def get_report(
    report_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCReportResponse:
    """Get a specific report."""
    report = await db.get(KYCReport, report_id)
    if not report:
        raise NotFoundException("Report not found")
    return KYCReportResponse.model_validate(report)


# === Dashboard Endpoint ===


@router.get("/dashboard", response_model=KYCDashboardResponse)
async def get_dashboard(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> KYCDashboardResponse:
    """Get KYC dashboard summary data."""
    # Get verification counts by status
    status_counts = {}
    for status in ["draft", "pending", "in_progress", "verified", "rejected", "expired"]:
        result = await db.execute(
            select(func.count())
            .select_from(KYCVerification)
            .where(KYCVerification.status == status)
        )
        status_counts[status] = result.scalar() or 0

    # Get risk counts
    high_risk_result = await db.execute(
        select(func.count())
        .select_from(KYCVerification)
        .where(KYCVerification.risk_level == "high")
    )
    high_risk = high_risk_result.scalar() or 0

    critical_risk_result = await db.execute(
        select(func.count())
        .select_from(KYCVerification)
        .where(KYCVerification.risk_level == "critical")
    )
    critical_risk = critical_risk_result.scalar() or 0

    # Get expiring soon count (within 30 days)
    thirty_days = date.today() + timedelta(days=30)
    expiring_soon_result = await db.execute(
        select(func.count())
        .select_from(KYCVerification)
        .where(
            KYCVerification.expires_at.isnot(None),
            KYCVerification.expires_at <= thirty_days,
            KYCVerification.status == "verified",
        )
    )
    expiring_soon = expiring_soon_result.scalar() or 0

    # Get total clients
    total_clients_result = await db.execute(select(func.count()).select_from(Client))
    total_clients = total_clients_result.scalar() or 0

    summary = KYCVerificationSummary(
        total_clients=total_clients,
        draft=status_counts.get("draft", 0),
        pending=status_counts.get("pending", 0),
        in_progress=status_counts.get("in_progress", 0),
        verified=status_counts.get("verified", 0),
        rejected=status_counts.get("rejected", 0),
        expired=status_counts.get("expired", 0),
        expiring_soon=expiring_soon,
        high_risk=high_risk,
        critical_risk=critical_risk,
    )

    # Get recent alerts
    alerts_result = await db.execute(
        select(KYCAlert)
        .where(KYCAlert.is_resolved == 0)
        .order_by(KYCAlert.created_at.desc())
        .limit(10)
    )
    recent_alerts = alerts_result.scalars().all()

    # Get pending verifications
    pending_result = await db.execute(
        select(KYCVerification)
        .options(selectinload(KYCVerification.checks))
        .where(KYCVerification.status.in_(["pending", "in_progress"]))
        .order_by(KYCVerification.submitted_at.asc().nullsfirst())
        .limit(10)
    )
    pending_verifications = pending_result.scalars().all()

    # Get expiring soon clients
    expiring_result = await db.execute(
        select(KYCVerification)
        .where(
            KYCVerification.expires_at.isnot(None),
            KYCVerification.expires_at <= thirty_days,
            KYCVerification.status == "verified",
        )
        .order_by(KYCVerification.expires_at.asc())
        .limit(10)
    )
    expiring_verifications = expiring_result.scalars().all()

    expiring_client_statuses = []
    for v in expiring_verifications:
        client = await db.get(Client, v.client_id)
        if client:
            days = (v.expires_at - date.today()).days if v.expires_at else None
            expiring_client_statuses.append(
                KYCClientStatus(
                    client_id=v.client_id,
                    client_name=client.name,
                    has_verification=True,
                    verification_status=v.status,
                    verification_type=v.verification_type,
                    risk_level=v.risk_level,
                    verified_at=v.completed_at,
                    expires_at=v.expires_at,
                    days_until_expiry=days,
                    documents_count=0,
                    documents_verified=0,
                    pending_checks=0,
                    failed_checks=0,
                )
            )

    return KYCDashboardResponse(
        summary=summary,
        recent_alerts=[KYCAlertResponse.model_validate(a) for a in recent_alerts],
        pending_verifications=[
            KYCVerificationResponse.model_validate(v) for v in pending_verifications
        ],
        expiring_soon=expiring_client_statuses,
    )
