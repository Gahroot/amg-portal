"""Preferences and snooze management for notifications."""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.schemas.notification import NotificationPreferenceUpdate, SnoozeRequest

logger = logging.getLogger(__name__)

# Maximum number of times a notification can be snoozed
MAX_SNOOZE_COUNT = 3


async def get_or_create_preferences(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> NotificationPreference:
    """Get or create notification preferences for a user."""
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = NotificationPreference(
            user_id=user_id,
            digest_enabled=True,
            digest_frequency="daily",
            notification_type_preferences={},
            channel_preferences={"in_portal": True, "email": True, "push": True},
        )
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return prefs


async def update_preferences(
    db: AsyncSession,
    user_id: uuid.UUID,
    update_data: NotificationPreferenceUpdate,
) -> NotificationPreference:
    """Update notification preferences for a user."""
    prefs = await get_or_create_preferences(db, user_id)
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(prefs, field, value)
    await db.commit()
    await db.refresh(prefs)
    return prefs


def calculate_snooze_until(  # noqa: PLR0911
    snooze_duration_minutes: int | None,
    snooze_until: datetime | None,
    user_timezone: str = "UTC",
) -> datetime:
    """Calculate the snooze_until datetime based on duration or explicit time.

    Args:
        snooze_duration_minutes: Duration in minutes (e.g., 60 for 1 hour)
        snooze_until: Explicit datetime to snooze until
        user_timezone: User's timezone for relative calculations

    Returns:
        The calculated snooze_until datetime in UTC
    """
    now_utc = datetime.now(UTC)

    if snooze_until:
        return snooze_until

    if snooze_duration_minutes is None:
        snooze_duration_minutes = 60

    if snooze_duration_minutes == 60:
        return now_utc + timedelta(hours=1)
    elif snooze_duration_minutes == 240:
        return now_utc + timedelta(hours=4)
    elif snooze_duration_minutes == 1440:  # Tomorrow morning (9 AM)
        tz = ZoneInfo(user_timezone)
        now_local = datetime.now(tz)
        tomorrow = now_local + timedelta(days=1)
        tomorrow_9am = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
        return tomorrow_9am.astimezone(UTC)
    elif snooze_duration_minutes == 1441:  # Tomorrow afternoon (2 PM)
        tz = ZoneInfo(user_timezone)
        now_local = datetime.now(tz)
        tomorrow = now_local + timedelta(days=1)
        tomorrow_2pm = tomorrow.replace(hour=14, minute=0, second=0, microsecond=0)
        return tomorrow_2pm.astimezone(UTC)
    elif snooze_duration_minutes == 10080:  # Next week (Monday 9 AM)
        tz = ZoneInfo(user_timezone)
        now_local = datetime.now(tz)
        days_until_monday = (7 - now_local.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        next_monday = now_local + timedelta(days=days_until_monday)
        next_monday_9am = next_monday.replace(hour=9, minute=0, second=0, microsecond=0)
        return next_monday_9am.astimezone(UTC)
    else:
        return now_utc + timedelta(minutes=snooze_duration_minutes)


async def snooze_notification(
    db: AsyncSession,
    notification_id: uuid.UUID,
    user_id: uuid.UUID,
    snooze_request: SnoozeRequest,
    user_timezone: str = "UTC",
) -> Notification:
    """Snooze a notification until a specified time.

    Args:
        db: Database session
        notification_id: ID of the notification to snooze
        user_id: ID of the user who owns the notification
        snooze_request: Request containing snooze duration or explicit time
        user_timezone: User's timezone for relative calculations

    Returns:
        The updated notification

    Raises:
        NotFoundException: If notification doesn't exist
        ValueError: If max snooze count exceeded
    """
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        from app.core.exceptions import NotFoundException

        raise NotFoundException("Notification not found")

    if notification.snooze_count >= MAX_SNOOZE_COUNT:
        raise ValueError(f"Notification has been snoozed the maximum of {MAX_SNOOZE_COUNT} times")

    snooze_until_dt = calculate_snooze_until(
        snooze_duration_minutes=snooze_request.snooze_duration_minutes,
        snooze_until=snooze_request.snooze_until,
        user_timezone=user_timezone,
    )

    notification.snoozed_until = snooze_until_dt
    notification.snooze_count += 1

    await db.commit()
    await db.refresh(notification)

    logger.info(
        "Snoozed notification %s until %s (count: %d)",
        notification_id,
        snooze_until_dt,
        notification.snooze_count,
    )

    return notification


async def unsnooze_notification(
    db: AsyncSession,
    notification_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Notification:
    """Unsnooze a notification immediately.

    Args:
        db: Database session
        notification_id: ID of the notification to unsnooze
        user_id: ID of the user who owns the notification

    Returns:
        The updated notification

    Raises:
        NotFoundException: If notification doesn't exist
    """
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        from app.core.exceptions import NotFoundException

        raise NotFoundException("Notification not found")

    notification.snoozed_until = None

    await db.commit()
    await db.refresh(notification)

    logger.info("Unsnoozed notification %s", notification_id)

    return notification


async def get_snoozed_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Notification], int]:
    """Get all currently snoozed notifications for a user.

    Args:
        db: Database session
        user_id: User ID
        skip: Pagination offset
        limit: Maximum results

    Returns:
        Tuple of (snoozed notifications, total count)
    """
    now_utc = datetime.now(UTC)

    query = (
        select(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.snoozed_until.is_not(None),
            Notification.snoozed_until > now_utc,
        )
        .order_by(Notification.snoozed_until.asc())
    )

    count_query = (
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.snoozed_until.is_not(None),
            Notification.snoozed_until > now_utc,
        )
    )

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(query.offset(skip).limit(limit))
    notifications = list(result.scalars().all())

    return notifications, total


async def process_expired_snoozes(
    db: AsyncSession,
    limit: int = 100,
) -> int:
    """Process notifications whose snooze period has expired.

    This should be called periodically by a background job to unsnooze
    notifications that have reached their snooze_until time.

    Args:
        db: Database session
        limit: Maximum notifications to process per batch

    Returns:
        Number of notifications unsnoozed
    """
    now_utc = datetime.now(UTC)

    result = await db.execute(
        select(Notification)
        .where(
            Notification.snoozed_until.is_not(None),
            Notification.snoozed_until <= now_utc,
        )
        .limit(limit)
    )

    notifications = list(result.scalars().all())
    unsnoozed_count = 0

    for notification in notifications:
        notification.snoozed_until = None
        unsnoozed_count += 1
        logger.info(
            "Auto-unsnoozed notification %s for user %s",
            notification.id,
            notification.user_id,
        )

    if notifications:
        await db.commit()

    return unsnoozed_count
