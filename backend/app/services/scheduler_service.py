"""Background job scheduler using APScheduler."""

import logging
import random
from datetime import UTC, date, datetime, timedelta
from typing import TypedDict
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import delete, select
from sqlalchemy import func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit_chain import sign_day, verify_day
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.middleware.audit import with_system_audit_context
from app.models.access_audit import AccessAudit
from app.models.client import Client
from app.models.enums import EscalationLevel, EscalationStatus, SLABreachStatus, UserRole
from app.models.escalation import Escalation
from app.models.kyc_document import KYCDocument
from app.models.milestone import Milestone
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.partner import PartnerProfile
from app.models.partner_rating import PartnerRating
from app.models.program import Program
from app.models.report_schedule import ReportSchedule
from app.models.sla_tracker import SLATracker
from app.models.user import User
from app.schemas.notification import CreateNotificationRequest
from app.services.access_audit_service import access_audit_service
from app.services.archival_service import archive_program, get_archival_candidates
from app.services.auto_dispatch_service import dispatch_template_message
from app.services.capability_review_service import capability_review_service
from app.services.client_dates_service import send_date_reminders
from app.services.digest_service import process_all_digests
from app.services.document_expiry_service import check_and_send_expiry_alerts
from app.services.email_service import send_email_with_attachment
from app.services.escalation_service import (
    auto_progress_escalation,
    create_escalation,
    create_escalation_from_sla_breach,
    evaluate_auto_triggers,
)
from app.services.milestone_reminder_service import send_milestone_reminders_scoped
from app.services.notification_service import notification_service
from app.services.predictive_service import get_at_risk_milestones
from app.services.report_generator_service import (
    _generate_attachment_bytes,
    _get_report_data,
    generate_report_for_schedule,
)
from app.services.scheduling_service import send_reminders
from app.services.sla_service import check_sla_breaches

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


@with_system_audit_context
async def _check_sla_breaches_job() -> None:
    """Periodic job: check and update SLA breach statuses, then notify on new breaches."""
    logger.info("Running SLA breach check job")
    try:
        async with AsyncSessionLocal() as db:
            updated = await check_sla_breaches(db)
            logger.info(
                "SLA breach check complete — %d trackers updated",
                len(updated),
            )

            # Notify assigned user and managing directors for trackers that just breached
            newly_breached = [
                t for t in updated if t.breach_status == SLABreachStatus.breached.value
            ]

            # Bridge SLA breaches to escalations
            for tracker in newly_breached:
                try:
                    await create_escalation_from_sla_breach(db, tracker)
                except Exception:
                    logger.exception(
                        "Failed to create escalation from SLA breach for tracker %s",
                        tracker.id,
                    )

            if not newly_breached:
                return

            # Fetch managing directors once
            md_result = await db.execute(
                select(User.id).where(
                    User.role == "managing_director",
                    User.status == "active",
                )
            )
            md_ids = list(md_result.scalars().all())

            for tracker in newly_breached:
                entity_label = f"{tracker.entity_type} {tracker.entity_id}"

                # Notify the assigned user
                await notification_service.create_notification(
                    db,
                    CreateNotificationRequest(
                        user_id=tracker.assigned_to,
                        notification_type="system",
                        title="SLA Breached — response overdue",
                        body=(
                            f"The {tracker.sla_hours}h response SLA for a "
                            f"{tracker.communication_type.replace('_', ' ')} "
                            f"on {entity_label} has been breached. "
                            "Please respond immediately."
                        ),
                        priority="urgent",
                    ),
                )

                # Notify managing directors (skip if they happen to be the assignee)
                for md_id in md_ids:
                    if md_id == tracker.assigned_to:
                        continue
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=md_id,
                            notification_type="system",
                            title=f"SLA Breach Alert — {tracker.communication_type}",
                            body=(
                                f"A {tracker.sla_hours}h SLA for a "
                                f"{tracker.communication_type.replace('_', ' ')} "
                                f"on {entity_label} has been breached. "
                                f"Assigned to user {tracker.assigned_to}."
                            ),
                            priority="high",
                        ),
                    )

            logger.info(
                "SLA breach notifications sent for %d newly breached tracker(s)",
                len(newly_breached),
            )
    except Exception:
        logger.exception("Error in SLA breach check job")


