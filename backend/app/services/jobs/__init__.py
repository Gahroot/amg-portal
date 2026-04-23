"""Background job modules for the APScheduler.

Each module owns the job functions for its domain. The scheduler_service
imports from here and registers jobs with APScheduler.
"""

from app.services.jobs._compliance_jobs import (
    _check_capability_review_reminders_job,
    _check_data_retention_job,
    _check_document_expiry_job,
    _check_kyc_expiry_job,
    _check_partner_threshold_alerts_job,
    _mark_overdue_document_requests_job,
    _quarterly_audit_reminder_job,
)
from app.services.jobs._escalation_jobs import (
    _auto_progress_escalations_job,
    _check_escalation_deadlines_job,
    _check_escalation_triggers_job,
)
from app.services.jobs._misc_jobs import (
    _alert_audit_chain_break,
    _check_partner_performance_trend_alerts_job,
    _cleanup_expired_refresh_tokens_job,
    _encrypted_backup_job,
    _process_recurring_tasks_job,
    _run_predictive_alerts_job,
    _sign_audit_chain_job,
    _verify_audit_chain_job,
)
from app.services.jobs._notification_jobs import (
    _check_client_dates_job,
    _process_message_digests_job,
    _process_queued_notifications_job,
    _send_daily_digests_job,
    _send_event_reminders_job,
    _send_milestone_reminder_notifications_job,
    _send_weekly_digests_job,
)
from app.services.jobs._report_jobs import (
    _process_report_schedules_job,
    _send_weekly_status_reports_job,
)
from app.services.jobs._sla_jobs import (
    _check_milestone_risks_job,
    _check_sla_breaches_job,
)

__all__ = [
    # SLA
    "_check_sla_breaches_job",
    "_check_milestone_risks_job",
    # Escalation
    "_check_escalation_triggers_job",
    "_check_escalation_deadlines_job",
    "_auto_progress_escalations_job",
    # Notification / digest
    "_send_daily_digests_job",
    "_send_weekly_digests_job",
    "_process_message_digests_job",
    "_process_queued_notifications_job",
    "_send_event_reminders_job",
    "_check_client_dates_job",
    "_send_milestone_reminder_notifications_job",
    # Report
    "_send_weekly_status_reports_job",
    "_process_report_schedules_job",
    # Compliance / governance
    "_check_partner_threshold_alerts_job",
    "_check_capability_review_reminders_job",
    "_quarterly_audit_reminder_job",
    "_check_data_retention_job",
    "_check_kyc_expiry_job",
    "_check_document_expiry_job",
    "_mark_overdue_document_requests_job",
    # Misc
    "_run_predictive_alerts_job",
    "_check_partner_performance_trend_alerts_job",
    "_process_recurring_tasks_job",
    "_cleanup_expired_refresh_tokens_job",
    # Audit chain
    "_sign_audit_chain_job",
    "_verify_audit_chain_job",
    "_alert_audit_chain_break",
    "_encrypted_backup_job",
]
