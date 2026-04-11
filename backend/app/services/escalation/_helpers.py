"""Shared escalation helpers for deduplication queries."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EscalationStatus
from app.models.escalation import Escalation


async def _load_open_escalation_set(
    db: AsyncSession,
    entity_ids: list[str],
) -> set[tuple[str, str]]:
    """Batch-load open/acknowledged/investigating escalations for a list of entity IDs.

    Returns a set of (entity_type, entity_id) tuples for fast membership testing.
    """
    if not entity_ids:
        return set()
    result = await db.execute(
        select(Escalation.entity_type, Escalation.entity_id).where(
            Escalation.entity_id.in_(entity_ids),
            Escalation.status.in_(
                [
                    EscalationStatus.open.value,
                    EscalationStatus.acknowledged.value,
                    EscalationStatus.investigating.value,
                ]
            ),
        )
    )
    return {(row.entity_type, row.entity_id) for row in result.all()}


async def _has_open_escalation(
    db: AsyncSession, entity_type: str, entity_id: str
) -> bool:
    """Check if an open/acknowledged escalation already exists for an entity."""
    result = await db.execute(
        select(func.count(Escalation.id)).where(
            Escalation.entity_type == entity_type,
            Escalation.entity_id == entity_id,
            Escalation.status.in_(
                [
                    EscalationStatus.open.value,
                    EscalationStatus.acknowledged.value,
                    EscalationStatus.investigating.value,
                ]
            ),
        )
    )
    count = result.scalar_one()
    return count > 0