@with_system_audit_context
async def _check_milestone_risks_job() -> None:
    """Periodic job: check milestones for risk and escalate.

    Targets milestones that are at risk:
    - due_date is within 48 hours and not completed (approaching)
    - due_date is past and not completed (overdue)

    Escalation levels:
    - Approaching or < 7 days overdue: task level (Coordinator)
    - >= 7 days overdue: milestone level (RM)

    Per design doc Section 03 Phase 3 Step 15 and Section 05 Steps 21-22:
    - Escalation workflows trigger automatically when milestones are at risk
    - RM alerted within the portal
    """

    logger.info("Running milestone risk check job")
    try:
        today = datetime.now(UTC).date()
        approaching_cutoff = today + timedelta(days=2)  # 48 hours

        async with AsyncSessionLocal() as db:
            # Query milestones that are at risk (approaching or overdue)
            # with related program and client for RM lookup
            result = await db.execute(
                select(Milestone)
                .options(
                    selectinload(Milestone.program).selectinload(Program.client),
                )
                .where(
                    Milestone.status.notin_(["completed", "cancelled"]),
                    Milestone.due_date.isnot(None),
                    Milestone.due_date <= approaching_cutoff,
                )
            )
            milestones = result.scalars().all()

            # Get system user once for all escalations
            system_user_result = await db.execute(
                select(User).where(User.email == "system@amg.portal").limit(1)
            )
            system_user = system_user_result.scalar_one_or_none()
            if system_user is None:
                fallback_result = await db.execute(select(User).limit(1))
                system_user = fallback_result.scalar_one_or_none()

            if system_user is None:
                logger.error("No users found — cannot create escalations")
                return

            escalations_created = 0
            notifications_sent = 0

            for milestone in milestones:
                try:
                    # Calculate risk metrics
                    if milestone.due_date is None:
                        continue
                    days_until_due = (milestone.due_date - today).days
                    is_overdue = days_until_due < 0
                    is_severely_overdue = days_until_due < -7

                    # Determine escalation level per requirements
                    if is_severely_overdue:
                        level = EscalationLevel.milestone
                    else:
                        level = EscalationLevel.task

                    # Check for existing active escalation (deduplication)
                    existing_result = await db.execute(
                        select(Escalation).where(
                            Escalation.entity_type == "milestone",
                            Escalation.entity_id == str(milestone.id),
                            Escalation.status.in_([
                                EscalationStatus.open.value,
                                EscalationStatus.acknowledged.value,
                            ]),
                        )
                    )
                    if existing_result.scalar_one_or_none() is not None:
                        continue  # Skip — active escalation already exists

                    # Create escalation record
                    level_label = (
                        "severely overdue" if is_severely_overdue
                        else "overdue" if is_overdue
                        else "at risk"
                    )
                    escalation = await create_escalation(
                        db=db,
                        entity_type="milestone",
                        entity_id=str(milestone.id),
                        level=level,
                        triggered_by=system_user,
                        title=f"Milestone {level_label}: {milestone.title}",
                        description=(
                            f"Milestone '{milestone.title}' is {level_label}. "
                            f"Due date: {milestone.due_date}"
                        ),
                        risk_factors={
                            "days_until_due": days_until_due,
                            "overdue": is_overdue,
                            "severely_overdue": is_severely_overdue,
                        },
                        program_id=milestone.program_id,
                    )
                    escalations_created += 1

                    # Dispatch in-portal notification to RM
                    rm_id: UUID | None = None
                    if milestone.program and milestone.program.client:
                        rm_id = milestone.program.client.rm_id

                    if rm_id:
                        due_label = "overdue" if is_overdue else f"due {milestone.due_date}"
                        await notification_service.create_notification(
                            db,
                            CreateNotificationRequest(
                                user_id=rm_id,
                                notification_type="milestone_update",
                                title=f"Milestone at risk: {milestone.title}",
                                body=(
                                    f"Milestone '{milestone.title}' is {due_label}. "
                                    f"An escalation has been raised (ref: {escalation.id}). "
                                    "Please review and take action."
                                ),
                                priority="high",
                                entity_type="milestone",
                                entity_id=milestone.id,
                            ),
                        )
                        notifications_sent += 1
                    else:
                        logger.warning(
                            "No RM found for milestone %s — notification skipped",
                            milestone.id,
                        )

                    logger.info(
                        "Created %s level escalation %s for milestone %s (%s)",
                        level.value,
                        escalation.id,
                        milestone.id,
                        level_label,
                    )

                except Exception:
                    logger.exception("Error escalating milestone %s", milestone.id)

            logger.info(
                "Milestone risk check complete — %d milestones checked, "
                "%d escalations created, %d notifications sent",
                len(milestones),
                escalations_created,
                notifications_sent,
            )
    except Exception:
        logger.exception("Error in milestone risk check job")


@with_system_audit_context
async def _send_daily_digests_job() -> None:
    """Daily job: send digest emails to users with daily frequency."""
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


@with_system_audit_context
async def _send_weekly_digests_job() -> None:
    """Weekly job: send digest emails to users with weekly frequency."""
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


@with_system_audit_context
async def _process_queued_notifications_job() -> None:
    """Periodic job: process queued notifications when users exit quiet hours.

    Runs every 15 minutes to deliver push and email notifications that were
    queued because the user was in their configured quiet hours window.
    """
    logger.info("Running queued notifications processing job")
    try:
        async with AsyncSessionLocal() as db:
            result = await notification_service.process_queued_notifications(
                db, limit=500
            )
            processed_push, processed_email = result
            logger.info(
                "Queued notifications processed — %d push, %d email",
                processed_push,
                processed_email,
            )
    except Exception:
        logger.exception("Error in queued notifications processing job")


class _MilestoneSnapshot(TypedDict):
    status: str
    due_date: date | None
    title: str


class _ProgramSnapshot(TypedDict):
    id: UUID
    title: str
    created_by: UUID
    milestones: list[_MilestoneSnapshot]


