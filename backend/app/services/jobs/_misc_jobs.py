"""Miscellaneous background jobs: predictive alerts, recurring tasks, auth cleanup, audit chain."""

import logging
import os
import random
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.core.audit_chain import sign_day, verify_day
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.middleware.audit import with_system_audit_context
from app.models.enums import UserRole
from app.models.program import Program
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.notification import CreateNotificationRequest
from app.services.notification_service import notification_service
from app.services.partner_alert_service import run_partner_performance_alerts
from app.services.predictive_service import get_at_risk_milestones
from app.services.recurring_task_service import process_due_templates

logger = logging.getLogger(__name__)


@with_system_audit_context
async def _run_predictive_alerts_job() -> None:
    """Periodic job: run predictive risk scoring and notify RMs of at-risk milestones."""
    logger.info("Running predictive alerts job")
    try:
        async with AsyncSessionLocal() as db:
            at_risk = await get_at_risk_milestones(db)
            if not at_risk:
                logger.info("No at-risk milestones found by predictive alerts")
                return

            logger.info("Predictive alerts found %d at-risk milestones", len(at_risk))

            # Deduplicate by program and bulk-fetch programs + clients in one query
            program_ids: list[UUID] = list({risk.program_id for risk in at_risk})
            result = await db.execute(
                select(Program)
                .options(selectinload(Program.client))
                .where(Program.id.in_(program_ids))
            )
            programs_by_id = {p.id: p for p in result.scalars().all()}

            programs_notified: set[UUID] = set()
            for risk in at_risk:
                if risk.program_id in programs_notified:
                    continue

                program = programs_by_id.get(risk.program_id)
                if not program or not program.client or not program.client.rm_id:
                    continue

                programs_notified.add(risk.program_id)
                await notification_service.create_notification(
                    db,
                    CreateNotificationRequest(
                        user_id=program.client.rm_id,
                        notification_type="milestone_risk",
                        title="Predictive Alert: At-Risk Milestone",
                        body=(
                            f"Program '{risk.program_title}' has milestone "
                            f"'{risk.milestone_title}' with risk score {risk.risk_score}. "
                            f"Risk factors: {', '.join(risk.risk_factors)}"
                        ),
                        priority="high" if risk.risk_score >= 85 else "medium",
                        action_url=f"/programs/{risk.program_id}",
                        action_label="View Program",
                    ),
                )

            await db.commit()
            logger.info("Predictive alerts sent for %d programs", len(programs_notified))
    except Exception:
        logger.exception("Error running predictive alerts job")


@with_system_audit_context
async def _check_partner_performance_trend_alerts_job() -> None:
    """Daily job: check partner performance metrics vs thresholds and alert on declining trends."""
    logger.info("Running partner performance trend alerts job")
    try:
        async with AsyncSessionLocal() as db:
            result = await run_partner_performance_alerts(db)
        logger.info(
            "Partner performance trend alerts complete — "
            "%d partners checked, %d with alerts, %d MD notifications, %d emails sent, %d errors",
            result["partners_checked"],
            result["partners_with_alerts"],
            result["md_notifications_sent"],
            result["emails_sent"],
            result["errors"],
        )
    except Exception:
        logger.exception("Error in partner performance trend alerts job")


@with_system_audit_context
async def _process_recurring_tasks_job() -> None:
    """Daily job: process recurring task templates and generate due tasks."""
    logger.info("Running recurring task processing job")
    try:
        async with AsyncSessionLocal() as db:
            count = await process_due_templates(db)
            logger.info("Recurring task processing complete — %d tasks created", count)
    except Exception:
        logger.exception("Error processing recurring tasks")


@with_system_audit_context
async def _cleanup_expired_refresh_tokens_job() -> None:
    """Delete expired refresh tokens to keep the table lean."""
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                delete(RefreshToken).where(RefreshToken.expires_at < datetime.now(UTC))
            )
            await db.commit()
            count: int = result.rowcount  # type: ignore[attr-defined]
        if count:
            logger.info("Cleaned up %d expired refresh tokens", count)
    except Exception:
        logger.exception("Error cleaning up expired refresh tokens")


