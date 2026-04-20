"""Calendar feed endpoints for iCal subscription URLs.

Provides:
- GET /calendar/feed.ics?token=xxx - iCal feed for external calendar apps
- POST /calendar/feed/tokens - Create a new feed token
- GET /calendar/feed/tokens - List user's feed tokens
- POST /calendar/feed/tokens/{id}/regenerate - Regenerate a token
- DELETE /calendar/feed/tokens/{id} - Revoke a token
"""

import logging
import secrets
import urllib.parse
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import load_only

from app.api.deps import DB, CurrentUser
from app.core.config import settings
from app.core.exceptions import NotFoundException
from app.models.calendar_feed_token import CalendarFeedToken
from app.models.decision_request import DecisionRequest
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.scheduled_event import ScheduledEvent
from app.models.user import User
from app.schemas.calendar_feed import (
    CalendarFeedStatusResponse,
    CalendarFeedTokenCreate,
    CalendarFeedTokenCreatedResponse,
    CalendarFeedTokenResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def generate_feed_token() -> str:
    """Generate a secure random token for calendar feed authentication."""
    return secrets.token_urlsafe(32)


def build_feed_url(token: str) -> str:
    """Build the full iCal feed URL for a token."""
    base_url = settings.API_V1_PREFIX.rstrip("/")
    encoded_token = urllib.parse.quote(token)
    return f"{settings.BACKEND_URL or ''}{base_url}/calendar/feed.ics?token={encoded_token}"


@router.get("/feed.ics")
async def get_calendar_feed(token: str, db: DB) -> PlainTextResponse:
    """Get iCal feed for calendar subscription.

    This endpoint is publicly accessible (no auth required) but requires a valid feed token.
    Calendar apps can subscribe to this URL to get real-time updates.

    Args:
        token: The feed token for authentication
        include_milestones: Whether to include program milestones (default: true)
        include_deadlines: Whether to include decision deadlines (default: true)
        include_meetings: Whether to include scheduled meetings (default: true)
        days_ahead: Number of days ahead to include (default: 90)
    """
    # Find the token
    result = await db.execute(
        select(CalendarFeedToken)
        .where(CalendarFeedToken.token == token, CalendarFeedToken.is_active.is_(True))
        .options(load_only(CalendarFeedToken.user_id))
    )
    feed_token = result.scalar_one_or_none()

    if not feed_token:
        raise NotFoundException("Invalid or expired feed token")

    # Get the user
    user_result = await db.execute(
        select(User).where(User.id == feed_token.user_id).options(load_only(User.full_name))
    )
    user = user_result.scalar_one_or_none()

    if not user or user.status != "active":
        raise NotFoundException("User not found or inactive")

    # Update last accessed timestamp
    feed_token.last_accessed_at = datetime.now(UTC)
    await db.commit()

    # Generate the iCal content
    ical_content = await generate_full_ical_feed(db, feed_token.user_id, user.full_name)

    return PlainTextResponse(
        content=ical_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="amg-calendar-{feed_token.user_id}.ics"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Refresh-Interval": "PT1H",  # Suggest hourly refresh
            "X-PUBLISHED-TTL": "PT1H",
        },
    )