@with_system_audit_context
async def _send_weekly_status_reports_job() -> None:
    """Friday job: send weekly status reports for active programs."""
    logger.info("Running weekly status reports job")

    # Plain-Python snapshots of each program's data — extracted while the session
    # is still open so we never touch detached ORM-managed attributes afterward.
    snapshots: list[_ProgramSnapshot] = []

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Program)
                .options(selectinload(Program.milestones))
                .where(Program.status.notin_(["completed", "cancelled"]))
            )
            programs = result.scalars().all()

            # Extract all data we need while the session is open.
            for program in programs:
                milestones_data: list[_MilestoneSnapshot] = [
                    _MilestoneSnapshot(
                        status=str(m.status),
                        due_date=m.due_date,
                        title=str(m.title),
                    )
                    for m in (program.milestones or [])
                ]
                snapshots.append(
                    _ProgramSnapshot(
                        id=UUID(str(program.id)),
                        title=str(program.title),
                        created_by=UUID(str(program.created_by)),
                        milestones=milestones_data,
                    )
                )

        for snapshot in snapshots:
            try:
                async with AsyncSessionLocal() as db:
                    milestones = snapshot["milestones"]
                    total = len(milestones)
                    completed = sum(1 for m in milestones if m["status"] == "completed")
                    progress = f"{completed}/{total}" if total > 0 else "0/0"

                    # Compute RAG status
                    today = datetime.now(UTC).date()
                    rag = "green"
                    for m in milestones:
                        if (
                            m["status"] != "completed"
                            and m["due_date"] is not None
                            and m["due_date"] < today
                        ):
                            rag = "red"
                            break
                    if rag != "red":
                        for m in milestones:
                            if (
                                m["status"] != "completed"
                                and m["due_date"] is not None
                                and m["due_date"] <= today + timedelta(days=7)
                            ):
                                rag = "amber"
                                break

                    active = [
                        m for m in milestones if m["status"] not in ("completed", "cancelled")
                    ]
                    active_text = "\n".join(
                        f"- {m['title']} (due: {m['due_date']})" for m in active
                    )
                    if not active_text:
                        active_text = "No active milestones"

                    await dispatch_template_message(
                        db,
                        template_type="weekly_status",
                        recipient_user_ids=[snapshot["created_by"]],
                        variables={
                            "program_title": snapshot["title"],
                            "rag_status": rag,
                            "milestone_progress": progress,
                            "active_milestones": active_text,
                        },
                        program_id=snapshot["id"],
                    )
            except Exception:
                logger.exception(
                    "Error sending weekly status for program %s",
                    snapshot["id"],
                )

        logger.info(
            "Weekly status reports complete — %d programs processed",
            len(snapshots),
        )
    except Exception:
        logger.exception("Error in weekly status reports job")


@with_system_audit_context
async def _check_partner_threshold_alerts_job() -> None:
    """Daily job: alert MDs about partners with avg overall score below 3.0."""
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


@with_system_audit_context
async def _process_report_schedules_job() -> None:
    """Daily job: process scheduled reports, store in MinIO, and email them."""
    logger.info("Running report schedules job")
    try:
        async with AsyncSessionLocal() as db:
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
                async with AsyncSessionLocal() as db:
                    # Re-fetch schedule within this session
                    sched_result = await db.execute(
                        select(ReportSchedule).where(ReportSchedule.id == schedule.id)
                    )
                    sched = sched_result.scalar_one()

                    doc = await generate_report_for_schedule(db, sched)
                    if doc is None:
                        continue

                    # Read the attachment bytes for emailing
                    report_data = await _get_report_data(sched, db)
                    attachment_bytes = (
                        await _generate_attachment_bytes(sched, report_data)
                        if report_data
                        else b""
                    )

                    ext = sched.format or "pdf"
                    content_type = "application/pdf" if ext == "pdf" else "text/csv"
                    filename = str(doc.file_name)

                    # Update schedule fields
                    sched.last_run = now
                    sched.next_run = _calculate_next_run(sched.frequency, now)
                    sched.last_generated_document_id = doc.id
                    await db.commit()

                # Email the attachment to recipients
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


@with_system_audit_context
async def _check_capability_review_reminders_job() -> None:
    """Daily job: send reminders for upcoming capability reviews and escalate overdue ones."""
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


