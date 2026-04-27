"""Partner directory management endpoints (internal views)."""

from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import and_, or_, select

from app.api.deps import DB, CurrentUser, require_admin, require_internal, require_rm_or_above
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.enums import AuditAction, PartnerStatus, UserRole
from app.models.partner import PartnerBlockedDate, PartnerProfile
from app.models.partner_threshold import PartnerThreshold
from app.models.user import User
from app.schemas.partner import (
    AllPartnersCapacitySummaryResponse,
    BlockedDateCreate,
    BlockedDateResponse,
    CapacityDayEntry,
    PartnerCapacityHeatmapResponse,
    PartnerCapacitySummaryEntry,
    PartnerComparisonResponse,
    PartnerDuplicateCheckRequest,
    PartnerDuplicateMatchResponse,
    PartnerProfileCreate,
    PartnerProfileListResponse,
    PartnerProfileResponse,
    PartnerProfileUpdate,
    PartnerProvisionRequest,
    RefreshDuePartnerListResponse,
    RefreshDuePartnerResponse,
)
from app.schemas.partner_threshold import (
    PartnerThresholdCreate,
    PartnerThresholdResponse,
)
from app.services.audit_service import log_action
from app.services.crud_base import paginate
from app.services.duplicate_detection_service import check_partner_duplicates
from app.services.partner_capacity_service import (
    get_all_partners_capacity_summary,
    get_capacity_heatmap,
)
from app.services.partner_comparison_service import get_partner_comparison_data
from app.services.partner_trends_service import get_partner_trends
from app.services.storage import storage_service

router = APIRouter()


@router.post("/", response_model=PartnerProfileResponse, status_code=201)
async def create_partner(
    data: PartnerProfileCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
) -> Any:
    partner = PartnerProfile(
        firm_name=data.firm_name,
        contact_name=data.contact_name,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        capabilities=data.capabilities,
        geographies=data.geographies,
        notes=data.notes,
        status="pending",
        created_by=current_user.id,
    )
    db.add(partner)
    await db.commit()
    await db.refresh(partner)
    return partner


@router.post(
    "/check-duplicates",
    response_model=list[PartnerDuplicateMatchResponse],
    dependencies=[Depends(require_rm_or_above)],
)
async def check_partner_duplicates_endpoint(
    data: PartnerDuplicateCheckRequest,
    db: DB,
) -> list[PartnerDuplicateMatchResponse]:
    """Check for potential duplicate partner profiles.

    Accepts partial partner data (firm_name, contact_name, contact_email, contact_phone)
    and returns a list of existing profiles that may be duplicates, with similarity
    scores and match reasons. Intended to be called during partner creation on field blur.
    """
    matches = await check_partner_duplicates(
        db,
        firm_name=data.firm_name,
        contact_name=data.contact_name,
        contact_email=str(data.contact_email) if data.contact_email else None,
        contact_phone=data.contact_phone,
        exclude_id=data.exclude_id,
    )
    return [
        PartnerDuplicateMatchResponse(
            partner_id=m.partner_id,
            firm_name=m.firm_name,
            contact_name=m.contact_name,
            contact_email=m.contact_email,
            contact_phone=m.contact_phone,
            similarity_score=m.similarity_score,
            match_reasons=m.match_reasons,
        )
        for m in matches
    ]


