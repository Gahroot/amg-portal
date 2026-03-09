"""Client self-service preferences and engagement history."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.api.v1.client_portal import require_client
from app.models.client import Client
from app.models.notification_preference import NotificationPreference
from app.models.program import Program
from app.schemas.client_preferences import (
    ClientPreferencesResponse,
    ClientPreferencesUpdate,
    EngagementHistoryItem,
    EngagementHistoryResponse,
)

router = APIRouter()


async def _get_client_for_user(db: DB, current_user: CurrentUser) -> Client:
    """Resolve the Client record linked to the current user."""
    result = await db.execute(select(Client).where(Client.rm_id == current_user.id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )
    return client


@router.get(
    "/preferences",
    response_model=ClientPreferencesResponse,
    dependencies=[Depends(require_client)],
)
async def get_preferences(
    db: DB,
    current_user: CurrentUser,
) -> ClientPreferencesResponse:
    """Get current client notification and report preferences."""
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()

    if not pref:
        return ClientPreferencesResponse(
            digest_frequency="daily",
            report_format="pdf",
            notification_channels={"email": True, "in_portal": True},
        )

    channels = pref.channel_preferences or {
        "email": True,
        "in_portal": True,
    }

    # Extract report_format from notification_type_preferences
    type_prefs = pref.notification_type_preferences or {}
    report_format = type_prefs.get("report_format", "pdf")

    return ClientPreferencesResponse(
        digest_frequency=pref.digest_frequency,
        report_format=report_format,
        notification_channels=channels,
    )


@router.patch(
    "/preferences",
    response_model=ClientPreferencesResponse,
    dependencies=[Depends(require_client)],
)
async def update_preferences(
    body: ClientPreferencesUpdate,
    db: DB,
    current_user: CurrentUser,
) -> ClientPreferencesResponse:
    """Update client notification and report preferences."""
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()

    if not pref:
        pref = NotificationPreference(
            user_id=current_user.id,
            digest_enabled=True,
            digest_frequency="daily",
        )
        db.add(pref)

    if body.digest_frequency is not None:
        pref.digest_frequency = body.digest_frequency
        pref.digest_enabled = body.digest_frequency != "never"

    if body.notification_channels is not None:
        pref.channel_preferences = body.notification_channels

    if body.report_format is not None:
        type_prefs = dict(pref.notification_type_preferences or {})
        type_prefs["report_format"] = body.report_format
        pref.notification_type_preferences = type_prefs

    await db.commit()
    await db.refresh(pref)

    channels = pref.channel_preferences or {
        "email": True,
        "in_portal": True,
    }
    type_prefs = pref.notification_type_preferences or {}
    report_format = type_prefs.get("report_format", "pdf")

    return ClientPreferencesResponse(
        digest_frequency=pref.digest_frequency,
        report_format=report_format,
        notification_channels=channels,
    )


@router.get(
    "/history",
    response_model=EngagementHistoryResponse,
    dependencies=[Depends(require_client)],
)
async def get_engagement_history(
    db: DB,
    current_user: CurrentUser,
) -> EngagementHistoryResponse:
    """Get engagement history — list of programs for the client."""
    client = await _get_client_for_user(db, current_user)

    result = await db.execute(
        select(Program).where(Program.client_id == client.id).order_by(Program.created_at.desc())
    )
    programs = result.scalars().all()

    items = [
        EngagementHistoryItem(
            program_id=str(p.id),
            title=p.title,
            status=p.status,
            start_date=(p.start_date.isoformat() if p.start_date else None),
            end_date=(p.end_date.isoformat() if p.end_date else None),
            created_at=p.created_at.isoformat(),
        )
        for p in programs
    ]

    return EngagementHistoryResponse(programs=items, total=len(items))
