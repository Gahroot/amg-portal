"""Miscellaneous background jobs: predictive alerts, recurring tasks, auth cleanup."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.middleware.audit import with_system_audit_context
from app.models.program import Program
from app.models.refresh_token import RefreshToken
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
