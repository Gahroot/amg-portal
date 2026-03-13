"""Background job scheduler using APScheduler."""

import logging
from datetime import datetime
from typing import TYPE_CHECKING

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

if TYPE_CHECKING:
    from app.models.report_schedule import ReportSchedule

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.milestone import Milestone
from app.models.notification_preference import NotificationPreference

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _check_sla_breaches_job() -> None:
    """Periodic job: check and update SLA breach statuses."""
    from app.services.sla_service import check_sla_breaches

    logger.info("Running SLA breach check job")
    try:
        async with AsyncSessionLocal() as db:
            updated = await check_sla_breaches(db)
            logger.info(
                "SLA breach check complete — %d trackers updated",
                len(updated),
            )
    except Exception:
        logger.exception("Error in SLA breach check job")


async def _check_escalation_promotions_job() -> None:
    """Periodic job: promote escalations that have breached their SLA response times."""
    from app.services.escalation_service import check_escalation_promotions

    logger.info("Running escalation promotion check job")
    try:
        async with AsyncSessionLocal() as db:
            promoted = await check_escalation_promotions(db)
            logger.info(
                "Escalation promotion check complete — %d escalations promoted",
                len(promoted),
            )
    except Exception:
        logger.exception("Error in escalation promotion check job")


async def _crm_sync_job() -> None:
    """Periodic job: bi-directional CRM sync for all client profiles."""
    from app.services.crm_service import get_crm_service, run_crm_sync_all

    logger.info("Running CRM sync job")
    try:
        service = get_crm_service()
        async with AsyncSessionLocal() as db:
            stats = await run_crm_sync_all(service, db)
            logger.info(
                "CRM sync complete — pushed=%d, pulled=%d, errors=%d",
                stats["pushed"],
                stats["pulled"],
                stats["errors"],
            )
    except Exception:
        logger.exception("Error in CRM sync job")


async def _check_milestone_risks_job() -> None:
    """Periodic job: check milestones for risk and escalate."""
    from app.services.escalation_service import (
        check_and_escalate_milestone_risk,
    )

    logger.info("Running milestone risk check job")
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Milestone.id).where(Milestone.status.notin_(["completed", "cancelled"]))
            )
            milestone_ids = result.scalars().all()

        for milestone_id in milestone_ids:
            try:
                async with AsyncSessionLocal() as db:
                    await check_and_escalate_milestone_risk(db, milestone_id)
            except Exception:
                logger.exception("Error escalating milestone %s", milestone_id)

        logger.info(
            "Milestone risk check complete — %d milestones checked",
            len(milestone_ids),
        )
    except Exception:
        logger.exception("Error in milestone risk check job")


async def _send_daily_digests_job() -> None:
    """Daily job: send digest emails to users with daily frequency."""
    from app.services.notification_service import notification_service

    logger.info("Running daily digest job")
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(NotificationPreference.user_id).where(
                    NotificationPreference.digest_enabled.is_(True),
                    NotificationPreference.digest_frequency == "daily",
                )
            )
            user_ids = result.scalars().all()

        for user_id in user_ids:
            try:
                async with AsyncSessionLocal() as db:
                    await notification_service.send_digest(db, user_id)
            except Exception:
                logger.exception("Error sending daily digest for user %s", user_id)

        logger.info(
            "Daily digest complete — %d users processed",
            len(user_ids),
        )
    except Exception:
        logger.exception("Error in daily digest job")


async def _send_weekly_digests_job() -> None:
    """Weekly job: send digest emails to users with weekly frequency."""
    from app.services.notification_service import notification_service

    logger.info("Running weekly digest job")
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(NotificationPreference.user_id).where(
                    NotificationPreference.digest_enabled.is_(True),
                    NotificationPreference.digest_frequency == "weekly",
                )
            )
            user_ids = result.scalars().all()

        for user_id in user_ids:
            try:
                async with AsyncSessionLocal() as db:
                    await notification_service.send_digest(db, user_id)
            except Exception:
                logger.exception("Error sending weekly digest for user %s", user_id)

        logger.info(
            "Weekly digest complete — %d users processed",
            len(user_ids),
        )
    except Exception:
        logger.exception("Error in weekly digest job")


