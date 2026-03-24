"""Dashboard API — internal program health and portfolio summary."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, RLSContext, get_rm_client_ids, require_internal
from app.models.client import Client
from app.models.decision_request import DecisionRequest
from app.models.enums import UserRole
from app.models.escalation import Escalation
from app.models.partner import PartnerProfile
from app.models.program import Program
from app.models.sla_tracker import SLATracker
from app.schemas.dashboard import (
    ActivityFeedResponse,
    AlertsResponse,
    PortfolioSummary,
    ProgramHealthItem,
    ProgramHealthResponse,
    RealTimeStats,
)
from app.services.dashboard_aggregation_service import (
    get_activity_feed,
    get_dashboard_alerts,
    get_real_time_stats,
)
from app.services.report_service import compute_rag_status

router = APIRouter()


async def _build_program_health_items(
    db: AsyncSession,
    rm_client_ids: list[uuid.UUID] | None = None,
) -> list[ProgramHealthItem]:
    """Build health items for programs.

    Args:
        db: Database session.
        rm_client_ids: When provided, restrict results to programs whose
            client_id is in this list (used for RM-scoped views).
    """
    # Load programs with milestones and client
    prog_query = (
        select(Program)
        .options(selectinload(Program.milestones), selectinload(Program.client))
        .order_by(Program.created_at.desc())
    )
    if rm_client_ids is not None:
        prog_query = prog_query.where(Program.client_id.in_(rm_client_ids))

    result = await db.execute(prog_query)
    programs = list(result.scalars().all())

    # Batch-fetch escalation counts per program
    esc_query = (
        select(
            Escalation.program_id,
            func.count(Escalation.id).label("cnt"),
        )
        .where(Escalation.status.in_(["open", "acknowledged"]))
        .where(Escalation.program_id.is_not(None))
        .group_by(Escalation.program_id)
    )
    if rm_client_ids is not None:
        esc_query = esc_query.where(Escalation.client_id.in_(rm_client_ids))

    esc_result = await db.execute(esc_query)
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
async def get_program_health(
    db: DB, current_user: CurrentUser, _rls: RLSContext
) -> ProgramHealthResponse:
    """Return health data for every program the current user may see."""
    rm_client_ids: list[uuid.UUID] | None = None
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)

    items = await _build_program_health_items(db, rm_client_ids=rm_client_ids)
    return ProgramHealthResponse(programs=items, total=len(items))


@router.get(
    "/portfolio-summary",
    response_model=PortfolioSummary,
    dependencies=[Depends(require_internal)],
)
async def get_portfolio_summary(
    db: DB, current_user: CurrentUser, _rls: RLSContext
) -> PortfolioSummary:
    """Return aggregate portfolio statistics scoped to the current user's access."""
    is_rm = current_user.role == UserRole.relationship_manager
    rm_client_ids: list[uuid.UUID] | None = None
    if is_rm:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)

    # Program counts
    prog_status_query = select(Program.status, func.count(Program.id)).group_by(Program.status)
    if rm_client_ids is not None:
        prog_status_query = prog_status_query.where(Program.client_id.in_(rm_client_ids))

    prog_result = await db.execute(prog_status_query)
    status_counts: dict[str, int] = {}
    for row in prog_result.all():
        status_counts[row[0]] = row[1]

    total_programs = sum(status_counts.values())
    active_programs = sum(
        status_counts.get(s, 0) for s in ("active", "design", "intake", "on_hold")
    )
    completed_programs = status_counts.get("completed", 0)

    # Distinct clients
    client_query = select(func.count(func.distinct(Client.id)))
    if rm_client_ids is not None:
        client_query = client_query.where(Client.id.in_(rm_client_ids))

    client_result = await db.execute(client_query)
    total_clients = client_result.scalar_one()

    # RAG breakdown: need milestones loaded
    rag_prog_query = select(Program).options(selectinload(Program.milestones))
    if rm_client_ids is not None:
        rag_prog_query = rag_prog_query.where(Program.client_id.in_(rm_client_ids))

    prog_with_ms = await db.execute(rag_prog_query)
    rag_breakdown: dict[str, int] = {"red": 0, "amber": 0, "green": 0}
    for prog in prog_with_ms.scalars().all():
        rag = compute_rag_status(prog.milestones or [])
        rag_breakdown[rag] = rag_breakdown.get(rag, 0) + 1

    # Open escalations (scoped by client for RMs)
    esc_query = select(func.count(Escalation.id)).where(
        Escalation.status.in_(["open", "acknowledged"])
    )
    if rm_client_ids is not None:
        esc_query = esc_query.where(Escalation.client_id.in_(rm_client_ids))

    esc_count_result = await db.execute(esc_query)
    total_open_escalations = esc_count_result.scalar_one()

    # SLA breaches (not client-scoped — entity_id is opaque, keep global count)
    sla_count_result = await db.execute(
        select(func.count(SLATracker.id)).where(
            SLATracker.breach_status.in_(["breached", "approaching_breach"])
        )
    )
    total_sla_breaches = sla_count_result.scalar_one()

    # Pending decisions (scoped by client_id for RMs — DecisionRequest.client_id
    # references client_profiles.id, which isn't the same as Client.id, so we
    # keep a global count for RMs to avoid a cross-table join with ClientProfile)
    dec_count_result = await db.execute(
        select(func.count(DecisionRequest.id)).where(DecisionRequest.status == "pending")
    )
    total_pending_decisions = dec_count_result.scalar_one()

    # Probationary partners: active partners with fewer than 3 completed engagements
    probationary_result = await db.execute(
        select(func.count(PartnerProfile.id)).where(
            PartnerProfile.status == "active",
            PartnerProfile.completed_assignments < 3,
        )
    )
    probationary_partner_count = probationary_result.scalar_one()

    return PortfolioSummary(
        total_programs=total_programs,
        active_programs=active_programs,
        completed_programs=completed_programs,
        total_clients=total_clients,
        rag_breakdown=rag_breakdown,
        total_open_escalations=total_open_escalations,
        total_sla_breaches=total_sla_breaches,
        total_pending_decisions=total_pending_decisions,
        probationary_partner_count=probationary_partner_count,
    )


