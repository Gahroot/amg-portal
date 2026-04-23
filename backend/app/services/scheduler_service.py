"""Background job scheduler using APScheduler."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.services.jobs import (
    _alert_audit_chain_break,
    _auto_progress_escalations_job,
    _check_capability_review_reminders_job,
    _check_client_dates_job,
    _check_data_retention_job,
    _check_document_expiry_job,
    _check_escalation_deadlines_job,
    _check_escalation_triggers_job,
    _check_kyc_expiry_job,
    _check_milestone_risks_job,
    _check_partner_performance_trend_alerts_job,
    _check_partner_threshold_alerts_job,
    _check_sla_breaches_job,
    _cleanup_expired_refresh_tokens_job,
    _encrypted_backup_job,
    _mark_overdue_document_requests_job,
    _process_message_digests_job,
    _process_queued_notifications_job,
    _process_recurring_tasks_job,
    _process_report_schedules_job,
    _quarterly_audit_reminder_job,
    _run_predictive_alerts_job,
    _send_daily_digests_job,
    _send_event_reminders_job,
    _send_milestone_reminder_notifications_job,
    _send_weekly_digests_job,
    _send_weekly_status_reports_job,
    _sign_audit_chain_job,
    _verify_audit_chain_job,
)

__all__ = [
    "_alert_audit_chain_break",
    "_auto_progress_escalations_job",
    "_check_capability_review_reminders_job",
    "_check_client_dates_job",
    "_check_data_retention_job",
    "_check_document_expiry_job",
    "_check_escalation_deadlines_job",
    "_check_escalation_triggers_job",
    "_check_kyc_expiry_job",
    "_check_milestone_risks_job",
    "_check_partner_performance_trend_alerts_job",
    "_check_partner_threshold_alerts_job",
    "_check_sla_breaches_job",
    "_cleanup_expired_refresh_tokens_job",
    "_encrypted_backup_job",
    "_mark_overdue_document_requests_job",
    "_process_message_digests_job",
    "_process_queued_notifications_job",
    "_process_recurring_tasks_job",
    "_process_report_schedules_job",
    "_quarterly_audit_reminder_job",
    "_run_predictive_alerts_job",
    "_send_daily_digests_job",
    "_send_event_reminders_job",
    "_send_milestone_reminder_notifications_job",
    "_send_weekly_digests_job",
    "_send_weekly_status_reports_job",
    "_sign_audit_chain_job",
    "_verify_audit_chain_job",
    "start_scheduler",
    "stop_scheduler",
]

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> AsyncIOScheduler | None:
    """Create, configure, and start the background scheduler."""
    global _scheduler  # noqa: PLW0603

    if not settings.SCHEDULER_ENABLED:
        logger.info("Scheduler is disabled via SCHEDULER_ENABLED=False")
        return None

    _scheduler = AsyncIOScheduler()

    _scheduler.add_job(
        _check_sla_breaches_job,
        "interval",
        minutes=settings.SLA_CHECK_INTERVAL_MINUTES,
        id="check_sla_breaches",
        name="Check SLA breaches",
        replace_existing=True,
    )

    _scheduler.add_job(
        _check_milestone_risks_job,
        "interval",
        minutes=settings.MILESTONE_RISK_CHECK_INTERVAL_MINUTES,
        id="check_milestone_risks",
        name="Check milestone risks",
        replace_existing=True,
    )

    _scheduler.add_job(
        _send_daily_digests_job,
        "cron",
        hour=settings.DIGEST_HOUR_UTC,
        minute=0,
        id="send_daily_digests",
        name="Send daily digests",
        replace_existing=True,
    )

    _scheduler.add_job(
        _send_weekly_digests_job,
        "cron",
        day_of_week="mon",
        hour=settings.DIGEST_HOUR_UTC,
        minute=0,
        id="send_weekly_digests",
        name="Send weekly digests",
        replace_existing=True,
    )

    _scheduler.add_job(
        _send_weekly_status_reports_job,
        "cron",
        day_of_week="fri",
        hour=14,
        minute=0,
        id="send_weekly_status_reports",
        name="Send weekly status reports",
        replace_existing=True,
    )

    _scheduler.add_job(
        _check_partner_threshold_alerts_job,
        "cron",
        hour=9,
        minute=0,
        id="check_partner_threshold_alerts",
        name="Check partner threshold alerts",
        replace_existing=True,
    )

    _scheduler.add_job(
        _process_report_schedules_job,
        "cron",
        hour=6,
        minute=0,
        id="process_report_schedules",
        name="Process scheduled reports",
        replace_existing=True,
    )

    _scheduler.add_job(
        _check_capability_review_reminders_job,
        "cron",
        hour=8,
        minute=0,
        id="check_capability_review_reminders",
        name="Check capability review reminders",
        replace_existing=True,
    )

    _scheduler.add_job(
        _quarterly_audit_reminder_job,
        "cron",
        day=1,
        hour=9,
        minute=0,
        id="quarterly_audit_reminder",
        name="Quarterly audit reminder",
        replace_existing=True,
    )

    _scheduler.add_job(
        _check_data_retention_job,
        "cron",
        hour=7,
        minute=0,
        id="check_data_retention",
        name="Check data retention / archival",
        replace_existing=True,
    )

    _scheduler.add_job(
        _check_kyc_expiry_job,
        "cron",
        hour=6,
        minute=30,
        id="check_kyc_expiry",
        name="Check KYC document expiry",
        replace_existing=True,
    )

    _scheduler.add_job(
        _run_predictive_alerts_job,
        "cron",
        hour=7,
        minute=0,
        id="run_predictive_alerts",
        name="Run predictive alerts",
        replace_existing=True,
    )

    _scheduler.add_job(
        _check_escalation_triggers_job,
        "interval",
        minutes=15,
        id="check_escalation_triggers",
        name="Check escalation auto-triggers",
        replace_existing=True,
    )

    _scheduler.add_job(
        _check_escalation_deadlines_job,
        "interval",
        minutes=15,
        id="check_escalation_deadlines",
        name="Check milestone deadlines and SLA breach escalations",
        replace_existing=True,
    )

    _scheduler.add_job(
        _auto_progress_escalations_job,
        "interval",
        minutes=15,
        id="auto_progress_escalations",
        name="Auto-progress overdue escalations to next level",
        replace_existing=True,
    )

    _scheduler.add_job(
        _process_message_digests_job,
        "interval",
        minutes=60,
        id="process_message_digests",
        name="Process message digests (hourly check)",
        replace_existing=True,
    )

    _scheduler.add_job(
        _send_event_reminders_job,
        "interval",
        minutes=5,
        id="event_reminders",
        name="Send event reminders",
        replace_existing=True,
    )

    _scheduler.add_job(
        _process_queued_notifications_job,
        "interval",
        minutes=15,
        id="process_queued_notifications",
        name="Process queued notifications (quiet hours)",
        replace_existing=True,
    )

    _scheduler.add_job(
        _check_client_dates_job,
        "cron",
        hour=7,
        minute=30,
        id="check_client_dates",
        name="Check client birthdays and important dates",
        replace_existing=True,
    )

    _scheduler.add_job(
        _check_document_expiry_job,
        "cron",
        hour=8,
        minute=0,
        id="check_document_expiry",
        name="Check document expiry (passport, visa, certification)",
        replace_existing=True,
    )

    _scheduler.add_job(
        _send_milestone_reminder_notifications_job,
        "cron",
        hour=8,
        minute=30,
        id="send_milestone_reminder_notifications",
        name="Send milestone reminder notifications",
        replace_existing=True,
    )

    _scheduler.add_job(
        _check_partner_performance_trend_alerts_job,
        "cron",
        hour=9,
        minute=0,
        id="check_partner_performance_trend_alerts",
        name="Check partner performance trend alerts",
        replace_existing=True,
    )

    _scheduler.add_job(
        _process_recurring_tasks_job,
        "cron",
        hour=0,
        minute=5,
        id="process_recurring_tasks",
        name="Process recurring task templates",
        replace_existing=True,
    )

    _scheduler.add_job(
        _mark_overdue_document_requests_job,
        "cron",
        hour=0,
        minute=30,
        id="mark_overdue_document_requests",
        name="Mark overdue document requests",
        replace_existing=True,
    )

    _scheduler.add_job(
        _cleanup_expired_refresh_tokens_job,
        "cron",
        hour=3,
        minute=0,
        id="cleanup_expired_refresh_tokens",
        name="Cleanup expired refresh tokens",
        replace_existing=True,
    )

    _scheduler.add_job(
        _sign_audit_chain_job,
        "cron",
        hour=0,
        minute=5,
        id="sign_audit_chain",
        name="Sign yesterday's audit-log Merkle chain",
        replace_existing=True,
    )

    _scheduler.add_job(
        _verify_audit_chain_job,
        "cron",
        hour=0,
        minute=15,
        id="verify_audit_chain",
        name="Verify yesterday's audit-log chain + a random prior day",
        replace_existing=True,
    )

    _scheduler.add_job(
        _encrypted_backup_job,
        "cron",
        hour=3,
        minute=30,
        id="encrypted_backup",
        name="Encrypted off-platform Postgres backup",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("Scheduler started with %d jobs", len(_scheduler.get_jobs()))
    return _scheduler


def stop_scheduler(
    scheduler: AsyncIOScheduler | None,
) -> None:
    """Shut down the scheduler gracefully."""
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