async def _send_weekly_status_reports_job() -> None:
    """Friday job: send weekly status reports for active programs."""
    from datetime import date, timedelta

    from sqlalchemy.orm import selectinload

    from app.models.program import Program
    from app.services.auto_dispatch_service import (
        dispatch_template_message,
    )

    logger.info("Running weekly status reports job")
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Program)
                .options(selectinload(Program.milestones))
                .where(Program.status.notin_(["completed", "cancelled"]))
            )
            programs = result.scalars().all()

        for program in programs:
            try:
                async with AsyncSessionLocal() as db:
                    milestones = program.milestones or []
                    total = len(milestones)
                    completed = sum(1 for m in milestones if m.status == "completed")
                    progress = f"{completed}/{total}" if total > 0 else "0/0"

                    # Compute RAG status
                    today = date.today()
                    rag = "green"
                    for m in milestones:
                        if m.status != "completed" and m.due_date and m.due_date < today:
                            rag = "red"
                            break
                    if rag != "red":
                        for m in milestones:
                            if (
                                m.status != "completed"
                                and m.due_date
                                and m.due_date <= today + timedelta(days=7)
                            ):
                                rag = "amber"
                                break

                    active = [m for m in milestones if m.status not in ("completed", "cancelled")]
                    active_text = "\n".join(f"- {m.title} (due: {m.due_date})" for m in active)
                    if not active_text:
                        active_text = "No active milestones"

                    await dispatch_template_message(
                        db,
                        template_type="weekly_status",
                        recipient_user_ids=[program.created_by],
                        variables={
                            "program_title": program.title,
                            "rag_status": rag,
                            "milestone_progress": progress,
                            "active_milestones": active_text,
                        },
                        program_id=program.id,
                    )
            except Exception:
                logger.exception(
                    "Error sending weekly status for program %s",
                    program.id,
                )

        logger.info(
            "Weekly status reports complete — %d programs processed",
            len(programs),
        )
    except Exception:
        logger.exception("Error in weekly status reports job")


async def _check_partner_threshold_alerts_job() -> None:
    """Daily job: alert MDs about partners with avg overall score below 3.0."""
    from sqlalchemy import func as sa_func

    from app.models.partner_rating import PartnerRating
    from app.models.user import User
    from app.schemas.notification import CreateNotificationRequest
    from app.services.notification_service import notification_service

    logger.info("Running partner threshold alerts job")
    try:
        async with AsyncSessionLocal() as db:
            # Find partners with avg overall < 3.0
            result = await db.execute(
                select(
                    PartnerRating.partner_id,
                    sa_func.avg(PartnerRating.overall_score).label("avg_overall"),
                )
                .group_by(PartnerRating.partner_id)
                .having(sa_func.avg(PartnerRating.overall_score) < 3.0)
            )
            low_partners = result.all()

            if not low_partners:
                logger.info("No low-performing partners found")
                return

            # Get partner names
            from app.models.partner import PartnerProfile

            partner_ids = [row.partner_id for row in low_partners]

            partners_result = await db.execute(
                select(PartnerProfile).where(PartnerProfile.id.in_(partner_ids))
            )
            partner_map = {p.id: p.firm_name for p in partners_result.scalars().all()}

            # Get managing directors
            md_result = await db.execute(
                select(User.id).where(
                    User.role == "managing_director",
                    User.status == "active",
                )
            )
            md_ids = md_result.scalars().all()

            for lp in low_partners:
                firm = partner_map.get(lp.partner_id, "Unknown")
                avg_score = round(float(lp.avg_overall), 2)
                for md_id in md_ids:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=md_id,
                            notification_type="system",
                            title=(f"Low partner performance: {firm}"),
                            body=(
                                f"Partner {firm} has an"
                                f" average overall score"
                                f" of {avg_score}/5.0,"
                                " which is below the"
                                " threshold of 3.0."
                            ),
                            priority="high",
                        ),
                    )

            logger.info(
                "Partner threshold alerts complete — %d low-performing partners, %d MDs notified",
                len(low_partners),
                len(md_ids),
            )
    except Exception:
        logger.exception("Error in partner threshold alerts job")


