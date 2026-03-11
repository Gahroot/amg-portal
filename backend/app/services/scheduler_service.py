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
    """Daily job: process scheduled reports and email them."""
    from app.models.report_schedule import ReportSchedule
    from app.services.email_service import send_email_with_attachment
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

                subject = (
                    f"AMG Portal — Scheduled Report: "
                    f"{schedule.report_type.replace('_', ' ').title()}"
                )
                body_html = (
                    "<html><body>"
                    "<h2>Scheduled Report</h2>"
                    "<p>Please find your scheduled "
                    f"{schedule.report_type.replace('_', ' ')} "
                    "report attached.</p>"
                    "<p>Best regards,<br>AMG Portal</p>"
                    "</body></html>"
                )

                recipients: list[str] = schedule.recipients or []
                for recipient in recipients:
                    try:
                        await send_email_with_attachment(
                            to=recipient,
                            subject=subject,
                            body_html=body_html,
                            attachment=attachment_bytes,
                            attachment_filename=filename,
                            attachment_content_type=content_type,
                        )
                    except Exception:
                        logger.exception(
                            "Error sending report email to %s for schedule %s",
                            recipient,
                            schedule.id,
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
            # Get reviews due in the next 30 days
            reviews_due_soon = await capability_review_service.get_reviews_due_soon(db, days=30)

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
                                f"The Q{current_quarter} {current_year} quarterly access audit has not been started. "
                                "Please initiate the audit to ensure compliance with access review policies."
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
                                f"The Q{current_quarter} {current_year} quarterly access audit is still in draft status. "
                                "Please complete the audit findings and finalize the report."
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
