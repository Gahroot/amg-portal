"""Digest sending and queued notification processing."""

import logging
import uuid
from collections import defaultdict

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.user import User
from app.services.notification_delivery import build_push_data, send_immediate_notification_email
from app.services.notification_preferences import (
    get_or_create_preferences,
    get_snoozed_notifications,
    process_expired_snoozes,
)
from app.services.push_service import push_service

logger = logging.getLogger(__name__)


async def send_digest(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> None:
    """Send email digest for a user based on their preferences.

    Only includes notifications that have not already been emailed (i.e.
    those not delivered via the ``immediate`` channel), regardless of
    whether the user has already read them in the portal.
    """
    prefs = await get_or_create_preferences(db, user_id)

    if not prefs.digest_enabled or prefs.digest_frequency == "never":
        return

    result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.email_delivered == False,  # noqa: E712
        )
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    notifications = list(result.scalars().all())

    if not notifications:
        return

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user:
        notifications_data = [
            {
                "id": str(n.id),
                "notification_type": n.notification_type,
                "title": n.title,
            }
            for n in notifications
        ]
        from app.services.email_service import send_notification_digest

        await send_notification_digest(
            email=user.email,
            notifications=notifications_data,
            portal_url=settings.FRONTEND_URL,
        )

    for notif in notifications:
        notif.email_delivered = True

    await db.commit()


async def process_queued_notifications(  # noqa: PLR0912, PLR0915
    db: AsyncSession,
    limit: int = 100,
) -> tuple[int, int]:
    """Process all queued notifications for delivery.

    This runs periodically (every 15 minutes by default) to check for any
    users with queued notifications and deliver them when they exit quiet hours.

    Args:
        db: Database session
        limit: Maximum number of notifications to process per batch

    Returns:
        Tuple with count of processed push, count of processed emails
    """
    result = await db.execute(
        select(Notification)
        .where(
            or_(
                Notification.push_queued == True,  # noqa: E712
                Notification.email_queued == True,  # noqa: E712
            )
        )
        .limit(limit)
    )

    notifications = list(result.scalars().all())

    if not notifications:
        logger.info("No queued notifications found")
        return 0, 0

    user_notifications: dict[uuid.UUID, list[Notification]] = defaultdict(list)
    for notification in notifications:
        user_notifications[notification.user_id].append(notification)

    user_prefs: dict[uuid.UUID, NotificationPreference] = {}
    for uid in user_notifications:
        try:
            prefs = await get_or_create_preferences(db, uid)
            if prefs is None:
                continue
            user_prefs[uid] = prefs
        except Exception:
            logger.exception("Failed to get preferences for user %s", uid)
            continue

    processed_push = 0
    processed_email = 0
    skipped = 0

    for uid, user_notifs in user_notifications.items():
        user_pref = user_prefs.get(uid)
        if user_pref is None:
            continue

        in_quiet_hours = push_service.is_in_quiet_hours(
            user_pref.quiet_hours_enabled,
            user_pref.quiet_hours_start,
            user_pref.quiet_hours_end,
            user_pref.timezone or "UTC",
        )

        if in_quiet_hours:
            logger.debug("User %s still in quiet hours, skipping", uid)
            skipped += len(user_notifs)
            continue

        for notification in user_notifs:
            try:
                channel_prefs = user_pref.channel_preferences or {}

                if notification.push_queued and channel_prefs.get("push", True):
                    deep_link = push_service.generate_deep_link(
                        notification.entity_type,
                        notification.entity_id,
                    )
                    sent_push = await push_service.send_push_notification(
                        db,
                        user_id=notification.user_id,
                        title=notification.title,
                        body=notification.body,
                        data=build_push_data(notification, deep_link),
                        preferences=user_pref,
                    )
                    if sent_push:
                        notification.push_queued = False
                        processed_push += 1
                        logger.info(
                            "Push delivered for queued notification %s",
                            notification.id,
                        )

                if notification.email_queued and channel_prefs.get("email", True):
                    await send_immediate_notification_email(db, notification)
                    notification.email_queued = False
                    notification.email_delivered = True
                    processed_email += 1
                    logger.info(
                        "Email delivered for queued notification %s",
                        notification.id,
                    )
            except Exception:
                logger.exception(
                    "Failed to deliver queued notification %s",
                    notification.id,
                )

        await db.commit()

    logger.info(
        "Processed queued: %d push, %d email, %d skipped (quiet hours)",
        processed_push,
        processed_email,
        skipped,
    )
    return processed_push, processed_email


__all__ = [
    "get_snoozed_notifications",
    "process_expired_snoozes",
    "process_queued_notifications",
    "send_digest",
]