@with_system_audit_context
async def _quarterly_audit_reminder_job() -> None:
    """Quarterly job: remind compliance team to conduct access audit."""
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

            # Count dormant accounts to include in notifications
            dormant_users = await access_audit_service.detect_dormant_accounts(db)
            dormant_count = len(dormant_users)
            dormant_suffix = (
                f" There are currently {dormant_count} dormant account(s) "
                "that require review."
                if dormant_count > 0
                else ""
            )

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

            all_recipients = list(set(list(compliance_ids) + list(md_ids)))

            if not existing_audit:
                # No audit exists - send reminder to create one
                for user_id in all_recipients:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=user_id,
                            notification_type="system",
                            title=(
                                f"Q{current_quarter} {current_year}"
                                " Access Audit Required"
                            ),
                            body=(
                                f"The Q{current_quarter} {current_year}"
                                " quarterly access audit has not been"
                                " started. Please initiate the audit to"
                                " ensure compliance with access review"
                                f" policies.{dormant_suffix}"
                            ),
                            priority="high",
                            action_url="/access-audits",
                            action_label="Start Audit",
                        ),
                    )
                logger.info(
                    "Quarterly audit reminder sent to %d users for Q%d %d "
                    "(%d dormant accounts detected)",
                    len(all_recipients),
                    current_quarter,
                    current_year,
                    dormant_count,
                )
            elif existing_audit.status == "draft":
                # Audit started but not completed
                for user_id in all_recipients:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=user_id,
                            notification_type="system",
                            title=(
                                f"Q{current_quarter} {current_year}"
                                " Access Audit Incomplete"
                            ),
                            body=(
                                f"The Q{current_quarter} {current_year}"
                                " quarterly access audit is still in"
                                " draft status. Please complete the"
                                " audit findings and finalize the"
                                f" report.{dormant_suffix}"
                            ),
                            priority="normal",
                            action_url=f"/access-audits/{existing_audit.id}",
                            action_label="Continue Audit",
                        ),
                    )
                logger.info(
                    "Audit completion reminder sent to %d users for Q%d %d "
                    "(%d dormant accounts detected)",
                    len(all_recipients),
                    current_quarter,
                    current_year,
                    dormant_count,
                )
            else:
                logger.info(
                    "Q%d %d audit already completed, no reminder needed",
                    current_quarter,
                    current_year,
                )
    except Exception:
        logger.exception("Error in quarterly audit reminder job")


@with_system_audit_context
async def _check_data_retention_job() -> None:
    """Daily job: notify compliance team of programs eligible for archival.

    If AUTO_ARCHIVE_PROGRAMS is enabled, automatically archives eligible
    programs up to ARCHIVE_BATCH_SIZE per run.  Otherwise, sends an
    in-portal notification so the compliance team can review and manually
    trigger archival via POST /api/v1/programs/{id}/archive.
    """
    logger.info("Running data retention / archival check job")
    try:
        async with AsyncSessionLocal() as db:
            candidate_list = await get_archival_candidates(db)

        if not candidate_list.candidates:
            logger.info("Data retention check: no programs eligible for archival")
            return

        logger.info(
            "Data retention check: %d program(s) eligible for archival",
            candidate_list.total,
        )

        if settings.AUTO_ARCHIVE_PROGRAMS:
            # Auto-archive each eligible program
            for candidate in candidate_list.candidates:
                try:
                    async with AsyncSessionLocal() as db:
                        await archive_program(db, candidate.program_id)
                    logger.info(
                        "Auto-archived program %s ('%s')",
                        candidate.program_id,
                        candidate.title,
                    )
                except Exception:
                    logger.exception(
                        "Error auto-archiving program %s",
                        candidate.program_id,
                    )
        else:
            # Notify compliance users and MDs to review
            async with AsyncSessionLocal() as db:
                compliance_result = await db.execute(
                    select(User.id).where(
                        User.role.in_(
                            [UserRole.finance_compliance.value, UserRole.managing_director.value]
                        ),
                        User.status == "active",
                    )
                )
                recipient_ids = compliance_result.scalars().all()

            program_titles = ", ".join(
                f"'{c.title}'" for c in candidate_list.candidates[:5]
            )
            if candidate_list.total > 5:
                program_titles += f" and {candidate_list.total - 5} more"

            for user_id in recipient_ids:
                try:
                    async with AsyncSessionLocal() as db:
                        await notification_service.create_notification(
                            db,
                            CreateNotificationRequest(
                                user_id=user_id,
                                notification_type="system",
                                title=(
                                    f"Data Retention: {candidate_list.total} program(s) "
                                    "eligible for archival"
                                ),
                                body=(
                                    f"{candidate_list.total} closed program(s) have exceeded "
                                    f"the {settings.DATA_RETENTION_DAYS}-day retention period "
                                    f"and are ready to be archived: {program_titles}. "
                                    "Review and archive via the Archival Candidates page."
                                ),
                                priority="normal",
                                action_url="/programs/archival-candidates",
                                action_label="Review Candidates",
                            ),
                        )
                except Exception:
                    logger.exception(
                        "Error sending archival notification to user %s",
                        user_id,
                    )

            logger.info(
                "Data retention check: notified %d user(s) about %d eligible program(s)",
                len(recipient_ids),
                candidate_list.total,
            )
    except Exception:
        logger.exception("Error in data retention check job")