@router.get(
    "/at-risk-programs",
    response_model=ProgramHealthResponse,
    dependencies=[Depends(require_internal)],
)
async def get_at_risk_programs(
    db: DB, current_user: CurrentUser, _rls: RLSContext
) -> ProgramHealthResponse:
    """Return programs with red RAG status or active escalations."""
    rm_client_ids: list[uuid.UUID] | None = None
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)

    items = await _build_program_health_items(db, rm_client_ids=rm_client_ids)
    at_risk = [
        item for item in items if item.rag_status == "red" or item.active_escalation_count > 0
    ]
    return ProgramHealthResponse(programs=at_risk, total=len(at_risk))


@router.get(
    "/real-time-stats",
    response_model=RealTimeStats,
    dependencies=[Depends(require_internal)],
)
async def get_realtime_stats(
    db: DB, current_user: CurrentUser, _rls: RLSContext
) -> RealTimeStats:
    """Return live dashboard counts for the current user."""
    return await get_real_time_stats(db, current_user.id)


@router.get(
    "/activity-feed",
    response_model=ActivityFeedResponse,
    dependencies=[Depends(require_internal)],
)
async def get_activity_feed_endpoint(
    db: DB,
    _rls: RLSContext,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> ActivityFeedResponse:
    """Return recent activity across all entities."""
    items, total = await get_activity_feed(db, skip=skip, limit=limit)
    return ActivityFeedResponse(items=items, total=total)


@router.get(
    "/alerts",
    response_model=AlertsResponse,
    dependencies=[Depends(require_internal)],
)
async def get_alerts_endpoint(db: DB, _rls: RLSContext) -> AlertsResponse:
    """Return actionable alerts for the dashboard."""
    alerts, total = await get_dashboard_alerts(db)
    return AlertsResponse(alerts=alerts, total=total)
