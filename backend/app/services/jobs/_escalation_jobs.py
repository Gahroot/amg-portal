"""Escalation-related background jobs."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.middleware.audit import with_system_audit_context
from app.models.enums import EscalationLevel, EscalationStatus
from app.models.escalation import Escalation
from app.models.milestone import Milestone
from app.models.sla_tracker import SLATracker
from app.models.user import User
from app.services.escalation_service import (
    ESCALATION_PROGRESSION,
    auto_progress_escalation,
    create_escalation,
    evaluate_auto_triggers,
)

logger = logging.getLogger(__name__)

_ESCALATION_LEVEL_RANK = {
    "task": 0,
    "milestone": 1,
    "program": 2,
    "client_impact": 3,
}


async def _escalate_milestone_deadline(
    db: AsyncSession,
    ms: Milestone,
    today: object,
    cutoff_24h: object,
    system_user: User,
    now_iso: str,
) -> bool:
    """Evaluate one milestone and create/upgrade its escalation.

    Returns True if a new escalation was created.
    """
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
            Escalation.status.in_(
                [
                    EscalationStatus.open.value,
                    EscalationStatus.acknowledged.value,
                    EscalationStatus.investigating.value,
                ]
            ),
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
                {
                    "action": "level_upgraded",
                    "to": level.value,
                    "at": now_iso,
                    "reason": window_label,
                }
            )
            await db.commit()
            logger.info(
                "Escalation %s upgraded to %s for milestone %s (%s)",
                existing.id,
                level.value,
                ms.id,
                window_label,
            )
        return False

    await create_escalation(
        db=db,
        entity_type="milestone",
        entity_id=str(ms.id),
        level=level,
        triggered_by=system_user,
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
    db: AsyncSession,
    tracker: SLATracker,
    system_user: User,
    now_iso: str,
    elapsed_hours: float,
) -> bool:
    """Evaluate one SLA tracker and create an escalation if none exists.

    Returns True if a new escalation was created.
    """
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
            Escalation.status.in_(
                [
                    EscalationStatus.open.value,
                    EscalationStatus.acknowledged.value,
                    EscalationStatus.investigating.value,
                ]
            ),
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
        triggered_by=system_user,
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
        level.value,
        severity,
        tracker.entity_type,
        tracker.entity_id,
    )
    return True


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
async def _auto_progress_escalations_job() -> None:
    """Periodic job (every 15 min): auto-progress escalations past their time threshold.

    Checks open/acknowledged escalations and promotes them to the next level
    if they've exceeded their ESCALATION_PROGRESSION threshold without being resolved.
    """
    logger.info("Running escalation auto-progression job")
    try:
        async with AsyncSessionLocal() as db:
            active_statuses = [EscalationStatus.open.value, EscalationStatus.acknowledged.value]
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