@router.get("/", response_model=PartnerProfileListResponse)
async def list_partners(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    capability: str | None = None,
    geography: str | None = None,
    availability: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> Any:
    query = select(PartnerProfile)

    if status:
        query = query.where(PartnerProfile.status == status)
    if availability:
        query = query.where(PartnerProfile.availability_status == availability)
    if search:
        query = query.where(
            PartnerProfile.firm_name.ilike(f"%{search}%")
            | PartnerProfile.contact_name.ilike(f"%{search}%")
        )
    if capability:
        query = query.where(PartnerProfile.capabilities.op("@>")(f'["{capability}"]'))
    if geography:
        query = query.where(PartnerProfile.geographies.op("@>")(f'["{geography}"]'))

    query = query.order_by(PartnerProfile.created_at.desc())
    profiles, total = await paginate(db, query, skip=skip, limit=limit)

    return PartnerProfileListResponse(profiles=profiles, total=total)


# ── Threshold Endpoints ──────────────────────────────────────────────────────


@router.get("/thresholds/global", response_model=PartnerThresholdResponse)
async def get_global_threshold(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> PartnerThresholdResponse:
    """Return the global default partner alert threshold (partner_id IS NULL)."""
    result = await db.execute(select(PartnerThreshold).where(PartnerThreshold.partner_id.is_(None)))
    threshold = result.scalar_one_or_none()
    if threshold is None:
        raise NotFoundException("Global threshold not configured")
    return PartnerThresholdResponse.model_validate(threshold)


@router.post(
    "/thresholds/global",
    response_model=PartnerThresholdResponse,
    status_code=200,
)
async def upsert_global_threshold(
    data: PartnerThresholdCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> PartnerThresholdResponse:
    """Create or update the global default partner alert threshold."""
    result = await db.execute(select(PartnerThreshold).where(PartnerThreshold.partner_id.is_(None)))
    threshold = result.scalar_one_or_none()

    if threshold is None:
        threshold = PartnerThreshold(
            partner_id=None,
            sla_compliance_threshold=data.sla_compliance_threshold,
            quality_score_threshold=data.quality_score_threshold,
            overall_score_threshold=data.overall_score_threshold,
            trend_window_weeks=data.trend_window_weeks,
            created_by=current_user.id,
        )
        db.add(threshold)
    else:
        threshold.sla_compliance_threshold = data.sla_compliance_threshold
        threshold.quality_score_threshold = data.quality_score_threshold
        threshold.overall_score_threshold = data.overall_score_threshold
        threshold.trend_window_weeks = data.trend_window_weeks

    await db.commit()
    await db.refresh(threshold)
    return PartnerThresholdResponse.model_validate(threshold)


@router.get("/compare", response_model=PartnerComparisonResponse)
async def compare_partners(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    ids: str = Query(..., description="Comma-separated list of 2–4 partner IDs"),
) -> PartnerComparisonResponse:
    """Return side-by-side comparison data for 2–4 partners.

    Aggregates capabilities, ratings, SLA compliance, capacity, and recent
    performance trends for each partner so the caller can render a comparison UI.
    """
    raw_ids = [s.strip() for s in ids.split(",") if s.strip()]
    if len(raw_ids) < 2:
        raise BadRequestException("Provide at least 2 partner IDs to compare")
    if len(raw_ids) > 4:
        raise BadRequestException("Cannot compare more than 4 partners at once")

    try:
        partner_uuids = [UUID(pid) for pid in raw_ids]
    except ValueError as exc:
        raise BadRequestException("One or more partner IDs are not valid UUIDs") from exc

    return await get_partner_comparison_data(db, partner_uuids)


@router.get("/refresh-due", response_model=RefreshDuePartnerListResponse)
async def list_refresh_due_partners(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    include_due_soon: bool = Query(True, description="Include partners due within 30 days"),
) -> RefreshDuePartnerListResponse:
    """List active partners whose annual capability refresh is overdue or due soon.

    Includes:
    - Partners whose refresh_due_at has passed (overdue)
    - Partners who have never refreshed and were created >= 365 days ago
    - Partners due within 30 days (when include_due_soon=True)
    """
    now = datetime.now(UTC)
    threshold = now + timedelta(days=30) if include_due_soon else now
    cutoff_date = now - timedelta(days=365)

    result = await db.execute(
        select(PartnerProfile)
        .where(
            PartnerProfile.status == "active",
            or_(
                # Has refresh_due_at and it's within the threshold window
                PartnerProfile.refresh_due_at <= threshold,
                # Never refreshed and created >= 365 days ago
                (PartnerProfile.refresh_due_at.is_(None))
                & (PartnerProfile.created_at <= cutoff_date),
            ),
        )
        .order_by(PartnerProfile.refresh_due_at.asc().nulls_first())
    )
    partners = result.scalars().all()

    partner_responses: list[RefreshDuePartnerResponse] = []
    for p in partners:
        p_refresh_due: datetime | None = p.refresh_due_at
        if p_refresh_due and p_refresh_due.tzinfo is None:
            p_refresh_due = p_refresh_due.replace(tzinfo=UTC)

        p_overdue: bool = p_refresh_due is None or p_refresh_due < now
        p_days: int | None = (
            int((p_refresh_due - now).days) if (p_refresh_due and not p_overdue) else None
        )
        p_id: UUID = p.id
        p_firm_name: str = p.firm_name
        p_contact_name: str = p.contact_name
        p_contact_email: str = p.contact_email
        p_status: str = p.status
        p_last_refreshed: datetime | None = p.last_refreshed_at

        partner_responses.append(
            RefreshDuePartnerResponse(
                id=p_id,
                firm_name=p_firm_name,
                contact_name=p_contact_name,
                contact_email=p_contact_email,
                status=p_status,
                last_refreshed_at=p_last_refreshed,
                refresh_due_at=p_refresh_due,
                is_overdue=p_overdue,
                days_until_due=p_days,
            )
        )

    return RefreshDuePartnerListResponse(partners=partner_responses, total=len(partner_responses))


@router.get("/{partner_id}", response_model=PartnerProfileResponse)
async def get_partner(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> Any:
    result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise NotFoundException("Partner not found")
    return partner


@router.patch("/{partner_id}", response_model=PartnerProfileResponse)
async def update_partner(
    partner_id: UUID,
    data: PartnerProfileUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
) -> Any:
    result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise NotFoundException("Partner not found")

    update_data = data.model_dump(exclude_unset=True)
    before_status = partner.status
    for field, value in update_data.items():
        setattr(partner, field, value)

    await db.commit()
    await db.refresh(partner)

    if "status" in update_data and partner.status != before_status:
        await log_action(
            db,
            action=AuditAction.partner_status_changed,
            entity_type="partner_profile",
            entity_id=str(partner.id),
            user=current_user,
            before_state={"status": PartnerStatus(before_status).value},
            after_state={"status": partner.status.value},
        )
        await db.commit()

    return partner


@router.post("/{partner_id}/provision", response_model=PartnerProfileResponse)
async def provision_partner(
    partner_id: UUID,
    data: PartnerProvisionRequest,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_admin),
) -> Any:
    result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise NotFoundException("Partner not found")
    if partner.user_id:
        raise BadRequestException("Partner already has a user account")

    import secrets

    from app.core.security import hash_password

    password = data.password or secrets.token_urlsafe(16)

    user = User(
        email=partner.contact_email,
        hashed_password=hash_password(password),
        full_name=partner.contact_name,
        role=UserRole.partner,
        status="active",
    )
    db.add(user)
    await db.flush()

    partner.user_id = user.id
    partner.status = PartnerStatus.active
    await db.commit()
    await db.refresh(partner)
    return partner


@router.post("/{partner_id}/compliance-doc", response_model=PartnerProfileResponse)
async def upload_compliance_doc(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    _: None = Depends(require_rm_or_above),
) -> Any:
    result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise NotFoundException("Partner not found")

    await storage_service.validate_file(file)
    object_path, _size = await storage_service.upload_file(
        file, f"partners/{partner_id}/compliance"
    )
    partner.compliance_doc_url = object_path
    await db.commit()
    await db.refresh(partner)
    return partner


@router.get("/{partner_id}/trends")
async def get_partner_trends_endpoint(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    days: int = Query(90, ge=7, le=365, description="Number of days of history to return"),
) -> dict[str, Any]:
    """Return weekly performance trend data for a partner.

    Includes SLA compliance %, quality scores, and assignment completion
    across the specified date range.
    """
    import uuid as _uuid

    trends = await get_partner_trends(db, _uuid.UUID(str(partner_id)), days=days)
    if trends is None:
        raise NotFoundException("Partner not found")

    return {
        "partner_id": trends.partner_id,
        "firm_name": trends.firm_name,
        "days": trends.days,
        "summary": trends.summary,
        "data_points": [
            {
                "week_start": dp.week_start,
                "sla_compliance_pct": dp.sla_compliance_pct,
                "avg_quality": dp.avg_quality,
                "avg_timeliness": dp.avg_timeliness,
                "avg_communication": dp.avg_communication,
                "avg_overall": dp.avg_overall,
                "completion_rate": dp.completion_rate,
                "sla_total": dp.sla_total,
                "sla_breached": dp.sla_breached,
                "ratings_count": dp.ratings_count,
                "assignments_completed": dp.assignments_completed,
            }
            for dp in trends.data_points
        ],
        "annotations": [
            {
                "date": ann.date,
                "event_type": ann.event_type,
                "label": ann.label,
                "severity": ann.severity,
            }
            for ann in trends.annotations
        ],
    }


# ── Capacity / Heatmap Endpoints ──────────────────────────────────────────────


@router.get("/capacity/summary", response_model=AllPartnersCapacitySummaryResponse)
async def get_all_partners_capacity(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    target_date: date = Query(default=None, description="ISO date (defaults to today)"),
) -> AllPartnersCapacitySummaryResponse:
    """Return capacity status for all active partners on a given date."""
    if target_date is None:
        target_date = date.today()

    summaries = await get_all_partners_capacity_summary(db, target_date)
    return AllPartnersCapacitySummaryResponse(
        target_date=target_date,
        partners=[PartnerCapacitySummaryEntry(**s) for s in summaries],
    )


@router.get("/{partner_id}/capacity", response_model=PartnerCapacityHeatmapResponse)
async def get_partner_capacity_heatmap(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    start_date: date = Query(default=None, description="ISO start date (defaults to today)"),
    end_date: date = Query(default=None, description="ISO end date (defaults to +60 days)"),
) -> PartnerCapacityHeatmapResponse:
    """Return per-day capacity heatmap for a partner.

    Accessible by internal staff (any role) and by the partner themselves.
    """
    # Partners can only view their own heatmap
    if current_user.role == "partner":
        result = await db.execute(
            select(PartnerProfile).where(PartnerProfile.user_id == current_user.id)
        )
        my_profile = result.scalar_one_or_none()
        if my_profile is None or str(my_profile.id) != str(partner_id):
            raise NotFoundException("Partner not found")

    if start_date is None:
        start_date = date.today()
    if end_date is None:
        end_date = start_date + timedelta(days=60)

    if end_date < start_date:
        raise BadRequestException("end_date must be >= start_date")
    if (end_date - start_date).days > 365:
        raise BadRequestException("Date range cannot exceed 365 days")

    heatmap = await get_capacity_heatmap(db, partner_id, start_date, end_date)
    if not heatmap:
        raise NotFoundException("Partner not found")

    days = {iso_date: CapacityDayEntry(**entry) for iso_date, entry in heatmap.items()}
    return PartnerCapacityHeatmapResponse(
        partner_id=partner_id,
        start_date=start_date,
        end_date=end_date,
        days=days,
    )


@router.get("/{partner_id}/blocked-dates", response_model=list[BlockedDateResponse])
async def list_blocked_dates(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    start_date: date = Query(default=None),
    end_date: date = Query(default=None),
) -> list[BlockedDateResponse]:
    """List blocked dates for a partner. Partner can view their own; staff can view any."""

    if current_user.role == "partner":
        result = await db.execute(
            select(PartnerProfile).where(PartnerProfile.user_id == current_user.id)
        )
        my_profile = result.scalar_one_or_none()
        if my_profile is None or str(my_profile.id) != str(partner_id):
            raise NotFoundException("Partner not found")

    filters = [PartnerBlockedDate.partner_id == partner_id]
    if start_date:
        filters.append(PartnerBlockedDate.blocked_date >= start_date)
    if end_date:
        filters.append(PartnerBlockedDate.blocked_date <= end_date)

    result = await db.execute(
        select(PartnerBlockedDate).where(and_(*filters)).order_by(PartnerBlockedDate.blocked_date)
    )
    rows = result.scalars().all()
    return [BlockedDateResponse.model_validate(r) for r in rows]


@router.post(
    "/{partner_id}/blocked-dates",
    response_model=BlockedDateResponse,
    status_code=201,
)
async def add_blocked_date(
    partner_id: UUID,
    data: BlockedDateCreate,
    db: DB,
    current_user: CurrentUser,
) -> BlockedDateResponse:
    """Block a date for a partner. Partner can block their own dates; staff can block any."""
    if current_user.role == "partner":
        result = await db.execute(
            select(PartnerProfile).where(PartnerProfile.user_id == current_user.id)
        )
        my_profile = result.scalar_one_or_none()
        if my_profile is None or str(my_profile.id) != str(partner_id):
            raise NotFoundException("Partner not found")
    else:
        # Internal staff — verify partner exists
        result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
        if result.scalar_one_or_none() is None:
            raise NotFoundException("Partner not found")

    # Check for duplicate
    dup = await db.execute(
        select(PartnerBlockedDate).where(
            and_(
                PartnerBlockedDate.partner_id == partner_id,
                PartnerBlockedDate.blocked_date == data.blocked_date,
            )
        )
    )
    if dup.scalar_one_or_none():
        raise BadRequestException("Date already blocked")

    blocked = PartnerBlockedDate(
        partner_id=partner_id,
        blocked_date=data.blocked_date,
        reason=data.reason,
        created_by=current_user.id,
    )
    db.add(blocked)
    await db.commit()
    await db.refresh(blocked)
    return BlockedDateResponse.model_validate(blocked)


@router.delete("/{partner_id}/blocked-dates/{blocked_date_id}", status_code=204)
async def remove_blocked_date(
    partner_id: UUID,
    blocked_date_id: UUID,
    db: DB,
    current_user: CurrentUser,
) -> None:
    """Remove a blocked date. Partner can remove their own; staff can remove any."""
    if current_user.role == "partner":
        result = await db.execute(
            select(PartnerProfile).where(PartnerProfile.user_id == current_user.id)
        )
        my_profile = result.scalar_one_or_none()
        if my_profile is None or str(my_profile.id) != str(partner_id):
            raise NotFoundException("Partner not found")

    result = await db.execute(
        select(PartnerBlockedDate).where(
            and_(
                PartnerBlockedDate.id == blocked_date_id,
                PartnerBlockedDate.partner_id == partner_id,
            )
        )
    )
    blocked = result.scalar_one_or_none()
    if blocked is None:
        raise NotFoundException("Blocked date not found")

    await db.delete(blocked)
    await db.commit()


# ── Per-Partner Threshold Endpoints ──────────────────────────────────────────


@router.get("/{partner_id}/threshold", response_model=PartnerThresholdResponse)
async def get_partner_threshold(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> PartnerThresholdResponse:
    """Return the partner-specific threshold override, or fall back to the global default."""
    # Check partner exists
    partner_result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    if partner_result.scalar_one_or_none() is None:
        raise NotFoundException("Partner not found")

    # Try partner-specific first
    result = await db.execute(
        select(PartnerThreshold).where(PartnerThreshold.partner_id == partner_id)
    )
    threshold = result.scalar_one_or_none()

    if threshold is None:
        # Fall back to global default
        result = await db.execute(
            select(PartnerThreshold).where(PartnerThreshold.partner_id.is_(None))
        )
        threshold = result.scalar_one_or_none()

    if threshold is None:
        raise NotFoundException("No threshold configured (neither partner-specific nor global)")

    return PartnerThresholdResponse.model_validate(threshold)


@router.put("/{partner_id}/threshold", response_model=PartnerThresholdResponse)
async def upsert_partner_threshold(
    partner_id: UUID,
    data: PartnerThresholdCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> PartnerThresholdResponse:
    """Create or update a partner-specific threshold override."""
    # Check partner exists
    partner_result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    if partner_result.scalar_one_or_none() is None:
        raise NotFoundException("Partner not found")

    result = await db.execute(
        select(PartnerThreshold).where(PartnerThreshold.partner_id == partner_id)
    )
    threshold = result.scalar_one_or_none()

    if threshold is None:
        threshold = PartnerThreshold(
            partner_id=partner_id,
            sla_compliance_threshold=data.sla_compliance_threshold,
            quality_score_threshold=data.quality_score_threshold,
            overall_score_threshold=data.overall_score_threshold,
            trend_window_weeks=data.trend_window_weeks,
            created_by=current_user.id,
        )
        db.add(threshold)
    else:
        threshold.sla_compliance_threshold = data.sla_compliance_threshold
        threshold.quality_score_threshold = data.quality_score_threshold
        threshold.overall_score_threshold = data.overall_score_threshold
        threshold.trend_window_weeks = data.trend_window_weeks

    await db.commit()
    await db.refresh(threshold)
    return PartnerThresholdResponse.model_validate(threshold)


@router.delete("/{partner_id}/threshold", status_code=204)
async def delete_partner_threshold(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> None:
    """Remove the per-partner threshold override (falls back to global default)."""
    result = await db.execute(
        select(PartnerThreshold).where(PartnerThreshold.partner_id == partner_id)
    )
    threshold = result.scalar_one_or_none()
    if threshold is None:
        raise NotFoundException("Partner threshold override not found")

    await db.delete(threshold)
    await db.commit()