@with_system_audit_context
async def _check_kyc_expiry_job() -> None:  # noqa: PLR0915
    """Daily job: check KYC documents for expiry and notify relevant users.

    Per design doc Section 08: "Monthly compliance review: KYC expiry dates,
    document completeness, access anomaly reports."

    Creates alerts for:
    - Documents expiring within 30 days → "warning" alert
    - Documents expiring within 7 days → "urgent" alert
    - Already expired documents → "expired" alert

    Notifications go to the assigned RM and Finance & Compliance users.
    """
    logger.info("Running KYC expiry check job")
    try:
        today = datetime.now(UTC).date()
        warning_cutoff = today + timedelta(days=30)

        async with AsyncSessionLocal() as db:
            # Query verified KYC documents with expiry dates within 30 days or already expired
            result = await db.execute(
                select(KYCDocument)
                .options(
                    selectinload(KYCDocument.client).selectinload(Client.rm),
                )
                .where(
                    KYCDocument.expiry_date.isnot(None),
                    KYCDocument.expiry_date <= warning_cutoff,
                    KYCDocument.status == "verified",
                )
            )
            kyc_docs = result.scalars().all()

            if not kyc_docs:
                logger.info("KYC expiry check: no documents expiring within 30 days")
                return

            # Get Finance & Compliance users
            fc_result = await db.execute(
                select(User.id).where(
                    User.role == UserRole.finance_compliance.value,
                    User.status == "active",
                )
            )
            fc_user_ids = list(fc_result.scalars().all())

            warning_count = 0
            urgent_count = 0
            expired_count = 0
            notifications_sent = 0

            for kyc_doc in kyc_docs:
                try:
                    expiry_date = kyc_doc.expiry_date
                    if expiry_date is None:
                        continue

                    days_until_expiry = (expiry_date - today).days
                    client_name = kyc_doc.client.name if kyc_doc.client else "Unknown client"

                    # Determine alert category and priority
                    if days_until_expiry <= 0:
                        alert_category = "expired"
                        priority = "urgent"
                        expiry_label = "has expired"
                        expired_count += 1
                    elif days_until_expiry <= 7:
                        alert_category = "urgent"
                        priority = "urgent"
                        expiry_label = f"expires in {days_until_expiry} day(s)"
                        urgent_count += 1
                    else:
                        alert_category = "warning"
                        priority = "high"
                        expiry_label = f"expires in {days_until_expiry} day(s)"
                        warning_count += 1

                    # Check for existing notification to avoid duplicates
                    # Look for notification with same entity and category within last 7 days
                    existing_result = await db.execute(
                        select(Notification).where(
                            Notification.entity_type == "kyc_document",
                            Notification.entity_id == kyc_doc.id,
                            Notification.title.contains(client_name),
                            Notification.created_at
                            >= datetime.now() - timedelta(days=7),
                        )
                    )
                    if existing_result.scalar_one_or_none() is not None:
                        logger.debug(
                            "Skipping duplicate KYC expiry notification for doc %s",
                            kyc_doc.id,
                        )
                        continue

                    # Build notification content
                    doc_type = kyc_doc.document_type.replace("_", " ").title()
                    title = f"KYC Document Expiry: {doc_type} ({client_name})"
                    body = (
                        f"The KYC document '{kyc_doc.document_type.replace('_', ' ').title()}' "
                        f"for client {client_name} {expiry_label} "
                        f"(expiry date: {expiry_date}). "
                        f"Please take appropriate action to ensure compliance."
                    )

                    # Collect recipient IDs: RM + Finance & Compliance users
                    recipient_ids: set[UUID] = set(fc_user_ids)
                    if kyc_doc.client and kyc_doc.client.rm_id:
                        recipient_ids.add(kyc_doc.client.rm_id)

                    doc_id: UUID = kyc_doc.id
                    for user_id in recipient_ids:
                        await notification_service.create_notification(
                            db,
                            CreateNotificationRequest(
                                user_id=user_id,
                                notification_type="kyc_expiry",
                                title=title,
                                body=body,
                                priority=priority,
                                entity_type="kyc_document",
                                entity_id=doc_id,
                                action_url=f"/kyc/verifications/{doc_id}?client={kyc_doc.client_id}",
                                action_label="View Document",
                            ),
                        )
                        notifications_sent += 1

                    logger.info(
                        "Created %s KYC expiry alert for doc %s (client: %s, expires: %s)",
                        alert_category,
                        kyc_doc.id,
                        client_name,
                        expiry_date,
                    )

                except Exception:
                    logger.exception(
                        "Error processing KYC expiry for document %s",
                        kyc_doc.id,
                    )

            logger.info(
                "KYC expiry check complete — %d warning, %d urgent, %d expired, "
                "%d notifications sent",
                warning_count,
                urgent_count,
                expired_count,
                notifications_sent,
            )
    except Exception:
        logger.exception("Error in KYC expiry check job")


