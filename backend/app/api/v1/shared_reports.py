"""Authenticated CRUD endpoints for managing shareable report links."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.core.config import settings
from app.models.shared_report import SharedReport
from app.schemas.shared_report import SharedReportCreate, SharedReportResponse

router = APIRouter()

# Valid report types for sharing
VALID_SHARE_REPORT_TYPES = {
    "rm_portfolio",
    "escalation_log",
    "compliance",
    "annual_review",
    "portfolio",
    "program_status",
    "completion",
}

_EXPIRY_DELTAS: dict[str, timedelta | None] = {
    "1d": timedelta(days=1),
    "1w": timedelta(weeks=1),
    "1m": timedelta(days=30),
    "never": None,
}


def _build_share_url(request: Request, token: str) -> str:
    """Construct the public share URL for a given token."""
    return f"{settings.FRONTEND_URL}/shared/{token}"


def _build_response(share: SharedReport, share_url: str) -> SharedReportResponse:
    creator_name: str | None = None
    if share.creator:
        creator_name = f"{share.creator.first_name} {share.creator.last_name}".strip()

    return SharedReportResponse(
        id=share.id,
        report_type=share.report_type,
        entity_id=share.entity_id,
        share_token=share.share_token,
        created_by=share.created_by,
        expires_at=share.expires_at,  # type: ignore[arg-type]
        access_count=share.access_count,
        is_active=share.is_active,
        allow_download=share.allow_download,
        is_password_protected=share.password_hash is not None,
        share_url=share_url,
        creator_name=creator_name,
        created_at=share.created_at,
        updated_at=share.updated_at,
    )


@router.post("/", response_model=SharedReportResponse, status_code=status.HTTP_201_CREATED)
async def create_shared_report(
    body: SharedReportCreate,
    request: Request,
    db: DB,
    current_user: CurrentUser,
) -> SharedReportResponse:
    """Create a new shareable link for a report."""
    if body.report_type not in VALID_SHARE_REPORT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid report_type. Must be one of: {', '.join(sorted(VALID_SHARE_REPORT_TYPES))}",
        )

    expires_in = body.expires_in or "never"
    if expires_in not in _EXPIRY_DELTAS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expires_in must be one of: 1d, 1w, 1m, never",
        )

    delta = _EXPIRY_DELTAS[expires_in]
    expires_at = datetime.now(UTC) + delta if delta is not None else None

    password_hash: str | None = None
    if body.password:
        password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()

    share = SharedReport(
        id=uuid.uuid4(),
        report_type=body.report_type,
        entity_id=body.entity_id,
        share_token=secrets.token_urlsafe(32),
        created_by=current_user.id,
        expires_at=expires_at,
        password_hash=password_hash,
        access_count=0,
        is_active=True,
        allow_download=body.allow_download,
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)

    # Eagerly load creator for response
    result = await db.execute(
        select(SharedReport)
        .where(SharedReport.id == share.id)
        .execution_options(populate_existing=True)
    )
    loaded = result.scalar_one()
    # Attach creator manually since we already have it
    loaded.creator = current_user

    return _build_response(loaded, _build_share_url(request, loaded.share_token))


@router.get("/", response_model=list[SharedReportResponse])
async def list_shared_reports(
    request: Request,
    db: DB,
    current_user: CurrentUser,
) -> list[SharedReportResponse]:
    """List all shareable links created by the current user."""
    result = await db.execute(
        select(SharedReport)
        .where(SharedReport.created_by == current_user.id)
        .order_by(SharedReport.created_at.desc())
    )
    shares = list(result.scalars().all())

    responses = []
    for share in shares:
        share.creator = current_user
        responses.append(_build_response(share, _build_share_url(request, share.share_token)))
    return responses


@router.delete("/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_shared_report(
    share_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> None:
    """Revoke a shareable report link (sets is_active=False)."""
    result = await db.execute(
        select(SharedReport).where(
            SharedReport.id == share_id,
            SharedReport.created_by == current_user.id,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")

    share.is_active = False
    await db.commit()
