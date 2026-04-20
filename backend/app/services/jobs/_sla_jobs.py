"""SLA-related background jobs."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.middleware.audit import with_system_audit_context
from app.models.enums import EscalationLevel, EscalationStatus, SLABreachStatus
from app.models.escalation import Escalation
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.user import User
from app.schemas.notification import CreateNotificationRequest
from app.services.escalation_service import (
    create_escalation,
    create_escalation_from_sla_breach,
)
from app.services.notification_service import notification_service
from app.services.sla_service import check_sla_breaches

logger = logging.getLogger(__name__)


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
        from uuid import UUID

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
                            Escalation.status.in_(
                                [
                                    EscalationStatus.open.value,
                                    EscalationStatus.acknowledged.value,
                                ]
                            ),
                        )
                    )
                    if existing_result.scalar_one_or_none() is not None:
                        continue  # Skip — active escalation already exists

                    # Create escalation record
                    level_label = (
                        "severely overdue"
                        if is_severely_overdue
                        else "overdue"
                        if is_overdue
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
