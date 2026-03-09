"""Dashboard API — internal program health and portfolio summary."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import DB, require_internal
from app.models.client import Client
from app.models.decision_request import DecisionRequest
from app.models.escalation import Escalation
from app.models.program import Program
from app.models.sla_tracker import SLATracker
from app.schemas.dashboard import (
    PortfolioSummary,
    ProgramHealthItem,
    ProgramHealthResponse,
)
from app.services.report_service import compute_rag_status

router = APIRouter()


async def _build_program_health_items(
    db: AsyncSession,
) -> list[ProgramHealthItem]:
    """Build health items for all programs."""
    # Load programs with milestones and client
    result = await db.execute(
        select(Program)
        .options(selectinload(Program.milestones), selectinload(Program.client))
        .order_by(Program.created_at.desc())
    )
    programs = list(result.scalars().all())

    # Batch-fetch escalation counts per program
    esc_result = await db.execute(
        select(
            Escalation.program_id,
            func.count(Escalation.id).label("cnt"),
        )
        .where(Escalation.status.in_(["open", "acknowledged"]))
        .where(Escalation.program_id.is_not(None))
        .group_by(Escalation.program_id)
    )
    esc_map: dict[str, int] = {str(row.program_id): row.cnt for row in esc_result.all()}

    # Batch-fetch SLA breach counts — SLATracker uses entity_type/entity_id
    # We look for breached/approaching entries that reference programs
    sla_result = await db.execute(
        select(
            SLATracker.entity_id,
            func.count(SLATracker.id).label("cnt"),
        )
        .where(
            SLATracker.breach_status.in_(["breached", "approaching_breach"]),
        )
        .group_by(SLATracker.entity_id)
    )
    sla_map: dict[str, int] = {row.entity_id: row.cnt for row in sla_result.all()}

    items: list[ProgramHealthItem] = []
    for prog in programs:
        milestones = prog.milestones or []
        milestone_count = len(milestones)
        completed = sum(1 for m in milestones if m.status == "completed")
        progress = (completed / milestone_count * 100) if milestone_count > 0 else 0.0
        rag = compute_rag_status(milestones)

        client_name = prog.client.name if prog.client else "Unknown"
        pid = str(prog.id)

        items.append(
            ProgramHealthItem(
                id=prog.id,
                title=prog.title,
                status=prog.status,
                client_name=client_name,
                rag_status=rag,
                milestone_count=milestone_count,
                completed_milestone_count=completed,
                milestone_progress=round(progress, 1),
                active_escalation_count=esc_map.get(pid, 0),
                sla_breach_count=sla_map.get(pid, 0),
            )
        )

    return items


@router.get(
    "/program-health",
    response_model=ProgramHealthResponse,
    dependencies=[Depends(require_internal)],
)
async def get_program_health(db: DB) -> ProgramHealthResponse:
    """Return health data for every program."""
    items = await _build_program_health_items(db)
    return ProgramHealthResponse(programs=items, total=len(items))


@router.get(
    "/portfolio-summary",
    response_model=PortfolioSummary,
    dependencies=[Depends(require_internal)],
)
async def get_portfolio_summary(db: DB) -> PortfolioSummary:
    """Return aggregate portfolio statistics."""
    # Program counts
    prog_result = await db.execute(
        select(Program.status, func.count(Program.id)).group_by(Program.status)
    )
    status_counts: dict[str, int] = {}
    for row in prog_result.all():
        status_counts[row[0]] = row[1]

    total_programs = sum(status_counts.values())
    active_programs = sum(
        status_counts.get(s, 0) for s in ("active", "design", "intake", "on_hold")
    )
    completed_programs = status_counts.get("completed", 0)

    # Distinct clients
    client_result = await db.execute(select(func.count(func.distinct(Client.id))))
    total_clients = client_result.scalar_one()

    # RAG breakdown: need milestones loaded
    prog_with_ms = await db.execute(select(Program).options(selectinload(Program.milestones)))
    rag_breakdown: dict[str, int] = {"red": 0, "amber": 0, "green": 0}
    for prog in prog_with_ms.scalars().all():
        rag = compute_rag_status(prog.milestones or [])
        rag_breakdown[rag] = rag_breakdown.get(rag, 0) + 1

    # Open escalations
    esc_count_result = await db.execute(
        select(func.count(Escalation.id)).where(Escalation.status.in_(["open", "acknowledged"]))
    )
    total_open_escalations = esc_count_result.scalar_one()

    # SLA breaches
    sla_count_result = await db.execute(
        select(func.count(SLATracker.id)).where(
            SLATracker.breach_status.in_(["breached", "approaching_breach"])
        )
    )
    total_sla_breaches = sla_count_result.scalar_one()

    # Pending decisions
    dec_count_result = await db.execute(
        select(func.count(DecisionRequest.id)).where(DecisionRequest.status == "pending")
    )
    total_pending_decisions = dec_count_result.scalar_one()

    return PortfolioSummary(
        total_programs=total_programs,
        active_programs=active_programs,
        completed_programs=completed_programs,
        total_clients=total_clients,
        rag_breakdown=rag_breakdown,
        total_open_escalations=total_open_escalations,
        total_sla_breaches=total_sla_breaches,
        total_pending_decisions=total_pending_decisions,
    )


@router.get(
    "/at-risk-programs",
    response_model=ProgramHealthResponse,
    dependencies=[Depends(require_internal)],
)
async def get_at_risk_programs(db: DB) -> ProgramHealthResponse:
    """Return programs with red RAG status or active escalations."""
    items = await _build_program_health_items(db)
    at_risk = [
        item for item in items if item.rag_status == "red" or item.active_escalation_count > 0
    ]
    return ProgramHealthResponse(programs=at_risk, total=len(at_risk))
