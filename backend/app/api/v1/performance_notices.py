"""Performance notices API — formal notices for SLA breaches and quality issues."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentPartner,
    CurrentUser,
    RLSContext,
    require_admin,
    require_internal,
)
from app.core.exceptions import NotFoundException
from app.models.performance_notice import PerformanceNotice
from app.schemas.performance_notice import (
    PerformanceNoticeCreate,
    PerformanceNoticeListResponse,
    PerformanceNoticeResponse,
)

router = APIRouter()


def _build_response(notice: PerformanceNotice) -> PerformanceNoticeResponse:
    return PerformanceNoticeResponse(
        id=notice.id,
        partner_id=notice.partner_id,
        program_id=notice.program_id,
        issued_by=notice.issued_by,
        notice_type=notice.notice_type,  # type: ignore[arg-type]
        severity=notice.severity,  # type: ignore[arg-type]
        title=notice.title,
        description=notice.description,
        required_action=notice.required_action,
        status=notice.status,  # type: ignore[arg-type]
        acknowledged_at=notice.acknowledged_at,
        program_title=notice.program.title if notice.program else None,
        issuer_name=(
            f"{notice.issuer.first_name} {notice.issuer.last_name}"
            if notice.issuer
            else None
        ),
        created_at=notice.created_at,
        updated_at=notice.updated_at,
    )


# ──────────────────────────────────────────────
# Internal endpoints (MD / internal staff)
# ──────────────────────────────────────────────


@router.post(
    "/",
    response_model=PerformanceNoticeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_performance_notice(
    payload: PerformanceNoticeCreate,
    db: DB,
    current_user: CurrentUser,
) -> PerformanceNoticeResponse:
    """Issue a formal performance notice to a partner (Managing Director only)."""
    notice = PerformanceNotice(
        partner_id=payload.partner_id,
        program_id=payload.program_id,
        issued_by=current_user.id,
        notice_type=payload.notice_type,
        severity=payload.severity,
        title=payload.title,
        description=payload.description,
        required_action=payload.required_action,
    )
    db.add(notice)
    await db.commit()
    await db.refresh(notice)

    # Reload with relationships
    result = await db.execute(
        select(PerformanceNotice)
        .options(
            selectinload(PerformanceNotice.program),
            selectinload(PerformanceNotice.issuer),
        )
        .where(PerformanceNotice.id == notice.id)
    )
    notice = result.scalar_one()
    return _build_response(notice)


@router.get(
    "/partner/{partner_id}",
    response_model=PerformanceNoticeListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_partner_notices(
    partner_id: uuid.UUID,
    db: DB,
) -> PerformanceNoticeListResponse:
    """List all performance notices for a specific partner (internal staff)."""
    result = await db.execute(
        select(PerformanceNotice)
        .options(
            selectinload(PerformanceNotice.program),
            selectinload(PerformanceNotice.issuer),
        )
        .where(PerformanceNotice.partner_id == partner_id)
        .order_by(PerformanceNotice.created_at.desc())
    )
    notices = result.scalars().all()
    unacknowledged = sum(1 for n in notices if n.status == "open")
    return PerformanceNoticeListResponse(
        notices=[_build_response(n) for n in notices],
        total=len(notices),
        unacknowledged_count=unacknowledged,
    )


# ──────────────────────────────────────────────
# Partner-portal endpoints (partner-scoped)
# ──────────────────────────────────────────────


@router.get(
    "/my",
    response_model=PerformanceNoticeListResponse,
)
async def get_my_notices(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> PerformanceNoticeListResponse:
    """Get all performance notices issued to the authenticated partner."""
    result = await db.execute(
        select(PerformanceNotice)
        .options(
            selectinload(PerformanceNotice.program),
            selectinload(PerformanceNotice.issuer),
        )
        .where(PerformanceNotice.partner_id == partner.id)
        .order_by(PerformanceNotice.created_at.desc())
    )
    notices = result.scalars().all()
    unacknowledged = sum(1 for n in notices if n.status == "open")
    return PerformanceNoticeListResponse(
        notices=[_build_response(n) for n in notices],
        total=len(notices),
        unacknowledged_count=unacknowledged,
    )


@router.post(
    "/my/{notice_id}/acknowledge",
    response_model=PerformanceNoticeResponse,
)
async def acknowledge_my_notice(
    notice_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> PerformanceNoticeResponse:
    """Acknowledge an open performance notice."""
    result = await db.execute(
        select(PerformanceNotice)
        .options(
            selectinload(PerformanceNotice.program),
            selectinload(PerformanceNotice.issuer),
        )
        .where(
            PerformanceNotice.id == notice_id,
            PerformanceNotice.partner_id == partner.id,
        )
    )
    notice = result.scalar_one_or_none()
    if not notice:
        raise NotFoundException("Notice not found")
    if notice.status == "acknowledged":
        return _build_response(notice)

    notice.status = "acknowledged"
    notice.acknowledged_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(notice)

    # Reload with relationships
    result = await db.execute(
        select(PerformanceNotice)
        .options(
            selectinload(PerformanceNotice.program),
            selectinload(PerformanceNotice.issuer),
        )
        .where(PerformanceNotice.id == notice.id)
    )
    notice = result.scalar_one()
    return _build_response(notice)