async def _process_report_schedules_job() -> None:
    """Hourly job: process scheduled reports whose next_run has passed and email them."""
    from app.models.report_schedule import ReportSchedule
    from app.services.email_service import send_report_email
    from app.services.pdf_service import pdf_service
    from app.services.report_service import report_service

    logger.info("Running report schedules job")
    try:
        async with AsyncSessionLocal() as db:
            from datetime import UTC, datetime

            now = datetime.now(UTC)
            result = await db.execute(
                select(ReportSchedule).where(
                    ReportSchedule.is_active.is_(True),
                    ReportSchedule.next_run <= now,
                )
            )
            schedules = result.scalars().all()

        logger.info(
            "Found %d report schedules to process",
            len(schedules),
        )

        for schedule in schedules:
            try:
                report_data = await _get_report_data(report_service, schedule)
                if report_data is None:
                    logger.warning("No data for schedule %s", schedule.id)
                    continue

                attachment_bytes = _generate_report_attachment(pdf_service, schedule, report_data)
                ext = schedule.format or "pdf"
                content_type = "application/pdf" if ext == "pdf" else "text/csv"
                filename = f"{schedule.report_type}_{now.strftime('%Y%m%d')}.{ext}"

                recipients: list[str] = schedule.recipients or []
                for recipient in recipients:
                    await send_report_email(
                        email_address=recipient,
                        report_type=schedule.report_type,
                        attachment_bytes=attachment_bytes,
                        attachment_filename=filename,
                        attachment_content_type=content_type,
                        recipient_count=len(recipients),
                        portal_url=settings.FRONTEND_URL,
                    )

                # Notify the report creator
                async with AsyncSessionLocal() as db:
                    from app.schemas.notification import CreateNotificationRequest
                    from app.services.notification_service import notification_service

                    report_label = schedule.report_type.replace(
                        "_", " "
                    ).title()
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=schedule.created_by,
                            notification_type="system",
                            title=(
                                "Scheduled Report Delivered: "
                                f"{report_label}"
                            ),
                            body=(
                                f"Your scheduled "
                                f"{schedule.report_type.replace('_', ' ')} "
                                f"report has been generated and emailed to "
                                f"{len(recipients)} recipient(s)."
                            ),
                            priority="normal",
                        ),
                    )

                # Update last_run and next_run
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(ReportSchedule).where(ReportSchedule.id == schedule.id)
                    )
                    sched = result.scalar_one()
                    sched.last_run = now
                    sched.next_run = _calculate_next_run(schedule.frequency, now)
                    await db.commit()

            except Exception:
                logger.exception(
                    "Error processing schedule %s",
                    schedule.id,
                )

        logger.info(
            "Report schedules job complete — %d schedules processed",
            len(schedules),
        )
    except Exception:
        logger.exception("Error in report schedules job")


async def _check_capability_review_reminders_job() -> None:
    """Daily job: send reminders for upcoming capability reviews and escalate overdue ones."""
    from app.models.user import User
    from app.schemas.notification import CreateNotificationRequest
    from app.services.capability_review_service import capability_review_service
    from app.services.notification_service import notification_service

    logger.info("Running capability review reminders job")
    try:
        async with AsyncSessionLocal() as db:
            # Get reviews due in the configured reminder window
            reviews_due_soon = await capability_review_service.get_reviews_due_soon(
                db, days=settings.CAPABILITY_REVIEW_REMINDER_DAYS
            )

            for review in reviews_due_soon:
                # Skip if reminder already sent
                if review.reminder_sent_at:
                    continue

                # Notify reviewer if assigned
                if review.reviewer_id:
                    partner_name = review.partner.firm_name if review.partner else "Unknown"
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=review.reviewer_id,
                            notification_type="system",
                            title=f"Upcoming Capability Review: {partner_name}",
                            body=(
                                f"The annual capability review for {partner_name} "
                                f"is scheduled for {review.scheduled_date}. "
                                "Please complete the review before this date."
                            ),
                            priority="high",
                            action_url=f"/capability-reviews/{review.id}",
                            action_label="View Review",
                        ),
                    )

                # Mark reminder as sent
                await capability_review_service.mark_reminder_sent(db, review.id)

            # Get overdue reviews
            overdue_reviews = await capability_review_service.get_overdue_reviews(db)

            # Get managing directors for escalation
            md_result = await db.execute(
                select(User.id).where(
                    User.role == "managing_director",
                    User.status == "active",
                )
            )
            md_ids = md_result.scalars().all()

            for review in overdue_reviews:
                # Escalate to MDs
                partner_name = review.partner.firm_name if review.partner else "Unknown"
                for md_id in md_ids:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=md_id,
                            notification_type="system",
                            title=f"Overdue Capability Review: {partner_name}",
                            body=(
                                f"The annual capability review for {partner_name} "
                                f"(Year {review.review_year}) is overdue. "
                                f"It was scheduled for {review.scheduled_date}."
                            ),
                            priority="urgent",
                            action_url=f"/capability-reviews/{review.id}",
                            action_label="View Review",
                        ),
                    )

            logger.info(
                "Capability review reminders complete — %d reminders sent, %d overdue escalated",
                len(reviews_due_soon),
                len(overdue_reviews),
            )
    except Exception:
        logger.exception("Error in capability review reminders job")


