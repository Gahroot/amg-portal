"""SLA tracking business logic — clock management, breach detection."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import CommunicationType, SLABreachStatus
from app.models.sla_tracker import SLATracker
from app.models.user import User

logger = logging.getLogger(__name__)


# SLA configuration in hours
SLA_CONFIG: dict[CommunicationType, int] = {
    CommunicationType.email: 24,
    CommunicationType.portal_message: 4,
    CommunicationType.phone: 4,
    CommunicationType.partner_submission: 48,
    CommunicationType.client_inquiry: 24,
}


def get_sla_config(communication_type: CommunicationType) -> int:
    """Return SLA hours for each communication type."""
    return SLA_CONFIG.get(communication_type, 24)


async def start_sla_clock(
    db: AsyncSession,
    entity_type: str,
    entity_id: str,
    communication_type: CommunicationType,
    assigned_to: UUID,
    sla_hours: int | None = None,
) -> SLATracker:
    """Start tracking SLA for a communication."""
    if sla_hours is None:
        sla_hours = get_sla_config(communication_type)

    tracker = SLATracker(
        entity_type=entity_type,
        entity_id=entity_id,
        communication_type=communication_type.value,
        sla_hours=sla_hours,
        assigned_to=assigned_to,
        breach_status=SLABreachStatus.within_sla.value,
    )
    db.add(tracker)
    await db.commit()
    await db.refresh(tracker)

    logger.info(
        f"SLA clock started: {tracker.id} for {entity_type}:{entity_id} "
        f"({communication_type.value}, {sla_hours}h)"
    )
    return tracker


async def check_sla_breaches(
    db: AsyncSession,
) -> list[SLATracker]:
    """Find all SLAs that are approaching breach or breached."""
    result = await db.execute(
        select(SLATracker).where(
            SLATracker.responded_at.is_(None),
            SLATracker.breach_status.in_(
                [
                    SLABreachStatus.within_sla.value,
                    SLABreachStatus.approaching_breach.value,
                ]
            ),
        )
    )
    trackers = result.scalars().all()

    now = datetime.now(UTC)
    updated_trackers: list[SLATracker] = []

    for tracker in trackers:
        elapsed_hours = (now - tracker.started_at).total_seconds() / 3600
        sla_threshold = tracker.sla_hours
        approaching_threshold = sla_threshold * 0.8

        new_status = tracker.breach_status

        if elapsed_hours >= sla_threshold:
            new_status = SLABreachStatus.breached.value
        elif elapsed_hours >= approaching_threshold:
            new_status = SLABreachStatus.approaching_breach.value

        if new_status != tracker.breach_status:
            tracker.breach_status = new_status
            updated_trackers.append(tracker)

    if updated_trackers:
        await db.commit()
        for t in updated_trackers:
            await db.refresh(t)
        logger.info(f"Updated {len(updated_trackers)} SLA trackers to new breach statuses")

    return updated_trackers


async def respond_to_sla(
    db: AsyncSession,
    tracker_id: UUID,
    responded_by: User,
) -> SLATracker:
    """Mark SLA as responded, calculate breach status."""
    result = await db.execute(select(SLATracker).where(SLATracker.id == tracker_id))
    tracker = result.scalar_one_or_none()
    if not tracker:
        raise ValueError(f"SLA Tracker {tracker_id} not found")

    if tracker.responded_at:
        raise ValueError(f"SLA Tracker {tracker_id} already responded to")

    tracker.responded_at = datetime.now(UTC)

    # Calculate final breach status
    elapsed_hours = (tracker.responded_at - tracker.started_at).total_seconds() / 3600

    if elapsed_hours > tracker.sla_hours:
        tracker.breach_status = SLABreachStatus.breached.value
        logger.warning(
            f"SLA {tracker_id} breached: {elapsed_hours:.2f}h elapsed vs {tracker.sla_hours}h SLA"
        )
    else:
        tracker.breach_status = SLABreachStatus.within_sla.value
        logger.info(
            f"SLA {tracker_id} responded within SLA: {elapsed_hours:.2f}h elapsed "
            f"vs {tracker.sla_hours}h SLA"
        )

    await db.commit()
    await db.refresh(tracker)

    return tracker


async def get_sla_trackers_with_assignee_info(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    breach_status: str | None = None,
    entity_type: str | None = None,
) -> tuple[list[dict[str, object]], int]:
    """Get SLA trackers with assignee user info for API responses."""
    q: Select[tuple[SLATracker]] = select(SLATracker)

    if breach_status:
        q = q.where(SLATracker.breach_status == breach_status)
    if entity_type:
        q = q.where(SLATracker.entity_type == entity_type)

    # Count total
    count_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_result.scalar_one()

    q = q.order_by(SLATracker.started_at.desc()).offset(skip).limit(limit)

    result = await db.execute(q)
    trackers = result.scalars().all()

    # Build response with assignee info
    tracker_data = []
    for tracker in trackers:
        # Get assignee info
        assignee_result = await db.execute(select(User).where(User.id == tracker.assigned_to))
        assignee = assignee_result.scalar_one_or_none()

        tracker_dict = {
            "id": tracker.id,
            "entity_type": tracker.entity_type,
            "entity_id": tracker.entity_id,
            "communication_type": tracker.communication_type,
            "sla_hours": tracker.sla_hours,
            "started_at": tracker.started_at,
            "responded_at": tracker.responded_at,
            "breach_status": tracker.breach_status,
            "assigned_to": tracker.assigned_to,
            "assigned_to_email": assignee.email if assignee else None,
            "assigned_to_name": assignee.full_name if assignee else None,
            "created_at": tracker.created_at,
            "updated_at": tracker.updated_at,
        }
        tracker_data.append(tracker_dict)

    return tracker_data, total


async def get_open_sla_for_entity(
    db: AsyncSession,
    entity_type: str,
    entity_id: str,
) -> list[SLATracker]:
    """Return all open (not yet responded) SLA trackers for an entity."""
    result = await db.execute(
        select(SLATracker).where(
            SLATracker.entity_type == entity_type,
            SLATracker.entity_id == entity_id,
            SLATracker.responded_at.is_(None),
        )
    )
    return list(result.scalars().all())


async def close_open_sla_for_entity(
    db: AsyncSession,
    entity_type: str,
    entity_id: str,
) -> list[SLATracker]:
    """Mark all open SLA trackers for an entity as responded (stops the clock).

    Sets responded_at to now and updates breach_status based on elapsed time.
    """
    trackers = await get_open_sla_for_entity(db, entity_type, entity_id)
    if not trackers:
        return []

    now = datetime.now(UTC)
    for tracker in trackers:
        tracker.responded_at = now
        elapsed_hours = (now - tracker.started_at).total_seconds() / 3600
        if elapsed_hours > tracker.sla_hours:
            tracker.breach_status = SLABreachStatus.breached.value
            logger.warning(
                f"SLA {tracker.id} closed as breached: "
                f"{elapsed_hours:.2f}h elapsed vs {tracker.sla_hours}h SLA"
            )
        else:
            tracker.breach_status = SLABreachStatus.within_sla.value
            logger.info(
                f"SLA {tracker.id} closed within SLA: "
                f"{elapsed_hours:.2f}h elapsed vs {tracker.sla_hours}h SLA"
            )

    await db.commit()
    for tracker in trackers:
        await db.refresh(tracker)

    logger.info(
        f"Closed {len(trackers)} SLA tracker(s) for {entity_type}:{entity_id}"
    )
    return trackers


async def get_breached_slas_with_details(
    db: AsyncSession,
    include_approaching: bool = True,
) -> list[dict[str, object]]:
    """Get breached (and optionally approaching) SLAs with calculated hours."""
    statuses = [SLABreachStatus.breached.value]
    if include_approaching:
        statuses.append(SLABreachStatus.approaching_breach.value)

    result = await db.execute(
        select(SLATracker)
        .where(SLATracker.responded_at.is_(None))
        .where(SLATracker.breach_status.in_(statuses))
        .order_by(SLATracker.started_at.asc())
    )
    trackers = result.scalars().all()

    now = datetime.now(UTC)
    tracker_data = []

    for tracker in trackers:
        elapsed_hours = (now - tracker.started_at).total_seconds() / 3600
        hours_remaining = max(0, tracker.sla_hours - elapsed_hours)
        overdue_hours = max(0, elapsed_hours - tracker.sla_hours)

        # Get assignee info
        assignee_result = await db.execute(select(User).where(User.id == tracker.assigned_to))
        assignee = assignee_result.scalar_one_or_none()

        tracker_dict = {
            "id": tracker.id,
            "entity_type": tracker.entity_type,
            "entity_id": tracker.entity_id,
            "communication_type": tracker.communication_type,
            "sla_hours": tracker.sla_hours,
            "started_at": tracker.started_at,
            "breach_status": tracker.breach_status,
            "assigned_to": tracker.assigned_to,
            "assigned_to_email": assignee.email if assignee else None,
            "assigned_to_name": assignee.full_name if assignee else None,
            "hours_elapsed": round(elapsed_hours, 2),
            "hours_remaining": round(hours_remaining, 2) if hours_remaining > 0 else None,
            "overdue_hours": round(overdue_hours, 2) if overdue_hours > 0 else None,
        }
        tracker_data.append(tracker_dict)

    return tracker_data