async def generate_full_ical_feed(  # noqa: PLR0912, PLR0915
    db: DB,
    user_id: uuid.UUID,
    user_name: str,
) -> str:
    """Generate iCal content with all events for a user.

    Includes:
    - Program milestones (for programs where user is the assigned RM)
    - Decision deadlines (for the user's clients)
    - Scheduled meetings (organized by or attended by the user)
    """
    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AMG Portal//Calendar Feed//EN",
        f"NAME:AMG Portal - {user_name}",
        f"X-WR-CALNAME:AMG Portal - {user_name}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
        "X-PUBLISHED-TTL:PT1H",
    ]

    now = datetime.now(UTC)
    now_str = now.strftime("%Y%m%dT%H%M%SZ")

    # Get programs where user is the assigned RM (via client relationship)
    from app.models.client import Client

    programs_result = await db.execute(
        select(Program)
        .join(Client, Program.client_id == Client.id)
        .where(Client.rm_id == user_id, Program.status == "active")
    )
    programs = programs_result.scalars().all()
    program_ids = [p.id for p in programs]
    programs_by_id = {p.id: p for p in programs}

    # Add milestones
    if program_ids:
        milestones_result = await db.execute(
            select(Milestone)
            .where(Milestone.program_id.in_(program_ids))
            .order_by(Milestone.due_date.nulls_last())
        )
        milestones = milestones_result.scalars().all()

        for milestone in milestones:
            program = programs_by_id.get(milestone.program_id)
            program_title = program.title if program else "Unknown Program"

            event_uid = f"milestone-{milestone.id}@amg-portal"
            event_title = f"[{program_title}] {milestone.title}"

            description_parts = [
                f"Program: {program_title}",
                f"Status: {milestone.status.replace('_', ' ').title()}",
            ]
            if milestone.description:
                description_parts.append(f"Description: {milestone.description}")
            description_parts.append("")
            description_parts.append("---")
            description_parts.append("From AMG Portal Calendar Feed")

            description = "\\n".join(description_parts)

            lines.append("BEGIN:VEVENT")
            lines.append(f"UID:{event_uid}")
            lines.append(f"DTSTAMP:{now_str}")

            if milestone.due_date:
                lines.append(f"DTSTART;VALUE=DATE:{milestone.due_date.strftime('%Y%m%d')}")
                end_date = milestone.due_date + timedelta(days=1)
                lines.append(f"DTEND;VALUE=DATE:{end_date.strftime('%Y%m%d')}")
            else:
                today = now.date()
                lines.append(f"DTSTART;VALUE=DATE:{today.strftime('%Y%m%d')}")
                tomorrow = (today + timedelta(days=1)).strftime("%Y%m%d")
                lines.append(f"DTEND;VALUE=DATE:{tomorrow}")

            lines.append(f"SUMMARY:{event_title}")
            lines.append(f"DESCRIPTION:{description}")
            lines.append("CATEGORIES:MILESTONE")
            status = "CONFIRMED" if milestone.status == "completed" else "TENTATIVE"
            lines.append(f"STATUS:{status}")
            lines.append("END:VEVENT")

    # Add decision deadlines
    from app.models.client_profile import ClientProfile

    # Match decision requests belonging to either:
    #   - client profiles owned by this user, or
    #   - clients where this user is the assigned RM
    # Both lookups are expressed as subqueries so Postgres filters server-side
    # instead of pulling every client id into Python.
    user_client_profile_ids = select(ClientProfile.id).where(ClientProfile.user_id == user_id)
    rm_client_ids = select(Client.id).where(Client.rm_id == user_id)

    deadlines_result = await db.execute(
        select(DecisionRequest)
        .where(
            or_(
                DecisionRequest.client_id.in_(user_client_profile_ids),
                DecisionRequest.client_id.in_(rm_client_ids),
            ),
            DecisionRequest.status == "pending",
            DecisionRequest.deadline_date.is_not(None),
        )
        .order_by(DecisionRequest.deadline_date)
    )
    deadlines = deadlines_result.scalars().all()

    for deadline in deadlines:
        event_uid = f"deadline-{deadline.id}@amg-portal"
        event_title = f"[DECISION] {deadline.title}"

        description_parts = [
            f"Decision Required: {deadline.title}",
            f"Status: {deadline.status.replace('_', ' ').title()}",
        ]
        if deadline.consequence_text:
            description_parts.append(f"Consequence: {deadline.consequence_text}")
        description_parts.append("")
        description_parts.append("---")
        description_parts.append("From AMG Portal Calendar Feed")

        description = "\\n".join(description_parts)

        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{event_uid}")
        lines.append(f"DTSTAMP:{now_str}")

        if deadline.deadline_date:
            if deadline.deadline_time:
                # Specific time
                dt = datetime.combine(deadline.deadline_date, deadline.deadline_time)
                lines.append(f"DTSTART:{dt.strftime('%Y%m%dT%H%M%SZ')}")
                end_dt = (dt + timedelta(hours=1)).strftime("%Y%m%dT%H%M%SZ")
                lines.append(f"DTEND:{end_dt}")
            else:
                # All-day event
                start = deadline.deadline_date.strftime("%Y%m%d")
                end_date = deadline.deadline_date + timedelta(days=1)
                lines.append(f"DTSTART;VALUE=DATE:{start}")
                lines.append(f"DTEND;VALUE=DATE:{end_date.strftime('%Y%m%d')}")

        lines.append(f"SUMMARY:{event_title}")
        lines.append(f"DESCRIPTION:{description}")
        lines.append("CATEGORIES:DEADLINE")
        lines.append("STATUS:TENTATIVE")
        lines.append("END:VEVENT")

    # Add scheduled meetings
    meetings_result = await db.execute(
        select(ScheduledEvent)
        .where(
            ScheduledEvent.status == "scheduled",
            ScheduledEvent.start_time >= now - timedelta(days=7),  # Include recent past
            (ScheduledEvent.organizer_id == user_id)
            | (ScheduledEvent.attendee_ids.contains([user_id])),
        )
        .order_by(ScheduledEvent.start_time)
    )
    meetings = meetings_result.scalars().all()

    for meeting in meetings:
        event_uid = f"meeting-{meeting.id}@amg-portal"
        event_title = meeting.title

        description_parts = [f"Type: {meeting.event_type.replace('_', ' ').title()}"]
        if meeting.description:
            description_parts.append(f"Description: {meeting.description}")
        if meeting.location:
            description_parts.append(f"Location: {meeting.location}")
        if meeting.virtual_link:
            description_parts.append(f"Join: {meeting.virtual_link}")
        description_parts.append("")
        description_parts.append("---")
        description_parts.append("From AMG Portal Calendar Feed")

        description = "\\n".join(description_parts)

        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{event_uid}")
        lines.append(f"DTSTAMP:{now_str}")
        lines.append(f"DTSTART:{meeting.start_time.strftime('%Y%m%dT%H%M%SZ')}")
        lines.append(f"DTEND:{meeting.end_time.strftime('%Y%m%dT%H%M%SZ')}")
        lines.append(f"SUMMARY:{event_title}")
        lines.append(f"DESCRIPTION:{description}")
        if meeting.location:
            lines.append(f"LOCATION:{meeting.location}")
        lines.append("CATEGORIES:MEETING")
        lines.append("STATUS:CONFIRMED")
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