async def _archive_closed_programs_job() -> None:
    """Daily job: archive closed programs past the data-retention window."""
    from app.services.archival_service import archive_closed_programs

    logger.info("Running closed-program archival job")
    try:
        async with AsyncSessionLocal() as db:
            count = await archive_closed_programs(db)
            logger.info(
                "Closed-program archival complete — %d programs archived",
                count,
            )
    except Exception:
        logger.exception("Error in closed-program archival job")


async def _execute_approved_deletions_job() -> None:
    """Daily job: execute approved deletion requests whose retention window has elapsed.

    For each executed request an audit-log entry is created to satisfy the
    governance rule: *nothing is permanently erased without a two-person
    authorization and audit record*.
    """
    from app.models.audit_log import AuditLog
    from app.services.deletion_service import deletion_service

    logger.info("Running approved-deletions execution job")
    try:
        async with AsyncSessionLocal() as db:
            executed = await deletion_service.execute_approved_deletions(db)

            for req in executed:
                db.add(
                    AuditLog(
                        user_id=req.approved_by,
                        user_email=None,
                        action="delete",
                        entity_type=req.entity_type,
                        entity_id=str(req.entity_id),
                        before_state=None,
                        after_state={
                            "deletion_request_id": str(req.id),
                            "status": "executed",
                            "entity_type": req.entity_type,
                            "entity_id": str(req.entity_id),
                            "requested_by": str(req.requested_by),
                            "approved_by": str(req.approved_by),
                            "reason": req.reason,
                            "retention_days": req.retention_days,
                        },
                    )
                )

            await db.commit()
            logger.info(
                "Approved-deletions execution complete — %d requests executed",
                len(executed),
            )
    except Exception:
        logger.exception("Error in approved-deletions execution job")


async def _run_quarterly_access_audit_job() -> None:
    """Quarterly job: auto-create access audit with dormant/mismatch/orphan findings."""
    from app.services.access_audit_service import access_audit_service

    logger.info("Running quarterly access audit job")
    try:
        async with AsyncSessionLocal() as db:
            audit = await access_audit_service.run_quarterly_access_audit(db)
            if audit:
                logger.info(
                    "Quarterly access audit created — %d users reviewed, %d findings",
                    audit.users_reviewed,
                    audit.anomalies_found,
                )
            else:
                logger.info("Quarterly access audit already exists — skipped")
    except Exception:
        logger.exception("Error in quarterly access audit job")


