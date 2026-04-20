"""Notification and digest background jobs."""

import logging

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.middleware.audit import with_system_audit_context
from app.models.notification_preference import NotificationPreference
from app.services.client_dates_service import send_date_reminders
from app.services.digest_service import process_all_digests
from app.services.milestone_reminder_service import send_milestone_reminders_scoped
from app.services.notification_service import notification_service
from app.services.scheduling_service import send_reminders

logger = logging.getLogger(__name__)


async def _send_digests_for_frequency(frequency: str) -> None:
    """Send digest emails to all users with the given digest frequency."""
    logger.info("Running %s digest job", frequency)
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(NotificationPreference.user_id).where(
                    NotificationPreference.digest_enabled.is_(True),
                    NotificationPreference.digest_frequency == frequency,
                )
            )
            user_ids = result.scalars().all()

        for user_id in user_ids:
            try:
                async with AsyncSessionLocal() as db:
                    await notification_service.send_digest(db, user_id)
            except Exception:
                logger.exception("Error sending %s digest for user %s", frequency, user_id)

        logger.info(
            "%s digest complete — %d users processed", frequency.capitalize(), len(user_ids)
        )
    except Exception:
        logger.exception("Error in %s digest job", frequency)


@with_system_audit_context
async def _send_daily_digests_job() -> None:
    """Daily job: send digest emails to users with daily frequency."""
    await _send_digests_for_frequency("daily")


@with_system_audit_context
async def _send_weekly_digests_job() -> None:
    """Weekly job: send digest emails to users with weekly frequency."""
    await _send_digests_for_frequency("weekly")


@with_system_audit_context
async def _process_message_digests_job() -> None:
    """Hourly job: process message digests for users with hourly frequency.

    Also checks if daily/weekly digests are due based on last_digest_sent_at
    for users who may have been missed by the cron-based notification digest.
    """

    logger.info("Running message digest processing job")
    try:
        async with AsyncSessionLocal() as db:
            sent = await process_all_digests(db, "hourly")
            logger.info("Hourly message digests complete — %d sent", sent)
    except Exception:
        logger.exception("Error in message digest processing job")


@with_system_audit_context
async def _process_queued_notifications_job() -> None:
    """Periodic job: process queued notifications when users exit quiet hours.

    Runs every 15 minutes to deliver push and email notifications that were
    queued because the user was in their configured quiet hours window.
    """
    logger.info("Running queued notifications processing job")
    try:
        async with AsyncSessionLocal() as db:
            result = await notification_service.process_queued_notifications(db, limit=500)
            processed_push, processed_email = result
            logger.info(
                "Queued notifications processed — %d push, %d email",
                processed_push,
                processed_email,
            )
    except Exception:
        logger.exception("Error in queued notifications processing job")


@with_system_audit_context
async def _send_event_reminders_job() -> None:
    """Periodic job: send reminders for upcoming scheduled events."""
    logger.info("Running event reminders job")
    try:
        async with AsyncSessionLocal() as db:
            count = await send_reminders(db)
            logger.info("Event reminders job complete — %d reminders sent", count)
    except Exception:
        logger.exception("Error in event reminders job")


@with_system_audit_context
async def _check_client_dates_job() -> None:
    """Daily job: send birthday and important date reminders to RMs (7-day lookahead)."""
    logger.info("Running client dates reminder job")
    try:
        async with AsyncSessionLocal() as db:
            await send_date_reminders(db, days_ahead=7)
        logger.info("Client dates reminder job complete")
    except Exception:
        logger.exception("Error in client dates reminder job")


@with_system_audit_context
async def _send_milestone_reminder_notifications_job() -> None:
    """Daily job: send milestone due-date reminders to portal client users.

    Runs once per day at 8:30 AM UTC. For each portal-enabled client user,
    checks upcoming milestones and sends reminders via their configured
    channels (email, in-app, push) on their configured lead days (default: 7 and 1).

    Quiet hours are respected: email/push reminders are skipped for users
    in their configured quiet window.
    """
    logger.info("Running milestone reminder notifications job")
    try:
        async with AsyncSessionLocal() as db:
            sent = await send_milestone_reminders_scoped(db)
        logger.info("Milestone reminder job complete — %d reminders sent", sent)
    except Exception:
        logger.exception("Error in milestone reminder notifications job")
