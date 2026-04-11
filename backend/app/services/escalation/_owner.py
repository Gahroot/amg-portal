"""Determine escalation owner based on level and entity."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EscalationLevel
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.task import Task
from app.models.user import User


async def determine_escalation_owner(
    db: AsyncSession,
    level: EscalationLevel,
    entity_type: str,
    entity_id: str,
) -> UUID:
    """
    Determine owner based on escalation hierarchy:
    - task-level      → Coordinator (task.assigned_to or program creator)
    - milestone-level → RM (client's relationship manager)
    - program-level   → MD (managing director)
    - client_impact   → MD (managing director)
    """
    owner_id: UUID | None = None

    if level in (EscalationLevel.program, EscalationLevel.client_impact):
        # Managing Director owns program-level and client-impact escalations
        result = await db.execute(
            select(User.id)
            .where(User.role == "managing_director", User.status == "active")
            .order_by(User.created_at)
            .limit(1)
        )
        owner_id = result.scalar_one_or_none()

    elif level == EscalationLevel.milestone:
        # RM owns milestone-level escalations.
        # Resolve via: milestone → program → client → rm_id
        if entity_type == "milestone":
            from app.models.client import Client

            result = await db.execute(
                select(Client.rm_id)
                .join(Program, Program.client_id == Client.id)
                .join(Milestone, Milestone.program_id == Program.id)
                .where(Milestone.id == entity_id)
            )
            owner_id = result.scalar_one_or_none()

        if not owner_id:
            # Fallback to any active RM
            result = await db.execute(
                select(User.id)
                .where(User.role == "relationship_manager", User.status == "active")
                .order_by(User.created_at)
                .limit(1)
            )
            owner_id = result.scalar_one_or_none()

    elif level == EscalationLevel.task:
        # Coordinator owns task-level escalations: task assignee first, then program creator
        if entity_type == "task":
            result = await db.execute(select(Task.assigned_to).where(Task.id == entity_id))
            owner_id = result.scalar_one_or_none()

            if not owner_id:
                # Fallback to program creator (coordinator role)
                result = await db.execute(
                    select(Program.created_by)
                    .join(Milestone, Milestone.program_id == Program.id)
                    .join(Task, Task.milestone_id == Milestone.id)
                    .where(Task.id == entity_id)
                )
                owner_id = result.scalar_one_or_none()

        if not owner_id:
            # Fallback to any active coordinator
            result = await db.execute(
                select(User.id)
                .where(User.role == "coordinator", User.status == "active")
                .order_by(User.created_at)
                .limit(1)
            )
            owner_id = result.scalar_one_or_none()

    # Ultimate fallback: first managing director (active or any)
    if owner_id is None:
        result = await db.execute(
            select(User.id)
            .where(User.role == "managing_director")
            .order_by(User.created_at)
            .limit(1)
        )
        owner_id = result.scalar_one_or_none()

    if owner_id is None:
        raise ValueError("No valid owner found for escalation")

    return owner_id