async def _quarterly_audit_reminder_job() -> None:
    """Quarterly job: remind compliance team to conduct access audit."""
    from datetime import UTC, datetime

    from app.models.access_audit import AccessAudit
    from app.models.user import User
    from app.schemas.notification import CreateNotificationRequest
    from app.services.notification_service import notification_service

    logger.info("Running quarterly audit reminder job")
    try:
        async with AsyncSessionLocal() as db:
            now = datetime.now(UTC)
            current_quarter = (now.month - 1) // 3 + 1
            current_year = now.year

            # Check if audit exists for current quarter
            result = await db.execute(
                select(AccessAudit).where(
                    AccessAudit.quarter == current_quarter,
                    AccessAudit.year == current_year,
                )
            )
            existing_audit = result.scalar_one_or_none()

            # Get compliance users
            compliance_result = await db.execute(
                select(User.id).where(
                    User.role == "finance_compliance",
                    User.status == "active",
                )
            )
            compliance_ids = compliance_result.scalars().all()

            # Also notify managing directors
            md_result = await db.execute(
                select(User.id).where(
                    User.role == "managing_director",
                    User.status == "active",
                )
            )
            md_ids = md_result.scalars().all()

            all_recipients = list(set(compliance_ids + md_ids))

            if not existing_audit:
                # No audit exists - send reminder to create one
                for user_id in all_recipients:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=user_id,
                            notification_type="system",
                            title=f"Q{current_quarter} {current_year} Access Audit Required",
                            body=(
                                f"The Q{current_quarter} {current_year} quarterly "
                                "access audit has not been started. "
                                "Please initiate the audit to ensure compliance "
                                "with access review policies."
                            ),
                            priority="high",
                            action_url="/access-audits",
                            action_label="Start Audit",
                        ),
                    )
                logger.info(
                    "Quarterly audit reminder sent to %d users for Q%d %d",
                    len(all_recipients),
                    current_quarter,
                    current_year,
                )
            elif existing_audit.status == "draft":
                # Audit started but not completed
                for user_id in all_recipients:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=user_id,
                            notification_type="system",
                            title=f"Q{current_quarter} {current_year} Access Audit Incomplete",
                            body=(
                                f"The Q{current_quarter} {current_year} quarterly "
                                "access audit is still in draft status. "
                                "Please complete the audit findings "
                                "and finalize the report."
                            ),
                            priority="normal",
                            action_url=f"/access-audits/{existing_audit.id}",
                            action_label="Continue Audit",
                        ),
                    )
                logger.info(
                    "Audit completion reminder sent to %d users for Q%d %d",
                    len(all_recipients),
                    current_quarter,
                    current_year,
                )
            else:
                logger.info(
                    "Q%d %d audit already completed, no reminder needed",
                    current_quarter,
                    current_year,
                )
    except Exception:
        logger.exception("Error in quarterly audit reminder job")


async def _check_partner_governance_job() -> None:
    """Monthly job: probationary partner flagging and annual capability refresh."""
    from app.services.partner_governance_service import (
        check_probationary_partners,
        trigger_annual_capability_refresh,
    )

    logger.info("Running partner governance job")
    try:
        async with AsyncSessionLocal() as db:
            probationary = await check_probationary_partners(db)
            logger.info(
                "Probationary partner check — %d partners flagged",
                len(probationary),
            )

        async with AsyncSessionLocal() as db:
            reviews = await trigger_annual_capability_refresh(db)
            logger.info(
                "Annual capability refresh — %d reviews created",
                len(reviews),
            )
    except Exception:
        logger.exception("Error in partner governance job")


async def _get_report_data(svc: object, schedule: "ReportSchedule") -> dict[str, object] | None:
    """Fetch report data based on schedule type."""
    from uuid import UUID

    from app.services.report_service import ReportService

    assert isinstance(svc, ReportService)

    entity_id = UUID(schedule.entity_id) if schedule.entity_id else None
    if entity_id is None:
        return None

    report_type: str = schedule.report_type
    async with AsyncSessionLocal() as db:
        if report_type == "portfolio":
            return await svc.get_portfolio_overview(db, entity_id)
        if report_type == "program_status":
            return await svc.get_program_status_report(db, entity_id)
        if report_type == "completion":
            return await svc.get_completion_report(db, entity_id)
        if report_type == "annual_review":
            from datetime import UTC, datetime

            year = datetime.now(UTC).year
            return await svc.get_annual_review(db, entity_id, year)
    return None


