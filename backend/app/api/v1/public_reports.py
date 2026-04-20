"""Public (unauthenticated) endpoints for accessing shared reports via token."""

import uuid
from datetime import UTC, datetime
from typing import Any

import bcrypt
from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB
from app.core.exceptions import GoneException, NotFoundException, UnauthorizedException
from app.models.shared_report import SharedReport
from app.schemas.shared_report import (
    PublicReportAccessRequest,
    SharedReportMeta,
    SharedReportPublicData,
)
from app.services.report_service import report_service

router = APIRouter()


async def _resolve_share(token: str, db: DB) -> SharedReport:
    """Load and validate a shared report by token. Returns 404 for any invalid state."""
    result = await db.execute(
        select(SharedReport)
        .options(selectinload(SharedReport.creator))
        .where(SharedReport.share_token == token)
    )
    share = result.scalar_one_or_none()

    if not share or not share.is_active:
        raise NotFoundException("Share not found")

    if share.expires_at is not None:
        expires_at = share.expires_at
        # Make timezone-aware if needed
        if hasattr(expires_at, "tzinfo") and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at < datetime.now(UTC):
            raise GoneException("This shared report has expired")

    return share


def _creator_display_name(share: SharedReport) -> str:
    if share.creator:
        name = f"{share.creator.first_name} {share.creator.last_name}".strip()
        return name or share.creator.email
    return "AMG Portal"


@router.get("/{token}", response_model=SharedReportMeta)
async def get_shared_report_meta(token: str, db: DB) -> SharedReportMeta:
    """Return public metadata for a shared report without incrementing access count."""
    share = await _resolve_share(token, db)
    return SharedReportMeta(
        report_type=share.report_type,
        entity_id=share.entity_id,
        creator_name=_creator_display_name(share),
        is_password_protected=share.password_hash is not None,
        allow_download=share.allow_download,
        expires_at=share.expires_at,
    )


@router.post("/{token}/access", response_model=SharedReportPublicData)
async def access_shared_report(
    token: str,
    body: PublicReportAccessRequest,
    db: DB,
) -> SharedReportPublicData:
    """Verify password (if set) and return report data. Increments access count."""
    share = await _resolve_share(token, db)

    # Password check
    if share.password_hash is not None:
        provided = body.password or ""
        if not bcrypt.checkpw(provided.encode(), share.password_hash.encode()):
            raise UnauthorizedException("Incorrect password")

    # Fetch report data based on type
    data = await _fetch_report_data(share, db)
    if data is None:
        raise NotFoundException("Report data not found for this share")

    # Increment access count
    share.access_count += 1
    await db.commit()

    return SharedReportPublicData(
        report_type=share.report_type,
        entity_id=share.entity_id,
        allow_download=share.allow_download,
        data=data,
    )


async def _fetch_report_data(share: SharedReport, db: DB) -> dict[str, Any] | None:  # noqa: PLR0911
    """Dispatch to the appropriate report service method.

    Only report types that are scoped to a specific entity (client, program, or the
    creating RM) are served here.  Org-wide internal reports (escalation_log,
    compliance) are not suitable for unauthenticated public sharing and always return
    None (→ 404) so they are never accidentally exposed via a share token.
    """
    report_type = share.report_type
    entity_id = share.entity_id

    if report_type == "rm_portfolio":
        # Scope to the RM who created the share link — never expose the full org portfolio.
        return await report_service.get_rm_portfolio_report(db, share.created_by)

    # escalation_log and compliance are org-wide internal reports; they must not be
    # accessible via unauthenticated share tokens regardless of who created the link.
    if report_type in ("escalation_log", "compliance"):
        return None

    if report_type == "annual_review":
        year = int(entity_id) if entity_id else datetime.now(UTC).year
        # annual_review requires a client_id — look up first available client for entity_id context
        # entity_id may be a client UUID or None; if None we pass a sentinel zero UUID
        client_id = uuid.UUID(entity_id) if entity_id else uuid.UUID(int=0)
        result = await report_service.get_annual_review(db, client_id, year)
        return result

    if report_type == "portfolio":
        if not entity_id:
            return None
        return await report_service.get_portfolio_overview(db, uuid.UUID(entity_id))

    if report_type == "program_status":
        if not entity_id:
            return None
        return await report_service.get_program_status_report(db, uuid.UUID(entity_id))

    if report_type == "completion":
        if not entity_id:
            return None
        return await report_service.get_completion_report(db, uuid.UUID(entity_id))

    return None
