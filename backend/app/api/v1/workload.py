"""Workload API — staff assignment and workload tracking."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, require_internal
from app.core.config import settings
from app.models.escalation import Escalation
from app.models.program import Program
from app.models.task import Task
from app.models.user import User
from app.schemas.workload import (
    CapacityItem,
    CapacityResponse,
    CapacitySummary,
    StaffAssignmentItem,
    StaffAssignmentsResponse,
    StaffWorkloadItem,
    WorkloadResponse,
    WorkloadSummary,
)

router = APIRouter()

# Constants for workload calculation
MAX_PROGRAMS = 10
MAX_ESCALATIONS = 5
MAX_TASKS = 20


def _calculate_workload_score(
    active_programs: int,
    pending_tasks: int,
    open_escalations: int,
) -> int:
    """Calculate a workload score (0-100)."""
    program_score = min(active_programs / MAX_PROGRAMS * 40, 40)
    task_score = min(pending_tasks / MAX_TASKS * 30, 30)
    escalation_score = min(open_escalations / MAX_ESCALATIONS * 30, 30)
    return int(program_score + task_score + escalation_score)


def _get_capacity_status(score: int) -> str:
    """Determine capacity status based on workload score."""
    if score < 50:
        return "available"
    elif score < 80:
        return "at_capacity"
    else:
        return "overloaded"


@router.get("/", response_model=WorkloadResponse, dependencies=[Depends(require_internal)])
async def get_workload_overview(db: DB) -> WorkloadResponse:
    """Get workload overview for all internal staff."""
    # Get internal users (excluding clients and partners)
    internal_roles = [
        "managing_director",
        "relationship_manager",
        "coordinator",
        "finance_compliance",
    ]
    users_result = await db.execute(
        select(User).where(User.role.in_(internal_roles), User.status == "active")
    )
    users = list(users_result.scalars().all())

    # Get all active programs (created by users)
    programs_result = await db.execute(
        select(Program).where(Program.status.in_(["active", "design", "intake"]))
    )
    programs = list(programs_result.scalars().all())

    # Count open escalations per owner
    esc_result = await db.execute(
        select(Escalation.owner_id, func.count(Escalation.id))
        .where(Escalation.status.in_(["open", "acknowledged", "investigating"]))
        .group_by(Escalation.owner_id)
    )
    escalation_counts = {str(row[0]): row[1] for row in esc_result.all()}

    # Count programs per creator
    program_counts: dict[str, int] = {}
    for prog in programs:
        creator_id = str(prog.created_by)
        program_counts[creator_id] = program_counts.get(creator_id, 0) + 1

    # Build staff workload items
    staff_items: list[StaffWorkloadItem] = []
    summary = WorkloadSummary(
        total_staff=len(users),
        available_staff=0,
        at_capacity_staff=0,
        overloaded_staff=0,
        total_open_escalations=sum(escalation_counts.values()),
        total_pending_approvals=0,
    )

    for user in users:
        user_id = str(user.id)

        # Get program count for user
        active_programs = program_counts.get(user_id, 0)

        # Get escalation count
        open_escalations = escalation_counts.get(user_id, 0)

        # For now, pending_tasks and pending_approvals are placeholder values
        # In a real implementation, these would come from a tasks/approvals table
        pending_tasks = 0
        pending_approvals = 0

        # Calculate workload score
        workload_score = _calculate_workload_score(
            active_programs, pending_tasks, open_escalations
        )
        capacity_status = _get_capacity_status(workload_score)

        # Update summary counts
        if capacity_status == "available":
            summary.available_staff += 1
        elif capacity_status == "at_capacity":
            summary.at_capacity_staff += 1
        else:
            summary.overloaded_staff += 1

        staff_items.append(
            StaffWorkloadItem(
                user_id=user_id,
                user_name=user.full_name,
                user_email=user.email,
                role=user.role,
                active_programs=active_programs,
                pending_tasks=pending_tasks,
                open_escalations=open_escalations,
                pending_approvals=pending_approvals,
                active_assignments=active_programs,
                workload_score=workload_score,
                capacity_status=capacity_status,
            )
        )

    return WorkloadResponse(staff=staff_items, summary=summary)


@router.get(
    "/capacity",
    response_model=CapacityResponse,
    dependencies=[Depends(require_internal)],
)
async def get_capacity_overview(db: DB) -> CapacityResponse:
    """Capacity planning — utilization per RM/Coordinator.

    For each internal staff member, returns:
    - active programs assigned (as creator)
    - open tasks assigned
    - utilization percentage relative to configurable capacity threshold
    - over-capacity flag
    """
    max_programs = settings.MAX_PROGRAMS_PER_RM

    internal_roles = [
        "managing_director",
        "relationship_manager",
        "coordinator",
        "finance_compliance",
    ]
    users_result = await db.execute(
        select(User).where(User.role.in_(internal_roles), User.status == "active")
    )
    users = list(users_result.scalars().all())

    # Programs per creator
    prog_result = await db.execute(
        select(Program.created_by, func.count(Program.id))
        .where(Program.status.in_(["active", "in_progress", "intake", "planning", "design"]))
        .group_by(Program.created_by)
    )
    program_counts: dict[str, int] = {str(row[0]): row[1] for row in prog_result.all()}

    # Open tasks per assignee
    task_result = await db.execute(
        select(Task.assigned_to, func.count(Task.id))
        .where(
            Task.status.notin_(["done", "cancelled"]),
            Task.assigned_to.isnot(None),
        )
        .group_by(Task.assigned_to)
    )
    task_counts: dict[str, int] = {str(row[0]): row[1] for row in task_result.all()}

    items: list[CapacityItem] = []
    available = 0
    at_cap = 0
    over_cap = 0
    total_util = 0.0

    for user in users:
        uid = str(user.id)
        active_progs = program_counts.get(uid, 0)
        open_tasks = task_counts.get(uid, 0)

        utilization = round((active_progs / max_programs) * 100, 1) if max_programs > 0 else 0.0
        is_over = active_progs > max_programs

        if utilization < 60:
            cap_status = "available"
            available += 1
        elif utilization <= 100:
            cap_status = "at_capacity"
            at_cap += 1
        else:
            cap_status = "over_capacity"
            over_cap += 1

        total_util += utilization

        items.append(
            CapacityItem(
                user_id=uid,
                user_name=user.full_name,
                user_email=user.email,
                role=user.role,
                active_programs=active_progs,
                open_tasks=open_tasks,
                max_programs=max_programs,
                utilization_pct=utilization,
                is_over_capacity=is_over,
                capacity_status=cap_status,
            )
        )

    # Sort by utilization descending
    items.sort(key=lambda i: i.utilization_pct, reverse=True)

    avg_util = round(total_util / len(users), 1) if users else 0.0

    return CapacityResponse(
        staff=items,
        summary=CapacitySummary(
            total_staff=len(users),
            available_count=available,
            at_capacity_count=at_cap,
            over_capacity_count=over_cap,
            avg_utilization_pct=avg_util,
        ),
    )


@router.get(
    "/{user_id}/assignments",
    response_model=StaffAssignmentsResponse,
    dependencies=[Depends(require_internal)],
)
async def get_staff_assignments(user_id: uuid.UUID, db: DB) -> StaffAssignmentsResponse:
    """Get all program assignments for a specific staff member."""
    # Get user
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get programs created by the user
    programs_result = await db.execute(
        select(Program)
        .options(selectinload(Program.client))
        .where(
            Program.created_by == user_id,
            Program.status.in_(["active", "design", "intake", "on_hold"]),
        )
    )
    programs = list(programs_result.scalars().all())

    # Get escalation counts per program
    all_program_ids = [p.id for p in programs]
    esc_counts: dict[str, int] = {}
    if all_program_ids:
        esc_result = await db.execute(
            select(Escalation.program_id, func.count(Escalation.id))
            .where(
                Escalation.status.in_(["open", "acknowledged", "investigating"]),
                Escalation.program_id.in_(all_program_ids),
            )
            .group_by(Escalation.program_id)
        )
        esc_counts = {str(row[0]): row[1] for row in esc_result.all()}

    # Build assignment items
    assignments: list[StaffAssignmentItem] = []

    for prog in programs:
        pid = str(prog.id)
        assignments.append(
            StaffAssignmentItem(
                id=f"{pid}-creator",
                program_id=pid,
                program_title=prog.title,
                client_name=prog.client.name if prog.client else "Unknown",
                role="creator",
                assigned_at=prog.created_at.isoformat(),
                program_status=prog.status,
                active_escalations=esc_counts.get(pid, 0),
            )
        )

    return StaffAssignmentsResponse(assignments=assignments, total=len(assignments))
