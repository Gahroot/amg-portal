"""Service for querying upcoming client birthdays and important dates."""

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client_profile import ClientProfile
from app.schemas.notification import CreateNotificationRequest
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


@dataclass
class UpcomingDateItem:
    client_id: UUID
    client_name: str
    rm_id: UUID
    date_type: str  # "birthday" or a custom label
    label: str
    days_until: int
    occurs_on: date
    years_since: int | None


def _days_until_next_occurrence(month: int, day: int, today: date) -> tuple[int, date]:
    """Return (days_until, next_occurrence_date) for a month/day anniversary.

    Handles year-boundary: if the date has already passed this year, returns
    next year's occurrence.
    """
    try:
        candidate = date(today.year, month, day)
    except ValueError:
        # Feb 29 on a non-leap year — use Feb 28
        candidate = date(today.year, month, min(day, 28))

    if candidate < today:
        try:
            candidate = date(today.year + 1, month, day)
        except ValueError:
            candidate = date(today.year + 1, month, min(day, 28))

    return (candidate - today).days, candidate


async def get_upcoming_dates(
    db: AsyncSession,
    days_ahead: int = 7,
    rm_id: UUID | None = None,
) -> list[UpcomingDateItem]:
    """Return upcoming birthdays and important dates within *days_ahead* days.

    If *rm_id* is provided, only clients assigned to that RM are returned.
    """
    today = datetime.now(UTC).date()

    stmt = select(ClientProfile)
    if rm_id is not None:
        stmt = stmt.where(ClientProfile.assigned_rm_id == rm_id)
    # Only consider approved clients that have an RM assigned
    stmt = stmt.where(ClientProfile.assigned_rm_id.isnot(None))

    result = await db.execute(stmt)
    profiles = result.scalars().all()

    items: list[UpcomingDateItem] = []

    for profile in profiles:
        assert profile.assigned_rm_id is not None  # narrowing — guaranteed by query

        client_name = profile.display_name or profile.legal_name

        # ── Birthday ──────────────────────────────────────────────────────────
        if profile.birth_date is not None and profile.birthday_reminders_enabled:
            days_until, occurs_on = _days_until_next_occurrence(
                profile.birth_date.month,
                profile.birth_date.day,
                today,
            )
            if 0 <= days_until <= days_ahead:
                birth_year = profile.birth_date.year
                years_since = occurs_on.year - birth_year if birth_year else None
                items.append(
                    UpcomingDateItem(
                        client_id=profile.id,
                        client_name=client_name,
                        rm_id=profile.assigned_rm_id,
                        date_type="birthday",
                        label="Birthday",
                        days_until=days_until,
                        occurs_on=occurs_on,
                        years_since=years_since,
                    )
                )

        # ── Important dates ───────────────────────────────────────────────────
        if profile.important_dates:
            for entry in profile.important_dates:
                try:
                    month = int(entry["month"])
                    day = int(entry["day"])
                    label = str(entry.get("label", "Date"))
                    year = entry.get("year")
                except (KeyError, TypeError, ValueError):
                    logger.warning(
                        "Skipping malformed important_date entry for client %s: %s",
                        profile.id,
                        entry,
                    )
                    continue

                days_until, occurs_on = _days_until_next_occurrence(month, day, today)
                if 0 <= days_until <= days_ahead:
                    years_since = (occurs_on.year - int(year)) if year else None
                    items.append(
                        UpcomingDateItem(
                            client_id=profile.id,
                            client_name=client_name,
                            rm_id=profile.assigned_rm_id,
                            date_type=label,
                            label=label,
                            days_until=days_until,
                            occurs_on=occurs_on,
                            years_since=years_since,
                        )
                    )

    items.sort(key=lambda x: x.days_until)
    return items


async def send_date_reminders(db: AsyncSession, days_ahead: int = 7) -> None:  # noqa: PLR0912
    """Send in-portal notifications for all upcoming client dates.

    Deduplication: if a notification with the same title prefix was already
    sent to the same user today, skip it.
    """
    items = await get_upcoming_dates(db, days_ahead=days_ahead)
    today = datetime.now(UTC).date()

    for item in items:
        if item.date_type == "birthday":
            title = f"🎂 Birthday: {item.client_name}"
        else:
            title = f"📅 {item.label}: {item.client_name}"

        # Deduplication — check for existing notification with same title sent today
        from sqlalchemy import func as sa_func

        from app.models.notification import Notification

        dup_result = await db.execute(
            select(Notification).where(
                Notification.user_id == item.rm_id,
                Notification.title == title,
                sa_func.date(Notification.created_at) == today,
            )
        )
        if dup_result.scalar_one_or_none() is not None:
            logger.debug(
                "Skipping duplicate date reminder for %s / %s",
                item.rm_id,
                title,
            )
            continue

        if item.days_until == 0:
            when_text = "today"
        elif item.days_until == 1:
            when_text = "tomorrow"
        else:
            when_text = f"in {item.days_until} days (on {item.occurs_on.strftime('%B %d')})"

        if item.date_type == "birthday":
            if item.years_since is not None:
                body = (
                    f"{item.client_name} turns {item.years_since} {when_text}. "
                    "Consider sending a personalised message."
                )
            else:
                body = (
                    f"{item.client_name}'s birthday is {when_text}. "
                    "Consider sending a personalised message."
                )
        elif item.years_since is not None:
            body = (
                f"{item.label} for {item.client_name} is {when_text} "
                f"({item.years_since} year{'s' if item.years_since != 1 else ''} ago)."
            )
        else:
            body = f"{item.label} for {item.client_name} is {when_text}."

        try:
            await notification_service.create_notification(
                db,
                CreateNotificationRequest(
                    user_id=item.rm_id,
                    notification_type="system",
                    title=title,
                    body=body,
                    priority="normal",
                    entity_type="client",
                    entity_id=item.client_id,
                ),
            )
            logger.info(
                "Sent date reminder to RM %s for client %s (%s)",
                item.rm_id,
                item.client_id,
                title,
            )
        except Exception:
            logger.exception("Failed to send date reminder for client %s", item.client_id)