def _generate_report_attachment(
    pdf_svc: object,
    schedule: "ReportSchedule",
    report_data: dict[str, object],
) -> bytes:
    """Generate PDF or CSV bytes from report data."""
    import csv
    import io

    from app.services.pdf_service import PDFService

    assert isinstance(pdf_svc, PDFService)

    fmt = schedule.format or "pdf"
    report_type = schedule.report_type

    if fmt == "pdf":
        if report_type == "portfolio":
            return pdf_svc.generate_portfolio_pdf(report_data)
        elif report_type == "program_status":
            return pdf_svc.generate_program_status_pdf(report_data)
        elif report_type == "completion":
            return pdf_svc.generate_completion_pdf(report_data)
        elif report_type == "annual_review":
            return pdf_svc.generate_annual_review_pdf(report_data)
        return b""

    # CSV fallback — flatten report data
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Key", "Value"])
    for key, value in report_data.items():
        if not isinstance(value, (list, dict)):
            writer.writerow([key, value])
    return output.getvalue().encode("utf-8")


async def _sync_docusign_envelopes_job() -> None:
    """Periodic job: poll DocuSign for status updates on pending envelopes."""
    from app.services.docusign_service import docusign_service

    if not docusign_service.is_configured():
        return

    logger.info("Running DocuSign envelope status sync job")
    try:
        async with AsyncSessionLocal() as db:
            updated = await docusign_service.sync_pending_envelopes(db)
            logger.info("DocuSign sync complete: %d envelope(s) updated", updated)
    except Exception:
        logger.exception("DocuSign envelope sync job failed")


def _calculate_next_run(
    frequency: str,
    from_time: datetime,
) -> datetime:
    """Calculate the next run time based on frequency."""
    from datetime import timedelta

    if frequency == "daily":
        return from_time + timedelta(days=1)
    elif frequency == "weekly":
        return from_time + timedelta(days=7)
    elif frequency == "monthly":
        return from_time + timedelta(days=30)
    return from_time + timedelta(days=1)