@router.get("/status", response_model=CalendarFeedStatusResponse)
async def get_calendar_feed_status(current_user: CurrentUser, db: DB) -> CalendarFeedStatusResponse:
    """Get calendar feed status for the current user."""
    result = await db.execute(
        select(CalendarFeedToken)
        .where(CalendarFeedToken.user_id == current_user.id, CalendarFeedToken.is_active.is_(True))
        .order_by(CalendarFeedToken.created_at.desc())
        .limit(1)
    )
    active_token = result.scalar_one_or_none()

    if active_token:
        return CalendarFeedStatusResponse(
            has_active_token=True,
            active_token=CalendarFeedTokenResponse.model_validate(active_token),
            feed_url=build_feed_url(active_token.token),
        )

    return CalendarFeedStatusResponse(has_active_token=False)


@router.post("/tokens", response_model=CalendarFeedTokenCreatedResponse)
async def create_feed_token(
    current_user: CurrentUser,
    db: DB,
    data: CalendarFeedTokenCreate = CalendarFeedTokenCreate(),
) -> CalendarFeedTokenCreatedResponse:
    """Create a new calendar feed token.

    If the user already has an active token, it will be revoked before creating the new one.
    """
    # Revoke any existing active tokens
    existing_result = await db.execute(
        select(CalendarFeedToken).where(
            CalendarFeedToken.user_id == current_user.id, CalendarFeedToken.is_active.is_(True)
        )
    )
    for existing in existing_result.scalars().all():
        existing.is_active = False
        existing.revoked_at = datetime.now(UTC)

    # Create new token
    token_str = generate_feed_token()
    new_token = CalendarFeedToken(
        user_id=current_user.id,
        token=token_str,
        name=data.name,
        is_active=True,
    )
    db.add(new_token)
    await db.commit()
    await db.refresh(new_token)

    return CalendarFeedTokenCreatedResponse(
        id=new_token.id,
        name=new_token.name,
        is_active=new_token.is_active,
        last_accessed_at=new_token.last_accessed_at,
        created_at=new_token.created_at,
        revoked_at=new_token.revoked_at,
        feed_url=build_feed_url(token_str),
        token=token_str,
    )


@router.post("/tokens/{token_id}/regenerate", response_model=CalendarFeedTokenCreatedResponse)
async def regenerate_feed_token(
    token_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> CalendarFeedTokenCreatedResponse:
    """Regenerate a calendar feed token.

    This invalidates the old token and creates a new one.
    """
    result = await db.execute(
        select(CalendarFeedToken).where(
            CalendarFeedToken.id == token_id, CalendarFeedToken.user_id == current_user.id
        )
    )
    existing = result.scalar_one_or_none()

    if not existing:
        raise NotFoundException("Feed token not found")

    # Revoke the existing token
    existing.is_active = False
    existing.revoked_at = datetime.now(UTC)

    # Create new token
    token_str = generate_feed_token()
    new_token = CalendarFeedToken(
        user_id=current_user.id,
        token=token_str,
        name=existing.name,
        is_active=True,
    )
    db.add(new_token)
    await db.commit()
    await db.refresh(new_token)

    return CalendarFeedTokenCreatedResponse(
        id=new_token.id,
        name=new_token.name,
        is_active=new_token.is_active,
        last_accessed_at=new_token.last_accessed_at,
        created_at=new_token.created_at,
        revoked_at=new_token.revoked_at,
        feed_url=build_feed_url(token_str),
        token=token_str,
    )


@router.delete("/tokens/{token_id}")
async def revoke_feed_token(
    token_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> dict[str, str]:
    """Revoke a calendar feed token.

    This permanently disables the feed URL.
    """
    result = await db.execute(
        select(CalendarFeedToken).where(
            CalendarFeedToken.id == token_id, CalendarFeedToken.user_id == current_user.id
        )
    )
    token = result.scalar_one_or_none()

    if not token:
        raise NotFoundException("Feed token not found")

    token.is_active = False
    token.revoked_at = datetime.now(UTC)
    await db.commit()

    return {"message": "Calendar feed token revoked successfully"}