def _calculate_next_run(
    frequency: str,
    from_time: datetime,
) -> datetime:
    """Calculate the next run time based on frequency."""

    if frequency == "daily":
        return from_time + timedelta(days=1)
    elif frequency == "weekly":
        return from_time + timedelta(days=7)
    elif frequency == "monthly":
        return from_time + timedelta(days=30)
    return from_time + timedelta(days=1)


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

            # Group by program to send consolidated notifications
            programs_notified: set[str] = set()

            for risk in at_risk:
                program_key = str(risk.program_id)
                if program_key in programs_notified:
                    continue
                programs_notified.add(program_key)

                # Find the RM for this program's client
                program = await db.get(Program, risk.program_id)
                if not program:
                    continue

                result = await db.execute(
                    select(Client)
                    .options(selectinload(Client.rm))
                    .where(Client.id == program.client_id)
                )
                client = result.scalar_one_or_none()
                if not client or not client.rm_id:
                    continue

                await notification_service.create_notification(
                    db,
                    CreateNotificationRequest(
                        user_id=client.rm_id,
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
            logger.info(
                "Predictive alerts sent for %d programs", len(programs_notified)
            )
    except Exception:
        logger.exception("Error running predictive alerts job")


@with_system_audit_context
async def _check_escalation_triggers_job() -> None:
    """Periodic job: evaluate auto-trigger escalation rules."""

    logger.info("Running escalation auto-trigger check job")
    try:
        async with AsyncSessionLocal() as db:
            created = await evaluate_auto_triggers(db)
            logger.info(
                "Escalation auto-trigger check complete — %d escalations created",
                len(created),
            )
    except Exception:
        logger.exception("Error in escalation auto-trigger check job")


@with_system_audit_context
async def _auto_progress_escalations_job() -> None:
    """Periodic job (every 15 min): auto-progress escalations past their time threshold.

    Checks open/acknowledged escalations and promotes them to the next level
    if they've exceeded their ESCALATION_PROGRESSION threshold without being resolved.
    """
    logger.info("Running escalation auto-progression job")
    try:
        from app.models.enums import EscalationStatus as EscStatus
        from app.services.escalation_service import ESCALATION_PROGRESSION

        async with AsyncSessionLocal() as db:
            active_statuses = [EscStatus.open.value, EscStatus.acknowledged.value]
            progressable_levels = list(ESCALATION_PROGRESSION.keys())

            result = await db.execute(
                select(Escalation.id).where(
                    Escalation.status.in_(active_statuses),
                    Escalation.level.in_(progressable_levels),
                )
            )
            escalation_ids = result.scalars().all()

            progressed = 0
            for esc_id in escalation_ids:
                try:
                    child = await auto_progress_escalation(db, esc_id)
                    if child:
                        progressed += 1
                except Exception:
                    logger.exception(
                        "Error auto-progressing escalation %s",
                        esc_id,
                    )

            logger.info(
                "Escalation auto-progression complete — %d/%d escalations progressed",
                progressed,
                len(escalation_ids),
            )
    except Exception:
        logger.exception("Error in escalation auto-progression job")


_ESCALATION_LEVEL_RANK = {
    "task": 0,
    "milestone": 1,
    "program": 2,
    "client_impact": 3,
}


async def _escalate_milestone_deadline(
    db: object,
    ms: "Milestone",
    today: object,
    cutoff_24h: object,
    system_user: object,
    now_iso: str,
) -> bool:
    """Evaluate one milestone and create/upgrade its escalation.

    Returns True if a new escalation was created.
    """


    assert isinstance(db, AsyncSession)

    # due_date is always non-None here (filtered in the query); today/cutoff_24h are dates
    days_until = (ms.due_date - today).days  # type: ignore[operator]

    if days_until < 0:
        level = EscalationLevel.program
        window_label = f"{abs(days_until)} day(s) overdue"
    elif ms.due_date <= cutoff_24h:  # type: ignore[operator]
        level = EscalationLevel.milestone
        window_label = "due within 24 hours"
    else:
        level = EscalationLevel.task
        window_label = "due within 48 hours"

    dup_result = await db.execute(
        select(Escalation).where(
            Escalation.entity_type == "milestone",
            Escalation.entity_id == str(ms.id),
            Escalation.status.in_([
                EscalationStatus.open.value,
                EscalationStatus.acknowledged.value,
                EscalationStatus.investigating.value,
            ]),
        )
    )
    existing = dup_result.scalar_one_or_none()

    if existing is not None:
        if _ESCALATION_LEVEL_RANK.get(level.value, 0) > _ESCALATION_LEVEL_RANK.get(
            existing.level, 0
        ):
            existing.level = level
            existing.risk_factors = dict(existing.risk_factors or {})
            existing.risk_factors["days_until_due"] = days_until
            existing.escalation_chain = list(existing.escalation_chain or [])
            existing.escalation_chain.append(
                {"action": "level_upgraded", "to": level.value, "at": now_iso,
                 "reason": window_label}
            )
            await db.commit()
            logger.info(
                "Escalation %s upgraded to %s for milestone %s (%s)",
                existing.id, level.value, ms.id, window_label,
            )
        return False

    await create_escalation(
        db=db,
        entity_type="milestone",
        entity_id=str(ms.id),
        level=level,
        triggered_by=system_user,  # type: ignore[arg-type]
        title=f"Milestone deadline alert: {ms.title}",
        description=(
            f"Milestone '{ms.title}' is {window_label}. "
            f"Due date: {ms.due_date}. "
            "Automated 15-minute check — immediate action required."
        ),
        risk_factors={
            "days_until_due": days_until,
            "overdue": days_until < 0,
            "window": window_label,
            "trigger": "deadline_check",
        },
        program_id=ms.program_id,
    )
    logger.info("Created %s escalation for milestone %s (%s)", level.value, ms.id, window_label)
    return True


async def _escalate_sla_breach(
    db: object,
    tracker: object,
    system_user: object,
    now_iso: str,
    elapsed_hours: float,
) -> bool:
    """Evaluate one SLA tracker and create an escalation if none exists.

    Returns True if a new escalation was created.
    """
    assert isinstance(db, AsyncSession)
    assert isinstance(tracker, SLATracker)

    ratio = elapsed_hours / tracker.sla_hours if tracker.sla_hours > 0 else 1.0

    if ratio >= 4.0:
        level = EscalationLevel.program
        severity = "critical"
    elif ratio >= 2.0:
        level = EscalationLevel.milestone
        severity = "high"
    else:
        level = EscalationLevel.task
        severity = "medium"

    dup_result = await db.execute(
        select(Escalation).where(
            Escalation.entity_type == tracker.entity_type,
            Escalation.entity_id == tracker.entity_id,
            Escalation.status.in_([
                EscalationStatus.open.value,
                EscalationStatus.acknowledged.value,
                EscalationStatus.investigating.value,
            ]),
        )
    )
    if dup_result.scalar_one_or_none() is not None:
        return False

    comm_type = tracker.communication_type
    await create_escalation(
        db=db,
        entity_type=tracker.entity_type,
        entity_id=tracker.entity_id,
        level=level,
        triggered_by=system_user,  # type: ignore[arg-type]
        title=f"SLA breach ({severity}): {comm_type} on {tracker.entity_type}",
        description=(
            f"SLA of {tracker.sla_hours}h for {comm_type.replace('_', ' ')} "
            f"has been breached. "
            f"Elapsed: {elapsed_hours:.1f}h ({ratio:.1f}\u00d7 SLA). "
            "Automated escalation — please respond immediately."
        ),
        risk_factors={
            "sla_hours": tracker.sla_hours,
            "elapsed_hours": round(elapsed_hours, 2),
            "sla_ratio": round(ratio, 2),
            "communication_type": comm_type,
            "severity": severity,
            "trigger": "sla_breach_check",
        },
    )
    logger.info(
        "Created %s SLA breach escalation (%s) for %s:%s",
        level.value, severity, tracker.entity_type, tracker.entity_id,
    )
    return True


@with_system_audit_context
async def _check_escalation_deadlines_job() -> None:
    """Periodic job (every 15 min): check upcoming milestone deadlines and active SLA
    breaches, then create Escalation records with levels matched to urgency.

    Milestone deadline windows (based on due_date vs. now):
    - Overdue (past due, not completed)  → EscalationLevel.program  (MD — critical)
    - Due within 24 h                    → EscalationLevel.milestone (RM — urgent)
    - Due within 24–48 h                 → EscalationLevel.task      (Coordinator — warning)

    If an open/acknowledged/investigating escalation already exists for a milestone,
    the level is upgraded in-place rather than creating a duplicate.

    SLA breach escalation levels (graduated by elapsed / SLA ratio):
    - elapsed < 2× SLA   → EscalationLevel.task      (medium severity)
    - 2× ≤ elapsed < 4×  → EscalationLevel.milestone (high severity)
    - elapsed ≥ 4× SLA   → EscalationLevel.program   (critical severity)

    Existing open escalations on the same entity are skipped (no duplicates).
    """
    logger.info("Running escalation deadline check job")
    try:
        now = datetime.now(UTC)
        today = now.date()
        cutoff_24h = (now + timedelta(hours=24)).date()
        cutoff_48h = (now + timedelta(hours=48)).date()
        now_iso = now.isoformat()

        async with AsyncSessionLocal() as db:
            # ── Resolve system user ────────────────────────────────────────────
            sys_result = await db.execute(
                select(User).where(User.email == "system@amg.portal").limit(1)
            )
            system_user = sys_result.scalar_one_or_none()
            if system_user is None:
                fallback = await db.execute(select(User).limit(1))
                system_user = fallback.scalar_one_or_none()
            if system_user is None:
                logger.error("No users found — skipping escalation deadline check")
                return

            # ── 1. Milestone deadline checks ───────────────────────────────────
            ms_result = await db.execute(
                select(Milestone).where(
                    Milestone.status.notin_(["completed", "cancelled"]),
                    Milestone.due_date.isnot(None),
                    Milestone.due_date <= cutoff_48h,
                )
            )
            milestones = ms_result.scalars().all()
            milestone_created = 0
            for ms in milestones:
                try:
                    created = await _escalate_milestone_deadline(
                        db, ms, today, cutoff_24h, system_user, now_iso
                    )
                    if created:
                        milestone_created += 1
                except Exception:
                    logger.exception(
                        "Error processing milestone %s in escalation deadline check", ms.id
                    )

            # ── 2. SLA breach escalations ──────────────────────────────────────
            sla_result = await db.execute(
                select(SLATracker).where(SLATracker.breach_status == "breached")
            )
            breached_trackers = sla_result.scalars().all()
            sla_created = 0
            for tracker in breached_trackers:
                try:
                    elapsed_hours = (now - tracker.started_at).total_seconds() / 3600
                    created = await _escalate_sla_breach(
                        db, tracker, system_user, now_iso, elapsed_hours
                    )
                    if created:
                        sla_created += 1
                except Exception:
                    logger.exception(
                        "Error processing SLA tracker %s in escalation deadline check",
                        tracker.id,
                    )

            logger.info(
                "Escalation deadline check complete — "
                "%d milestone escalation(s) created, %d SLA escalation(s) created",
                milestone_created,
                sla_created,
            )
    except Exception:
        logger.exception("Error in escalation deadline check job")


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
async def _check_document_expiry_job() -> None:
    """Daily job: send expiry alerts for passports, visas, and certifications."""
    logger.info("Running document expiry alerts job")
    try:
        async with AsyncSessionLocal() as db:
            sent = await check_and_send_expiry_alerts(db)
        logger.info("Document expiry alerts job complete — %d notifications sent", sent)
    except Exception:
        logger.exception("Error in document expiry alerts job")


@with_system_audit_context
async def _check_partner_performance_trend_alerts_job() -> None:
    """Daily job: check partner performance metrics vs thresholds and alert on declining trends."""
    logger.info("Running partner performance trend alerts job")
    try:
        from app.services.partner_alert_service import run_partner_performance_alerts

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
            from app.services.recurring_task_service import process_due_templates

            count = await process_due_templates(db)
            logger.info("Recurring task processing complete — %d tasks created", count)
    except Exception:
        logger.exception("Error processing recurring tasks")


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


@with_system_audit_context
async def _mark_overdue_document_requests_job() -> None:
    """Daily job: mark document requests whose deadline has passed as overdue."""
    logger.info("Running overdue document requests job")
    try:
        async with AsyncSessionLocal() as db:
            from app.services.document_request_service import mark_overdue_requests

            count = await mark_overdue_requests(db)
            logger.info("Overdue document requests marked — %d updated", count)
    except Exception:
        logger.exception("Error marking overdue document requests")


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
    # Pick one additional random past day within the chain window, if any.
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


@with_system_audit_context
async def _cleanup_expired_refresh_tokens_job() -> None:
    """Delete expired refresh tokens to keep the table lean."""
    try:
        from app.models.refresh_token import RefreshToken

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

    # Add predictive alerts job - runs daily at 7:00 AM
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

    # Process queued notifications (quiet hours) - runs every 15 minutes
    _scheduler.add_job(
        _process_queued_notifications_job,
        "interval",
        minutes=15,
        id="process_queued_notifications",
        name="Process queued notifications (quiet hours)",
        replace_existing=True,
    )

    # Client birthday & important date reminders — daily at 7:30 AM UTC
    _scheduler.add_job(
        _check_client_dates_job,
        "cron",
        hour=7,
        minute=30,
        id="check_client_dates",
        name="Check client birthdays and important dates",
        replace_existing=True,
    )

    # Document expiry alerts (passport, visa, certification) — daily at 8:00 AM UTC
    _scheduler.add_job(
        _check_document_expiry_job,
        "cron",
        hour=8,
        minute=0,
        id="check_document_expiry",
        name="Check document expiry (passport, visa, certification)",
        replace_existing=True,
    )

    # Milestone due-date reminders based on client preferences — daily at 8:30 AM UTC
    _scheduler.add_job(
        _send_milestone_reminder_notifications_job,
        "cron",
        hour=8,
        minute=30,
        id="send_milestone_reminder_notifications",
        name="Send milestone reminder notifications",
        replace_existing=True,
    )

    # Partner performance trend alerts — daily at 9:00 AM UTC
    _scheduler.add_job(
        _check_partner_performance_trend_alerts_job,
        "cron",
        hour=9,
        minute=0,
        id="check_partner_performance_trend_alerts",
        name="Check partner performance trend alerts",
        replace_existing=True,
    )

    # Recurring task processing — daily at 00:05 AM UTC
    _scheduler.add_job(
        _process_recurring_tasks_job,
        "cron",
        hour=0,
        minute=5,
        id="process_recurring_tasks",
        name="Process recurring task templates",
        replace_existing=True,
    )

    # Mark overdue document requests — daily at 00:30 AM UTC
    _scheduler.add_job(
        _mark_overdue_document_requests_job,
        "cron",
        hour=0,
        minute=30,
        id="mark_overdue_document_requests",
        name="Mark overdue document requests",
        replace_existing=True,
    )

    # Cleanup expired refresh tokens — daily at 3:00 AM UTC
    _scheduler.add_job(
        _cleanup_expired_refresh_tokens_job,
        "cron",
        hour=3,
        minute=0,
        id="cleanup_expired_refresh_tokens",
        name="Cleanup expired refresh tokens",
        replace_existing=True,
    )

    # Audit-chain daily signing — 00:05 UTC (Phase 1.13)
    _scheduler.add_job(
        _sign_audit_chain_job,
        "cron",
        hour=0,
        minute=5,
        id="sign_audit_chain",
        name="Sign yesterday's audit-log Merkle chain",
        replace_existing=True,
    )

    # Audit-chain daily verification — 00:15 UTC (Phase 1.14)
    _scheduler.add_job(
        _verify_audit_chain_job,
        "cron",
        hour=0,
        minute=15,
        id="verify_audit_chain",
        name="Verify yesterday's audit-log chain + a random prior day",
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
