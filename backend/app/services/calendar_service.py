"""Calendar integration service for Google Calendar, Outlook, and iCal.

Supports pushing program milestones to RM calendars via:
- iCal file generation (fallback/download)
- Google Calendar API
- Microsoft Graph API (Outlook)
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.user import User

logger = logging.getLogger(__name__)

# Calendar event description template
EVENT_DESCRIPTION_TEMPLATE = """Program: {program_name}
Status: {status}
{description}

---
This event was created by AMG Portal. Do not edit directly.
"""


class CalendarError(Exception):
    """Base exception for calendar integration errors."""

    pass


class GoogleCalendarError(CalendarError):
    """Google Calendar API error."""

    pass


class OutlookCalendarError(CalendarError):
    """Microsoft Graph API error."""

    pass


def generate_ical_content(
    milestones: list[Milestone],
    programs: dict[uuid.UUID, Program],
    user_name: str,
    calendar_name: str = "AMG Portal Milestones",
) -> str:
    """Generate iCal (.ics) content for a list of milestones.

    Args:
        milestones: List of milestones to include in the calendar
        programs: Dict mapping program_id to Program objects
        user_name: Name of the user (for calendar name)
        calendar_name: Name for the calendar

    Returns:
        iCal formatted string content
    """
    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AMG Portal//Milestones//EN",
        f"NAME:{calendar_name}",
        f"X-WR-CALNAME:{calendar_name}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]

    for milestone in milestones:
        program = programs.get(milestone.program_id)
        program_name = program.name if program else "Unknown Program"  # type: ignore[attr-defined]

        # Create unique event ID
        event_uid = f"milestone-{milestone.id}@amg-portal"

        # Event title
        event_title = f"[{program_name}] {milestone.title}"

        # Build description
        description_parts = [
            f"Program: {program_name}",
            f"Status: {milestone.status.replace('_', ' ').title()}",
        ]
        if milestone.description:
            description_parts.append(f"Description: {milestone.description}")
        description_parts.append("")
        description_parts.append("---")
        description_parts.append("This event was created by AMG Portal.")

        description = "\\n".join(description_parts)

        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{event_uid}")
        lines.append(f"DTSTAMP:{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}")

        if milestone.due_date:
            # All-day event for the due date
            lines.append(f"DTSTART;VALUE=DATE:{milestone.due_date.strftime('%Y%m%d')}")
            end_date = milestone.due_date + timedelta(days=1)
            lines.append(f"DTEND;VALUE=DATE:{end_date.strftime('%Y%m%d')}")
        else:
            # No due date - use today as placeholder
            today = datetime.now(UTC).date()
            lines.append(f"DTSTART;VALUE=DATE:{today.strftime('%Y%m%d')}")
            lines.append(f"DTEND;VALUE=DATE:{(today + timedelta(days=1)).strftime('%Y%m%d')}")

        lines.append(f"SUMMARY:{event_title}")
        lines.append(f"DESCRIPTION:{description}")
        lines.append(f"STATUS:{'CONFIRMED' if milestone.status == 'completed' else 'TENTATIVE'}")
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


async def generate_ical_for_user(db: AsyncSession, user_id: uuid.UUID) -> str:
    """Generate iCal content for all active milestones assigned to a user.

    Args:
        db: Database session
        user_id: User ID to generate calendar for

    Returns:
        iCal formatted string content
    """
    # Get user info
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise CalendarError("User not found")

    # Get all programs where user is the assigned RM
    programs_result = await db.execute(
        select(Program).where(Program.assigned_rm_id == user_id, Program.status == "active")  # type: ignore[attr-defined]
    )
    programs = programs_result.scalars().all()
    program_ids = [p.id for p in programs]
    programs_by_id = {p.id: p for p in programs}

    # Get all milestones for these programs
    if not program_ids:
        # No active programs - return empty calendar
        return generate_ical_content([], {}, user.full_name)

    milestones_result = await db.execute(
        select(Milestone)
        .where(Milestone.program_id.in_(program_ids))
        .order_by(Milestone.due_date.nulls_last(), Milestone.created_at)
    )
    milestones = milestones_result.scalars().all()

    return generate_ical_content(list(milestones), programs_by_id, user.full_name)


async def push_milestone_to_google(
    db: AsyncSession,
    user_id: uuid.UUID,
    milestone: Milestone,
    program_name: str,
) -> str | None:
    """Push a milestone event to Google Calendar.

    Uses the stored `calendar_event_id` on the milestone to update directly
    when available; falls back to creating a new event otherwise.

    Args:
        db: Database session
        user_id: User ID with Google Calendar connected
        milestone: Milestone to push
        program_name: Name of the program for the event title

    Returns:
        Google Calendar event ID if successful, None otherwise

    Raises:
        GoogleCalendarError: If the API call fails
    """
    # Check if user has Google Calendar connected
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.google_calendar_token:
        logger.info("User %s does not have Google Calendar connected", user_id)
        return None

    try:
        import json

        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from googleapiclient.errors import HttpError

        # Parse stored token
        token_data = user.google_calendar_token
        if isinstance(token_data, str):
            token_data = json.loads(token_data)

        credentials = Credentials(  # type: ignore[no-untyped-call]
            token=token_data.get("access_token"),
            refresh_token=token_data.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
        )

        # Build the Calendar service (sync SDK call — runs in the calling thread)
        service = build("calendar", "v3", credentials=credentials)

        # Build event body
        event_title = f"[{program_name}] {milestone.title}"
        description = EVENT_DESCRIPTION_TEMPLATE.format(
            program_name=program_name,
            status=milestone.status.replace("_", " ").title(),
            description=milestone.description or "",
        )

        event_body: dict[str, Any] = {
            "summary": event_title,
            "description": description,
            "status": "confirmed" if milestone.status == "completed" else "tentative",
        }

        if milestone.due_date:
            event_body["start"] = {"date": milestone.due_date.isoformat()}
            event_body["end"] = {"date": (milestone.due_date + timedelta(days=1)).isoformat()}
        else:
            today = datetime.now(UTC).date()
            event_body["start"] = {"date": today.isoformat()}
            event_body["end"] = {"date": (today + timedelta(days=1)).isoformat()}

        external_id = f"amg-milestone-{milestone.id}"

        # If we have a stored event ID, try to update directly (fast path)
        if milestone.calendar_event_id:
            try:
                event = (
                    service.events()
                    .update(
                        calendarId="primary",
                        eventId=milestone.calendar_event_id,
                        body=event_body,
                    )
                    .execute()
                )
                logger.info(
                    "Updated Google Calendar event %s for milestone %s",
                    event["id"],
                    milestone.id,
                )
                return str(event["id"])
            except HttpError as e:
                if e.status_code != 404:
                    raise
                # Event was deleted from Google Calendar — fall through to create
                logger.warning(
                    "Google Calendar event %s not found; creating new",
                    milestone.calendar_event_id,
                )

        # Create a new event with extended properties for idempotency
        event_body["extendedProperties"] = {"private": {"id": external_id, "source": "amg-portal"}}
        event = (
            service.events()
            .insert(
                calendarId="primary",
                body=event_body,
            )
            .execute()
        )
        logger.info("Created Google Calendar event %s for milestone %s", event["id"], milestone.id)
        return str(event["id"])

    except ImportError as exc:
        logger.warning("Google API libraries not installed. Install google-api-python-client.")
        raise GoogleCalendarError("Google Calendar integration not available") from exc
    except GoogleCalendarError:
        raise
    except Exception as e:
        logger.error("Failed to push milestone to Google Calendar: %s", e)
        raise GoogleCalendarError(str(e)) from e


async def sync_milestone_to_google_calendar(
    db: AsyncSession,
    milestone: Milestone,
    program_name: str,
    rm_user_id: uuid.UUID,
) -> str | None:
    """Sync a single milestone to Google Calendar and persist the event ID.

    Creates or updates a Google Calendar event for the given milestone and
    stores the resulting event ID back on `milestone.calendar_event_id`.

    Args:
        db: Database session
        milestone: The Milestone ORM object to sync
        program_name: Human-readable program name for the event title
        rm_user_id: ID of the RM (relationship manager) whose Google Calendar to use

    Returns:
        The Google Calendar event ID, or None if the RM has no Google Calendar connected
    """
    try:
        event_id = await push_milestone_to_google(db, rm_user_id, milestone, program_name)
        if event_id and event_id != milestone.calendar_event_id:
            milestone.calendar_event_id = event_id
            await db.commit()
        return event_id
    except GoogleCalendarError as e:
        # Log but don't fail the caller — calendar sync is best-effort
        logger.warning("Google Calendar sync failed for milestone %s: %s", milestone.id, e)
        return None


async def push_milestone_to_outlook(
    db: AsyncSession,
    user_id: uuid.UUID,
    milestone: Milestone,
    program_name: str,
) -> str | None:
    """Push a milestone event to Outlook via Microsoft Graph API.

    Args:
        db: Database session
        user_id: User ID with Outlook connected
        milestone: Milestone to push
        program_name: Name of the program for the event title

    Returns:
        Outlook event ID if successful, None otherwise

    Raises:
        OutlookCalendarError: If the API call fails
    """
    # Check if user has Outlook connected
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.outlook_calendar_token:
        logger.info("User %s does not have Outlook connected", user_id)
        return None

    try:
        import json

        import httpx  # exception type only — request goes through shared client

        from app.core.http_client import get_internal_client

        # Parse stored token
        token_data = user.outlook_calendar_token
        if isinstance(token_data, str):
            token_data = json.loads(token_data)

        access_token = token_data.get("access_token")
        if not access_token:
            raise OutlookCalendarError("No access token available")

        # Create event
        event_title = f"[{program_name}] {milestone.title}"
        description = EVENT_DESCRIPTION_TEMPLATE.format(
            program_name=program_name,
            status=milestone.status.replace("_", " ").title(),
            description=milestone.description or "",
        )

        # Build event body for Microsoft Graph API
        event_body: dict[str, Any] = {
            "subject": event_title,
            "body": {
                "contentType": "text",
                "content": description,
            },
            "showAs": "tentative" if milestone.status != "completed" else "free",
            "categories": ["AMG Portal"],
        }

        if milestone.due_date:
            # All-day event
            event_body["isAllDay"] = True
            event_body["start"] = {
                "dateTime": milestone.due_date.isoformat(),
                "timeZone": "UTC",
            }
            event_body["end"] = {
                "dateTime": (milestone.due_date + timedelta(days=1)).isoformat(),
                "timeZone": "UTC",
            }
        else:
            # No due date - use today
            today = datetime.now(UTC).date()
            event_body["isAllDay"] = True
            event_body["start"] = {
                "dateTime": today.isoformat(),
                "timeZone": "UTC",
            }
            event_body["end"] = {
                "dateTime": (today + timedelta(days=1)).isoformat(),
                "timeZone": "UTC",
            }

        # Trusted Microsoft Graph endpoint — internal client; redirects disabled
        # because graph.microsoft.com never legitimately 3xx's the events POST.
        client = get_internal_client()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Prefer": 'outlook.timezone="UTC"',
        }
        response = await client.post(
            "https://graph.microsoft.com/v1.0/me/events",
            headers=headers,
            json=event_body,
            params={"$select": "id"},
            follow_redirects=False,
        )

        if response.status_code == 401:
            raise OutlookCalendarError("Access token expired")
        elif response.status_code not in (200, 201):
            logger.error("Outlook API error: %s - %s", response.status_code, response.text)
            raise OutlookCalendarError(f"Outlook API error: {response.status_code}")

        event_data = response.json()
        return event_data.get("id")  # type: ignore[no-any-return]

    except httpx.HTTPError as e:
        logger.error("HTTP error pushing to Outlook: %s", e)
        raise OutlookCalendarError(str(e)) from e
    except Exception as e:
        logger.error("Failed to push milestone to Outlook: %s", e)
        raise OutlookCalendarError(str(e)) from e


async def sync_all_milestones_to_calendar(
    db: AsyncSession,
    user_id: uuid.UUID,
    provider: str = "all",
) -> dict[str, Any]:
    """Sync all upcoming milestones to the user's connected calendar(s).

    Args:
        db: Database session
        user_id: User ID to sync for
        provider: "google", "outlook", or "all"

    Returns:
        Dict with sync results (success count, errors, etc.)
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise CalendarError("User not found")

    # Get all programs where user is the assigned RM
    programs_result = await db.execute(
        select(Program).where(Program.assigned_rm_id == user_id, Program.status == "active")  # type: ignore[attr-defined]
    )
    programs = programs_result.scalars().all()
    program_ids = [p.id for p in programs]
    programs_by_id = {p.id: p for p in programs}

    if not program_ids:
        return {"synced": 0, "errors": [], "message": "No active programs found"}

    # Get upcoming milestones (not yet completed)
    milestones_result = await db.execute(
        select(Milestone)
        .where(
            Milestone.program_id.in_(program_ids),
            Milestone.status != "completed",
        )
        .order_by(Milestone.due_date.nulls_last())
    )
    milestones = milestones_result.scalars().all()

    results: dict[str, Any] = {
        "synced": 0,
        "errors": [],
        "google_synced": 0,
        "outlook_synced": 0,
    }

    for milestone in milestones:
        program = programs_by_id.get(milestone.program_id)
        program_name = program.name if program else "Unknown Program"  # type: ignore[attr-defined]

        if provider in ("google", "all") and user.google_calendar_token:
            try:
                event_id = await push_milestone_to_google(db, user_id, milestone, program_name)
                if event_id:
                    results["google_synced"] += 1
                    results["synced"] += 1
            except GoogleCalendarError as e:
                results["errors"].append(f"Google: {milestone.title} - {str(e)}")

        if provider in ("outlook", "all") and user.outlook_calendar_token:
            try:
                event_id = await push_milestone_to_outlook(db, user_id, milestone, program_name)
                if event_id:
                    results["outlook_synced"] += 1
                    results["synced"] += 1
            except OutlookCalendarError as e:
                results["errors"].append(f"Outlook: {milestone.title} - {str(e)}")

    return results