async def _generate_predictive_alerts_job() -> None:
    """Daily job: generate predictive risk alerts for at-risk programs.

    For each active program, compute milestone breach predictions:
    - Within 3 days of breach → milestone-level escalation
    - Within 7 days of breach → task-level escalation
    Skips milestones that already have an open predictive escalation.
    """
    from app.models.client import Client
    from app.models.escalation import Escalation
    from app.models.program import Program
    from app.models.user import User
    from app.services.risk_scoring_service import predict_program_risk

    logger.info("Running predictive risk alerts job")
    try:
        async with AsyncSessionLocal() as db:
            q = (
                select(Program, Client)
                .join(Client, Program.client_id == Client.id)
                .where(Program.status.in_(["active", "in_progress", "intake", "planning"]))
            )
            result = await db.execute(q)
            rows = result.all()

        alerts_created = 0
        for program, client in rows:
            try:
                async with AsyncSessionLocal() as db:
                    alert = await predict_program_risk(db, program, client)
                    if alert is None:
                        continue

                    for prediction in alert.milestone_predictions:
                        # Determine escalation level
                        esc_level = (
                            "milestone"
                            if prediction.days_until_breach <= 3
                            else "task"
                        )

                        # Check for existing open predictive escalation for this milestone
                        esc_check = await db.execute(
                            select(Escalation).where(
                                Escalation.entity_type == "milestone",
                                Escalation.entity_id == str(prediction.milestone_id),
                                Escalation.status.in_(["open", "acknowledged"]),
                                Escalation.title.contains("Predictive Risk"),
                            )
                        )
                        if esc_check.scalar_one_or_none() is not None:
                            continue

                        # Find a system user to own the escalation
                        sys_user = await db.execute(
                            select(User.id).where(
                                User.role == "managing_director",
                                User.status == "active",
                            )
                        )
                        owner_id = sys_user.scalar_one_or_none()
                        if not owner_id:
                            owner_result = await db.execute(
                                select(User.id).where(User.status == "active").limit(1)
                            )
                            owner_id = owner_result.scalar_one_or_none()
                        if not owner_id:
                            continue

                        predicted_pct = prediction.predicted_completion_pct_at_due
                        risk_data = {
                            "type": "predictive_breach",
                            "days_until_breach": prediction.days_until_breach,
                            "completion_pct": prediction.completion_pct,
                            "predicted_completion_at_due": predicted_pct,
                            "task_velocity_per_week": alert.task_velocity,
                            "program_risk_score": alert.risk_score,
                        }

                        import uuid as _uuid

                        escalation = Escalation(
                            id=_uuid.uuid4(),
                            level=esc_level,
                            status="open",
                            title=(
                                f"Predictive Risk: {prediction.milestone_title} "
                                f"may breach in {prediction.days_until_breach} day(s)"
                            ),
                            description=(
                                f"Program '{program.title}' milestone "
                                f"'{prediction.milestone_title}' is predicted to miss "
                                f"its due date ({prediction.due_date}). "
                                f"Current completion: {prediction.completion_pct}%. "
                                f"Predicted completion at due: "
                                f"{prediction.predicted_completion_pct_at_due}%."
                            ),
                            entity_type="milestone",
                            entity_id=str(prediction.milestone_id),
                            owner_id=owner_id,
                            program_id=program.id,
                            client_id=client.id,
                            triggered_by=owner_id,
                            risk_factors=risk_data,
                        )
                        db.add(escalation)
                        alerts_created += 1

                    await db.commit()
            except Exception:
                logger.exception(
                    "Error generating predictive alerts for program %s",
                    program.id,
                )

        logger.info(
            "Predictive risk alerts complete — %d alerts created",
            alerts_created,
        )
    except Exception:
        logger.exception("Error in predictive risk alerts job")


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
        _check_escalation_promotions_job,
        "interval",
        minutes=settings.ESCALATION_PROMOTION_CHECK_INTERVAL_MINUTES,
        id="check_escalation_promotions",
        name="Check escalation promotions",
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
        "interval",
        hours=1,
        id="process_report_schedules",
        name="Process scheduled reports (hourly)",
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
        _run_quarterly_access_audit_job,
        "cron",
        month="1,4,7,10",
        day=settings.AUDIT_REMINDER_DAY_OF_QUARTER,
        hour=1,
        minute=0,
        id="run_quarterly_access_audit",
        name="Run quarterly access audit (auto-create with findings)",
        replace_existing=True,
    )

    _scheduler.add_job(
        _quarterly_audit_reminder_job,
        "cron",
        month="1,4,7,10",
        day=settings.AUDIT_REMINDER_DAY_OF_QUARTER,
        hour=9,
        minute=0,
        id="quarterly_audit_reminder",
        name="Quarterly audit reminder",
        replace_existing=True,
    )

    _scheduler.add_job(
        _execute_approved_deletions_job,
        "cron",
        hour=2,
        minute=0,
        id="execute_approved_deletions",
        name="Execute approved deletions past retention window",
        replace_existing=True,
    )

    _scheduler.add_job(
        _check_partner_governance_job,
        "cron",
        day=settings.PARTNER_GOVERNANCE_CHECK_DAY,
        hour=6,
        minute=0,
        id="check_partner_governance",
        name="Monthly partner governance check",
        replace_existing=True,
    )

    _scheduler.add_job(
        _generate_predictive_alerts_job,
        "cron",
        hour=settings.PREDICTIVE_ALERT_CHECK_HOUR_UTC,
        minute=0,
        id="generate_predictive_alerts",
        name="Generate predictive risk alerts (daily)",
        replace_existing=True,
    )

    if settings.AUTO_ARCHIVE_ENABLED:
        _scheduler.add_job(
            _archive_closed_programs_job,
            "cron",
            hour=3,
            minute=0,
            id="archive_closed_programs",
            name="Archive closed programs past retention window",
            replace_existing=True,
        )

    if settings.CRM_SYNC_ENABLED:
        _scheduler.add_job(
            _crm_sync_job,
            "interval",
            minutes=settings.CRM_SYNC_INTERVAL_MINUTES,
            id="crm_sync",
            name="CRM bi-directional sync",
            replace_existing=True,
        )

    # DocuSign envelope status sync (only if configured)
    from app.services.docusign_service import docusign_service

    if docusign_service.is_configured():
        _scheduler.add_job(
            _sync_docusign_envelopes_job,
            "interval",
            minutes=settings.DOCUSIGN_ENVELOPE_STATUS_CHECK_MINUTES,
            id="sync_docusign_envelopes",
            name="Sync DocuSign envelope statuses",
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