@with_system_audit_context
async def _sign_audit_chain_job() -> None:
    """Daily job (00:05 UTC): Merkle-sign yesterday's audit-log chain.

    Produces an Ed25519 signature over the SHA-256 Merkle root of every
    audit_logs row_hash for the UTC day that just ended, anchored with a
    FreeTSA RFC-3161 token.  Idempotent — a second invocation for the same
    day is a no-op if the checkpoint already exists.
    """
    yesterday = (datetime.now(UTC) - timedelta(days=1)).date()
    logger.info("Running audit-chain sign job for %s", yesterday)
    try:
        async with AsyncSessionLocal() as db:
            checkpoint = await sign_day(yesterday, db)
            if checkpoint is None:
                logger.info("Audit-chain sign: no rows for %s", yesterday)
            else:
                logger.info(
                    "Audit-chain sign complete for %s (tsa=%s)",
                    yesterday,
                    "ok" if checkpoint.tsa_token else f"fail({checkpoint.tsa_error})",
                )
    except Exception:
        logger.exception("Error in audit-chain sign job")


async def _alert_audit_chain_break(target_day: date, reason: str) -> None:
    """Surface a chain-break to the compliance team via in-portal notification.

    Logged loudly first so alerting failures can't hide the underlying
    detection event.
    """
    logger.error(
        "Audit chain verification FAILED for %s: %s",
        target_day,
        reason,
    )
    try:
        async with AsyncSessionLocal() as db:
            md_result = await db.execute(
                select(User.id).where(
                    User.role.in_(
                        [
                            UserRole.managing_director.value,
                            UserRole.finance_compliance.value,
                        ]
                    ),
                    User.status == "active",
                )
            )
            recipient_ids = list(md_result.scalars().all())

            for user_id in recipient_ids:
                try:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=user_id,
                            notification_type="system",
                            title=f"AUDIT CHAIN TAMPER DETECTED — {target_day}",
                            body=(
                                "The daily audit-log chain verification for "
                                f"{target_day} failed with reason: {reason}. "
                                "Investigate immediately — do not run any "
                                "remediation scripts until the cause is "
                                "identified."
                            ),
                            priority="urgent",
                        ),
                    )
                except Exception:
                    logger.exception(
                        "Failed to create chain-break alert notification for user %s",
                        user_id,
                    )
    except Exception:
        logger.exception("Failed to dispatch chain-break alerts")


@with_system_audit_context
async def _verify_audit_chain_job() -> None:
    """Daily job (00:15 UTC): verify yesterday + a random prior day.

    Running on a rolling random past day gives continuous assurance without
    the cost of a full-history re-verification every night.  Any failure
    triggers an in-portal + log alert to the MD/Compliance recipients.
    """
    now = datetime.now(UTC)
    yesterday = (now - timedelta(days=1)).date()
    start_cutoff = settings.AUDIT_CHAIN_START_AT or yesterday
    logger.info("Running audit-chain verify job for %s", yesterday)

    days_to_check: list[date] = [yesterday]
    window_days = (yesterday - start_cutoff).days
    if window_days > 1:
        offset = random.randint(1, window_days)
        random_day = yesterday - timedelta(days=offset)
        days_to_check.append(random_day)

    try:
        async with AsyncSessionLocal() as db:
            for day in days_to_check:
                ok, reason = await verify_day(day, db)
                if not ok:
                    await _alert_audit_chain_break(day, reason or "unknown")
                else:
                    logger.info("Audit-chain verify OK for %s", day)
    except Exception:
        logger.exception("Error in audit-chain verify job")


async def _encrypted_backup_job() -> None:
    """Phase 3.12 — nightly `pg_dump | age` to off-platform S3-compatible bucket.

    Gated by ``BACKUP_ENABLED=true`` so dev / CI / preview envs never run it.
    """
    if os.environ.get("BACKUP_ENABLED", "false").lower() != "true":
        return
    try:
        from scripts.backup_encrypted import run as run_backup

        result = await run_backup()
        logger.info(
            "backup.completed",
            extra={"event": "backup.completed", "status": result.get("status")},
        )
    except Exception:
        logger.exception("backup.failed", extra={"event": "backup.failed"})
