"""Escalation lifecycle workflow: create, status transitions, progression, reassignment."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EscalationLevel, EscalationStatus
from app.models.escalation import Escalation
from app.models.user import User

from ._constants import (
    ESCALATION_PROGRESSION,
    LEVEL_PROGRESSION,
    calculate_response_deadline,
)
from ._helpers import _has_open_escalation
from ._owner import determine_escalation_owner

logger = logging.getLogger(__name__)


async def create_escalation(
    db: AsyncSession,
    entity_type: str,
    entity_id: str,
    level: EscalationLevel,
    triggered_by: User,
    title: str,
    description: str | None = None,
    risk_factors: dict[str, object] | None = None,
    program_id: UUID | None = None,
    client_id: UUID | None = None,
) -> Escalation:
    """Create escalation and determine owner based on level + entity."""
    owner_id = await determine_escalation_owner(db, level, entity_type, entity_id)

    now = datetime.now(UTC)
    escalation = Escalation(
        level=level.value,
        status=EscalationStatus.open.value,
        title=title,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
        owner_id=owner_id,
        triggered_by=triggered_by.id,
        risk_factors=risk_factors,
        program_id=program_id,
        client_id=client_id,
        response_deadline=calculate_response_deadline(level.value, now),
        escalation_chain=[
            {
                "action": "triggered",
                "at": now.isoformat(),
                "by": triggered_by.email,
            }
        ],
    )
    db.add(escalation)
    await db.commit()
    await db.refresh(escalation)

    logger.info(
        "Escalation created: %s - %s for %s:%s",
        escalation.id,
        level.value,
        entity_type,
        entity_id,
    )

    # Broadcast real-time update via WebSocket to owner and triggerer
    try:
        from app.api.ws_connection import connection_manager

        ws_payload: dict[str, object] = {
            "type": "escalation",
            "action": "created",
            "data": {
                "id": str(escalation.id),
                "level": escalation.level,
                "status": escalation.status,
                "title": escalation.title,
                "entity_type": escalation.entity_type,
                "entity_id": escalation.entity_id,
                "program_id": str(escalation.program_id) if escalation.program_id else None,
            },
        }
        await connection_manager.send_personal(ws_payload, escalation.owner_id)
        if triggered_by.id != escalation.owner_id:
            await connection_manager.send_personal(ws_payload, triggered_by.id)
    except Exception:
        logger.exception("Failed to broadcast escalation creation for %s", escalation.id)

    return escalation


async def update_escalation_status(
    db: AsyncSession,
    escalation_id: UUID,
    new_status: EscalationStatus,
    user: User,
    notes: str | None = None,
) -> Escalation:
    """Update status, update timestamps, send notifications."""
    result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise ValueError(f"Escalation {escalation_id} not found")

    escalation.status = new_status

    # Update timestamps based on status
    now = datetime.now(UTC)
    if new_status == EscalationStatus.acknowledged and not escalation.acknowledged_at:
        escalation.acknowledged_at = now
    elif new_status == EscalationStatus.resolved and not escalation.resolved_at:
        escalation.resolved_at = now
    elif new_status == EscalationStatus.closed and not escalation.closed_at:
        escalation.closed_at = now

    if notes:
        escalation.resolution_notes = notes

    # Update escalation chain
    escalation.escalation_chain = escalation.escalation_chain or []
    escalation.escalation_chain.append(
        {
            "action": "status_change",
            "from": escalation.status,
            "to": new_status.value,
            "at": now.isoformat(),
            "by": user.email,
            "notes": notes,
        }
    )

    await db.commit()
    await db.refresh(escalation)

    logger.info("Escalation %s updated to %s by %s", escalation_id, new_status.value, user.email)

    # Broadcast real-time update via WebSocket to owner and triggerer
    try:
        from app.api.ws_connection import connection_manager

        ws_payload: dict[str, object] = {
            "type": "escalation",
            "action": "updated",
            "data": {
                "id": str(escalation.id),
                "level": escalation.level,
                "status": escalation.status,
                "title": escalation.title,
                "entity_type": escalation.entity_type,
                "entity_id": escalation.entity_id,
            },
        }
        await connection_manager.send_personal(ws_payload, escalation.owner_id)
        if escalation.triggered_by and escalation.triggered_by != escalation.owner_id:
            await connection_manager.send_personal(ws_payload, escalation.triggered_by)
    except Exception:
        logger.exception("Failed to broadcast escalation update for %s", escalation_id)

    return escalation


async def progress_escalation_chain(
    db: AsyncSession,
    escalation_id: UUID,
    user: User,
    notes: str | None = None,
) -> Escalation:
    """Advance an escalation to the next level in the chain.

    E.g. task → milestone → program → client_impact.
    Appends an entry to the escalation_chain JSONB with timestamps and level transition info.
    """
    result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise ValueError(f"Escalation {escalation_id} not found")

    if escalation.status in (EscalationStatus.resolved.value, EscalationStatus.closed.value):
        raise ValueError("Cannot progress a resolved or closed escalation")

    current_level = EscalationLevel(escalation.level)

    # Find next level
    try:
        current_idx = LEVEL_PROGRESSION.index(current_level)
    except ValueError as err:
        raise ValueError(f"Unknown escalation level: {current_level}") from err

    if current_idx >= len(LEVEL_PROGRESSION) - 1:
        raise ValueError(
            f"Escalation is already at the highest level ({current_level.value})"
        )

    next_level = LEVEL_PROGRESSION[current_idx + 1]

    # Update escalation level
    from_level = escalation.level
    escalation.level = next_level

    # Re-determine owner for the new level
    new_owner_id = await determine_escalation_owner(
        db, next_level, escalation.entity_type, escalation.entity_id
    )
    escalation.owner_id = new_owner_id

    # Append to escalation chain
    now = datetime.now(UTC)
    escalation.escalation_chain = escalation.escalation_chain or []
    escalation.escalation_chain.append(
        {
            "action": "chain_progression",
            "from_level": from_level,
            "to_level": next_level.value,
            "at": now.isoformat(),
            "by": user.email,
            "notes": notes,
            "new_owner_id": str(new_owner_id),
        }
    )

    await db.commit()
    await db.refresh(escalation)

    logger.info(
        "Escalation %s progressed from %s to %s by %s",
        escalation_id,
        from_level,
        next_level.value,
        user.email,
    )

    # Broadcast real-time update via WebSocket
    try:
        from app.api.ws_connection import connection_manager

        ws_payload: dict[str, object] = {
            "type": "escalation",
            "action": "progressed",
            "data": {
                "id": str(escalation.id),
                "level": escalation.level,
                "status": escalation.status,
                "title": escalation.title,
                "from_level": from_level,
                "to_level": next_level.value,
            },
        }
        await connection_manager.send_personal(ws_payload, escalation.owner_id)
    except Exception:
        logger.exception("Failed to broadcast escalation progression for %s", escalation_id)

    return escalation


async def auto_progress_escalation(
    db: AsyncSession,
    escalation_id: UUID,
) -> Escalation | None:
    """Automatically progress an escalation to the next level if past deadline.

    Called by the scheduler job. Returns the updated escalation if progressed,
    or None if no progression was needed.
    """
    result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        return None

    if escalation.status not in (
        EscalationStatus.open.value,
        EscalationStatus.acknowledged.value,
    ):
        return None

    next_level_info = ESCALATION_PROGRESSION.get(escalation.level)
    if not next_level_info:
        return None  # Already at highest level

    next_level_str, threshold_hours = next_level_info
    hours_elapsed = (datetime.now(UTC) - escalation.triggered_at).total_seconds() / 3600
    if hours_elapsed < threshold_hours:
        return None  # Not past threshold yet

    next_level = EscalationLevel(next_level_str)

    # Resolve owner for the new level
    system_user_result = await db.execute(
        select(User).where(User.email == "system@amg.portal").limit(1)
    )
    system_user = system_user_result.scalar_one_or_none()
    if system_user is None:
        fallback_result = await db.execute(select(User).limit(1))
        system_user = fallback_result.scalar_one_or_none()

    new_owner_id = await determine_escalation_owner(
        db, next_level, escalation.entity_type, escalation.entity_id
    )

    now = datetime.now(UTC)
    parent_id = escalation.id

    # Create child escalation at next level
    child = Escalation(
        level=next_level.value,
        status=EscalationStatus.open.value,
        title=escalation.title,
        description=escalation.description,
        entity_type=escalation.entity_type,
        entity_id=escalation.entity_id,
        owner_id=new_owner_id,
        triggered_by=escalation.triggered_by,
        risk_factors=escalation.risk_factors,
        program_id=escalation.program_id,
        client_id=escalation.client_id,
        parent_escalation_id=parent_id,
        response_deadline=calculate_response_deadline(next_level.value, now),
        escalation_chain=[
            {
                "action": "auto_progressed",
                "at": now.isoformat(),
                "from_level": escalation.level,
                "to_level": next_level.value,
                "parent_id": str(parent_id),
            }
        ],
    )
    db.add(child)

    # Update parent chain
    escalation.escalation_chain = escalation.escalation_chain or []
    escalation.escalation_chain.append(
        {
            "action": "auto_progressed",
            "at": now.isoformat(),
            "to_level": next_level.value,
            "by": system_user.email if system_user else "system",
        }
    )

    await db.commit()
    await db.refresh(child)

    logger.info(
        "Auto-progressed escalation %s from %s to %s (child: %s)",
        parent_id,
        escalation.level,
        next_level.value,
        child.id,
    )

    # Notify new owner via WebSocket
    try:
        from app.api.ws_connection import connection_manager

        ws_payload: dict[str, object] = {
            "type": "escalation",
            "action": "auto_progressed",
            "data": {
                "id": str(child.id),
                "level": child.level,
                "status": child.status,
                "title": child.title,
                "parent_id": str(parent_id),
            },
        }
        await connection_manager.send_personal(ws_payload, new_owner_id)
    except Exception:
        logger.exception("Failed to broadcast auto-progression for escalation %s", parent_id)

    return child


async def create_escalation_from_sla_breach(
    db: AsyncSession,
    sla_tracker: object,
) -> Escalation | None:
    """Create an escalation from an SLA tracker that just breached.

    Maps entity_type → escalation level and deduplicates against existing open
    escalations for the same entity.

    Returns the created Escalation or None if skipped (duplicate).
    """
    from app.models.sla_tracker import SLATracker

    tracker: SLATracker = sla_tracker  # type: ignore[assignment]

    # Map entity_type to escalation level
    level_map: dict[str, EscalationLevel] = {
        "task": EscalationLevel.task,
        "milestone": EscalationLevel.milestone,
        "program": EscalationLevel.program,
    }
    level = level_map.get(tracker.entity_type, EscalationLevel.task)

    # Deduplication
    existing = await _has_open_escalation(db, tracker.entity_type, tracker.entity_id)
    if existing:
        logger.info(
            "Skipping SLA breach escalation for %s:%s — open escalation already exists",
            tracker.entity_type,
            tracker.entity_id,
        )
        return None

    # Resolve system user
    system_user_result = await db.execute(
        select(User).where(User.email == "system@amg.portal").limit(1)
    )
    system_user = system_user_result.scalar_one_or_none()
    if system_user is None:
        fallback_result = await db.execute(select(User).limit(1))
        system_user = fallback_result.scalar_one_or_none()
        if system_user is None:
            logger.error("No users found — cannot create SLA breach escalation")
            return None

    esc = await create_escalation(
        db=db,
        entity_type=tracker.entity_type,
        entity_id=tracker.entity_id,
        level=level,
        triggered_by=system_user,
        title=(
            f"SLA Breach: {tracker.communication_type.replace('_', ' ').title()} "
            f"on {tracker.entity_type} {tracker.entity_id[:8]}"
        ),
        description=(
            f"Automatic escalation: the {tracker.sla_hours}h response SLA for a "
            f"{tracker.communication_type.replace('_', ' ')} has been breached."
        ),
        risk_factors={
            "trigger_type": "sla_breach",
            "sla_hours": tracker.sla_hours,
            "communication_type": tracker.communication_type,
            "breach_status": tracker.breach_status,
        },
    )

    logger.info(
        "Created SLA breach escalation %s for %s:%s",
        esc.id,
        tracker.entity_type,
        tracker.entity_id,
    )
    return esc


async def reassign_escalation(
    db: AsyncSession,
    escalation_id: UUID,
    new_owner_id: UUID,
    user: User,
) -> Escalation:
    """Reassign an escalation to a new owner (MD only)."""
    result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise ValueError(f"Escalation {escalation_id} not found")

    old_owner_id = escalation.owner_id
    escalation.owner_id = new_owner_id

    now = datetime.now(UTC)
    escalation.escalation_chain = escalation.escalation_chain or []
    escalation.escalation_chain.append(
        {
            "action": "reassigned",
            "at": now.isoformat(),
            "by": user.email,
            "from_owner_id": str(old_owner_id),
            "to_owner_id": str(new_owner_id),
        }
    )

    await db.commit()
    await db.refresh(escalation)

    logger.info(
        "Escalation %s reassigned from %s to %s by %s",
        escalation_id,
        old_owner_id,
        new_owner_id,
        user.email,
    )

    # Notify new owner via WebSocket
    try:
        from app.api.ws_connection import connection_manager

        ws_payload: dict[str, object] = {
            "type": "escalation",
            "action": "reassigned",
            "data": {
                "id": str(escalation.id),
                "level": escalation.level,
                "status": escalation.status,
                "title": escalation.title,
            },
        }
        await connection_manager.send_personal(ws_payload, new_owner_id)
    except Exception:
        logger.exception("Failed to broadcast escalation reassignment for %s", escalation_id)

    return escalation
