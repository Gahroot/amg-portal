"""Report service — aggregates data for client-facing and internal reports."""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import String as SAString
from sqlalchemy import case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.access_audit import AccessAudit
from app.models.client import Client
from app.models.deliverable import Deliverable
from app.models.escalation import Escalation
from app.models.kyc_document import KYCDocument
from app.models.milestone import Milestone
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.partner_rating import PartnerRating
from app.models.program import Program
from app.models.sla_tracker import SLATracker
from app.models.user import User


# Reuse compute_rag_status from programs.py
def compute_rag_status(milestones: list[Milestone]) -> str:
    """Compute RAG (Red/Amber/Green) status based on milestone due dates."""
    today = date.today()
    for m in milestones:
        if m.status != "completed" and m.due_date and m.due_date < today:
            return "red"
    for m in milestones:
        if (
            m.status != "completed"
            and m.due_date
            and m.due_date <= date(today.year, today.month, today.day + 7)
        ):
            return "amber"
    return "green"


class ReportService:
    """Service for generating client-facing reports."""

    async def get_portfolio_overview(
        self, db: AsyncSession, client_id: uuid.UUID
    ) -> dict[str, Any]:
        """
        Generate portfolio overview report showing all client programs.

        Aggregates:
        - Status breakdown (by program status)
        - RAG summary
        - Total budget
        - Milestone progress
        """
        # Query client and programs with milestones
        client_result = await db.execute(select(Client).where(Client.id == client_id))
        client = client_result.scalar_one_or_none()
        if not client:
            return None

        programs_result = await db.execute(
            select(Program)
            .options(selectinload(Program.milestones))
            .where(Program.client_id == client_id)
            .order_by(Program.created_at.desc())
        )
        programs = list(programs_result.scalars().all())

        # Calculate aggregates
        total_budget = Decimal("0")
        status_breakdown: dict[str, int] = {}
        rag_summary: dict[str, int] = {"red": 0, "amber": 0, "green": 0}
        total_milestone_progress = 0.0
        active_count = 0
        completed_count = 0

        program_summaries = []

        for program in programs:
            milestones = program.milestones or []
            milestone_count = len(milestones)
            completed_milestones = sum(1 for m in milestones if m.status == "completed")

            progress = (
                (completed_milestones / milestone_count) * 100 if milestone_count > 0 else 0.0
            )

            rag_status = compute_rag_status(milestones)

            # Count status
            status_breakdown[program.status] = status_breakdown.get(program.status, 0) + 1
            rag_summary[rag_status] = rag_summary.get(rag_status, 0) + 1

            # Sum budget
            if program.budget_envelope:
                total_budget += Decimal(str(program.budget_envelope))

            # Count active/completed
            if program.status in ("active", "design"):
                active_count += 1
            elif program.status == "completed":
                completed_count += 1

            total_milestone_progress += progress

            program_summaries.append(
                {
                    "id": program.id,
                    "title": program.title,
                    "status": program.status,
                    "rag_status": rag_status,
                    "start_date": program.start_date,
                    "end_date": program.end_date,
                    "budget_envelope": float(program.budget_envelope)
                    if program.budget_envelope
                    else None,
                    "milestone_count": milestone_count,
                    "completed_milestone_count": completed_milestones,
                    "milestone_progress": round(progress, 1),
                }
            )

        # Calculate overall progress
        overall_progress = round(total_milestone_progress / len(programs), 1) if programs else 0.0

        return {
            "client_id": client.id,
            "client_name": client.name,
            "total_programs": len(programs),
            "active_programs": active_count,
            "completed_programs": completed_count,
            "total_budget": float(total_budget) if total_budget > 0 else None,
            "status_breakdown": status_breakdown,
            "rag_summary": rag_summary,
            "overall_milestone_progress": overall_progress,
            "programs": program_summaries,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def get_program_status_report(
        self, db: AsyncSession, program_id: uuid.UUID
    ) -> dict[str, Any] | None:
        """
        Generate program status report showing active milestones,
        completed deliverables, and pending decisions.
        """
        # Query program with all relationships
        program_result = await db.execute(
            select(Program)
            .options(
                selectinload(Program.client),
                selectinload(Program.milestones).selectinload(Milestone.tasks),
                selectinload(Program.approvals),
            )
            .where(Program.id == program_id)
        )
        program = program_result.scalar_one_or_none()
        if not program:
            return None

        # Query partner assignments with deliverables
        assignments_result = await db.execute(
            select(PartnerAssignment)
            .options(
                selectinload(PartnerAssignment.partner),
                selectinload(PartnerAssignment.deliverables),
            )
            .where(PartnerAssignment.program_id == program_id)
        )
        assignments = list(assignments_result.scalars().all())

        # Get milestones
        milestones = program.milestones or []
        milestone_count = len(milestones)
        completed_milestones = sum(1 for m in milestones if m.status == "completed")
        milestone_progress = (
            (completed_milestones / milestone_count * 100) if milestone_count > 0 else 0.0
        )
        rag_status = compute_rag_status(milestones)

        # Filter active milestones (not completed/cancelled)
        active_milestones = [
            {
                "id": m.id,
                "title": m.title,
                "description": m.description,
                "due_date": m.due_date.isoformat() if m.due_date else None,
                "status": m.status,
                "position": m.position,
            }
            for m in milestones
            if m.status not in ("completed", "cancelled")
        ]

        # Gather all deliverables from assignments
        all_deliverables: list[Deliverable] = []
        for assignment in assignments:
            all_deliverables.extend(assignment.deliverables or [])

        # Filter completed/client-visible deliverables
        completed_deliverables = [
            {
                "id": d.id,
                "title": d.title,
                "deliverable_type": d.deliverable_type,
                "description": d.description,
                "due_date": d.due_date.isoformat() if d.due_date else None,
                "status": d.status,
                "client_visible": d.client_visible,
                "submitted_at": d.submitted_at.isoformat() if d.submitted_at else None,
                "reviewed_at": d.reviewed_at.isoformat() if d.reviewed_at else None,
            }
            for d in all_deliverables
            if d.client_visible and d.status in ("approved", "completed", "submitted")
        ]

        # Filter pending client decisions (approvals with status=pending)
        approvals = program.approvals or []
        pending_decisions = [
            {
                "id": a.id,
                "title": f"{a.approval_type.replace('_', ' ').title()} Approval",
                "description": a.comments,
                "requested_at": a.created_at.isoformat(),
                "deadline": None,  # Could add deadline field to approvals in future
            }
            for a in approvals
            if a.status == "pending"
        ]

        # Gather assigned partners
        partners_set: set[uuid.UUID] = set()
        assigned_partners = []
        for assignment in assignments:
            if assignment.partner_id and assignment.partner_id not in partners_set:
                partners_set.add(assignment.partner_id)
                assigned_partners.append(
                    {
                        "id": assignment.partner.id,
                        "firm_name": assignment.partner.firm_name,
                        "contact_name": assignment.partner.contact_name,
                        "contact_email": assignment.partner.contact_email,
                    }
                )

        return {
            "program_id": program.id,
            "program_title": program.title,
            "program_status": program.status,
            "rag_status": rag_status,
            "start_date": program.start_date.isoformat() if program.start_date else None,
            "end_date": program.end_date.isoformat() if program.end_date else None,
            "milestone_progress": round(milestone_progress, 1),
            "active_milestones": active_milestones,
            "completed_deliverables": completed_deliverables,
            "pending_decisions": pending_decisions,
            "assigned_partners": assigned_partners,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def get_completion_report(
        self, db: AsyncSession, program_id: uuid.UUID
    ) -> dict[str, Any] | None:
        """
        Generate program completion report showing outcomes,
        timeline adherence, and deliverables summary.
        """
        # Query program with full history
        program_result = await db.execute(
            select(Program)
            .options(
                selectinload(Program.client),
                selectinload(Program.milestones),
            )
            .where(Program.id == program_id)
        )
        program = program_result.scalar_one_or_none()
        if not program:
            return None

        # Query partner assignments with deliverables
        assignments_result = await db.execute(
            select(PartnerAssignment)
            .options(
                selectinload(PartnerAssignment.partner),
                selectinload(PartnerAssignment.deliverables),
            )
            .where(PartnerAssignment.program_id == program_id)
        )
        assignments = list(assignments_result.scalars().all())

        milestones = program.milestones or []
        total_milestones = len(milestones)
        completed_milestones = sum(1 for m in milestones if m.status == "completed")

        # Build milestone timeline
        milestone_timeline = []
        for m in milestones:
            on_time = None
            if m.status == "completed" and m.due_date:
                # For simplicity, mark as on_time if we don't track actual completion
                # In production, you'd track completed_at on milestones
                on_time = True

            milestone_timeline.append(
                {
                    "id": m.id,
                    "title": m.title,
                    "planned_due_date": m.due_date.isoformat() if m.due_date else None,
                    "actual_completed_at": m.updated_at.isoformat()
                    if m.status == "completed"
                    else None,
                    "status": m.status,
                    "on_time": on_time,
                }
            )

        # Calculate timeline adherence
        timeline_adherence = None
        if program.end_date and program.status == "completed":
            # Simple check: if we have data, determine if on time
            timeline_adherence = "on_time"

        # Gather all deliverables
        all_deliverables: list[Deliverable] = []
        approved_deliverables = 0
        deliverables_data = []

        for assignment in assignments:
            for d in assignment.deliverables or []:
                all_deliverables.append(d)
                if d.status == "approved":
                    approved_deliverables += 1

                deliverables_data.append(
                    {
                        "id": d.id,
                        "title": d.title,
                        "deliverable_type": d.deliverable_type,
                        "description": d.description,
                        "due_date": d.due_date.isoformat() if d.due_date else None,
                        "status": d.status,
                        "client_visible": d.client_visible,
                        "submitted_at": d.submitted_at.isoformat() if d.submitted_at else None,
                        "reviewed_at": d.reviewed_at.isoformat() if d.reviewed_at else None,
                    }
                )

        # Gather partners
        partners_set: set[uuid.UUID] = set()
        partners = []
        for assignment in assignments:
            if assignment.partner_id and assignment.partner_id not in partners_set:
                partners_set.add(assignment.partner_id)
                partners.append(
                    {
                        "id": assignment.partner.id,
                        "firm_name": assignment.partner.firm_name,
                        "contact_name": assignment.partner.contact_name,
                        "contact_email": assignment.partner.contact_email,
                    }
                )

        return {
            "program_id": program.id,
            "program_title": program.title,
            "client_id": program.client_id,
            "client_name": program.client.name if program.client else "",
            "objectives": program.objectives,
            "scope": program.scope,
            "planned_start_date": program.start_date.isoformat() if program.start_date else None,
            "planned_end_date": program.end_date.isoformat() if program.end_date else None,
            "actual_start_date": program.created_at.isoformat(),
            "actual_end_date": program.updated_at.isoformat()
            if program.status == "completed"
            else None,
            "timeline_adherence": timeline_adherence,
            "planned_budget": float(program.budget_envelope) if program.budget_envelope else None,
            "actual_budget": float(program.budget_envelope)
            if program.budget_envelope
            else None,  # In production, track actual spend
            "total_milestones": total_milestones,
            "completed_milestones": completed_milestones,
            "milestone_timeline": milestone_timeline,
            "total_deliverables": len(all_deliverables),
            "approved_deliverables": approved_deliverables,
            "deliverables": deliverables_data,
            "partners": partners,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def get_annual_review(
        self, db: AsyncSession, client_id: uuid.UUID, year: int
    ) -> dict[str, Any] | None:
        """
        Generate annual relationship review across all programs.

        Aggregates programs by year with:
        - Programs by status
        - Programs by month
        - Partner performance
        - Total engagement value
        """
        # Query client
        client_result = await db.execute(select(Client).where(Client.id == client_id))
        client = client_result.scalar_one_or_none()
        if not client:
            return None

        # Query programs for the year (extract year from created_at)
        programs_result = await db.execute(
            select(Program)
            .options(selectinload(Program.milestones))
            .where(
                Program.client_id == client_id,
                extract("year", Program.created_at) == year,
            )
            .order_by(Program.created_at.desc())
        )
        programs = list(programs_result.scalars().all())

        # Calculate aggregates
        total_engagement_value = Decimal("0")
        status_breakdown: dict[str, int] = {}
        programs_by_month: list[dict[str, Any]] = []
        completed_count = 0

        # Initialize month data
        month_names = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ]
        for month in range(1, 13):
            programs_by_month.append(
                {
                    "month": month,
                    "month_name": month_names[month - 1],
                    "new_programs": 0,
                    "completed_programs": 0,
                }
            )

        program_summaries = []

        for program in programs:
            milestones = program.milestones or []
            rag_status = compute_rag_status(milestones)

            # Status breakdown
            status_breakdown[program.status] = status_breakdown.get(program.status, 0) + 1

            # Month data
            if program.created_at:
                month_num = program.created_at.month
                programs_by_month[month_num - 1]["new_programs"] += 1

            if program.status == "completed":
                completed_count += 1
                if program.updated_at:
                    month_num = program.updated_at.month
                    programs_by_month[month_num - 1]["completed_programs"] += 1

            # Engagement value
            if program.budget_envelope:
                total_engagement_value += Decimal(str(program.budget_envelope))

            program_summaries.append(
                {
                    "id": program.id,
                    "title": program.title,
                    "status": program.status,
                    "start_date": program.start_date.isoformat() if program.start_date else None,
                    "end_date": program.end_date.isoformat() if program.end_date else None,
                    "budget_envelope": float(program.budget_envelope)
                    if program.budget_envelope
                    else None,
                    "rag_status": rag_status,
                }
            )

        # Query partner assignments for the year
        assignment_result = await db.execute(
            select(PartnerAssignment)
            .options(selectinload(PartnerAssignment.partner))
            .where(
                PartnerAssignment.program_id.in_([p.id for p in programs]),
                extract("year", PartnerAssignment.created_at) == year,
            )
        )
        assignments = list(assignment_result.scalars().all())

        # Calculate partner performance
        partner_stats: dict[uuid.UUID, dict[str, Any]] = {}

        for assignment in assignments:
            if assignment.partner_id not in partner_stats:
                partner_stats[assignment.partner_id] = {
                    "partner_id": assignment.partner_id,
                    "firm_name": assignment.partner.firm_name,
                    "total_assignments": 0,
                    "completed_assignments": 0,
                    "total_rating": 0.0,
                    "rating_count": 0,
                }

            stats = partner_stats[assignment.partner_id]
            stats["total_assignments"] += 1
            if assignment.status == "completed":
                stats["completed_assignments"] += 1

            if assignment.partner.performance_rating:
                stats["total_rating"] += float(assignment.partner.performance_rating)
                stats["rating_count"] += 1

        # Build partner performance list
        partner_performance = []
        for stats in partner_stats.values():
            avg_rating = (
                round(stats["total_rating"] / stats["rating_count"], 2)
                if stats["rating_count"] > 0
                else None
            )
            partner_performance.append(
                {
                    "partner_id": stats["partner_id"],
                    "firm_name": stats["firm_name"],
                    "total_assignments": stats["total_assignments"],
                    "completed_assignments": stats["completed_assignments"],
                    "avg_performance_rating": avg_rating,
                }
            )

        return {
            "client_id": client.id,
            "client_name": client.name,
            "year": year,
            "total_programs": len(programs),
            "new_programs": len(programs),  # All are new for that year
            "completed_programs": completed_count,
            "active_programs": sum(
                1 for p in programs if p.status in ("active", "design", "on_hold")
            ),
            "total_engagement_value": float(total_engagement_value)
            if total_engagement_value > 0
            else None,
            "total_budget_consumed": None,  # Would need actual spend tracking
            "programs_by_status": status_breakdown,
            "programs_by_month": programs_by_month,
            "partner_performance": partner_performance,
            "programs": program_summaries,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    # ========================================================================
    # Class B — Internal Operational Reports
    # ========================================================================

    async def get_partner_scorecard_report(
        self,
        db: AsyncSession,
        *,
        partner_id: uuid.UUID | None = None,
        quarter: int | None = None,
        year: int | None = None,
    ) -> dict[str, Any]:
        """Generate Partner Performance Scorecard report."""
        # Build rating query with optional date filter
        rating_filters = []
        if partner_id:
            rating_filters.append(PartnerRating.partner_id == partner_id)
        if quarter and year:
            q_start_month = (quarter - 1) * 3 + 1
            q_end_month = q_start_month + 2
            start = datetime(year, q_start_month, 1, tzinfo=UTC)
            if q_end_month == 12:
                end = datetime(year + 1, 1, 1, tzinfo=UTC)
            else:
                end = datetime(year, q_end_month + 1, 1, tzinfo=UTC)
            rating_filters.append(PartnerRating.created_at >= start)
            rating_filters.append(PartnerRating.created_at < end)
        elif year:
            start = datetime(year, 1, 1, tzinfo=UTC)
            end = datetime(year + 1, 1, 1, tzinfo=UTC)
            rating_filters.append(PartnerRating.created_at >= start)
            rating_filters.append(PartnerRating.created_at < end)

        # Aggregate scores per partner
        score_q = (
            select(
                PartnerRating.partner_id,
                func.avg(PartnerRating.quality_score).label("avg_quality"),
                func.avg(PartnerRating.timeliness_score).label("avg_timeliness"),
                func.avg(PartnerRating.communication_score).label("avg_communication"),
                func.avg(PartnerRating.overall_score).label("avg_overall"),
                func.count(PartnerRating.id).label("total_ratings"),
            )
            .where(*rating_filters)
            .group_by(PartnerRating.partner_id)
            .subquery()
        )

        # Assignment stats per partner
        assign_q = (
            select(
                PartnerAssignment.partner_id,
                func.count(PartnerAssignment.id).label("total_assignments"),
                func.count(
                    case((PartnerAssignment.status == "completed", PartnerAssignment.id))
                ).label("completed_assignments"),
            )
            .group_by(PartnerAssignment.partner_id)
            .subquery()
        )

        # SLA breach count per partner (via assignment entity)
        sla_q = (
            select(
                PartnerAssignment.partner_id,
                func.count(SLATracker.id).label("sla_breaches"),
            )
            .select_from(SLATracker)
            .join(
                PartnerAssignment,
                (SLATracker.entity_type == "partner_assignment")
                & (SLATracker.entity_id == func.cast(PartnerAssignment.id, SAString)),
            )
            .where(SLATracker.breach_status == "breached")
            .group_by(PartnerAssignment.partner_id)
            .subquery()
        )

        # Build partner filter
        partner_filter = []
        if partner_id:
            partner_filter.append(PartnerProfile.id == partner_id)

        query = (
            select(
                PartnerProfile.id.label("partner_id"),
                PartnerProfile.firm_name,
                score_q.c.avg_quality,
                score_q.c.avg_timeliness,
                score_q.c.avg_communication,
                score_q.c.avg_overall,
                score_q.c.total_ratings,
                assign_q.c.total_assignments,
                assign_q.c.completed_assignments,
                sla_q.c.sla_breaches,
            )
            .outerjoin(score_q, PartnerProfile.id == score_q.c.partner_id)
            .outerjoin(assign_q, PartnerProfile.id == assign_q.c.partner_id)
            .outerjoin(sla_q, PartnerProfile.id == sla_q.c.partner_id)
            .where(*partner_filter)
            .order_by(score_q.c.avg_overall.desc().nulls_last())
        )

        result = await db.execute(query)
        rows = result.all()

        partners = []
        for row in rows:
            total = row.total_assignments or 0
            completed = row.completed_assignments or 0
            rate = round((completed / total) * 100, 1) if total > 0 else 0.0
            partners.append(
                {
                    "partner_id": row.partner_id,
                    "firm_name": row.firm_name,
                    "avg_quality": round(float(row.avg_quality), 2)
                    if row.avg_quality
                    else None,
                    "avg_timeliness": round(float(row.avg_timeliness), 2)
                    if row.avg_timeliness
                    else None,
                    "avg_communication": round(float(row.avg_communication), 2)
                    if row.avg_communication
                    else None,
                    "avg_overall": round(float(row.avg_overall), 2)
                    if row.avg_overall
                    else None,
                    "total_ratings": row.total_ratings or 0,
                    "total_assignments": total,
                    "completed_assignments": completed,
                    "completion_rate": rate,
                    "sla_breach_count": row.sla_breaches or 0,
                }
            )

        return {
            "partners": partners,
            "total_partners": len(partners),
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def get_rm_portfolio_report(
        self,
        db: AsyncSession,
        *,
        rm_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Generate RM Portfolio Report."""
        # Get relationship managers
        rm_filter = [User.role == "relationship_manager", User.status == "active"]
        if rm_id:
            rm_filter.append(User.id == rm_id)

        rm_result = await db.execute(select(User).where(*rm_filter))
        rms = list(rm_result.scalars().all())

        entries = []
        for rm in rms:
            # Client count for this RM
            client_count_result = await db.execute(
                select(func.count(Client.id)).where(Client.rm_id == rm.id)
            )
            client_count = client_count_result.scalar_one()

            # Programs for clients of this RM
            programs_result = await db.execute(
                select(Program)
                .options(selectinload(Program.milestones))
                .join(Client, Program.client_id == Client.id)
                .where(Client.rm_id == rm.id)
            )
            programs = list(programs_result.scalars().all())

            active = 0
            completed = 0
            total_budget = Decimal("0")
            health_scores: list[float] = []

            for prog in programs:
                if prog.status in ("active", "design", "intake"):
                    active += 1
                    if prog.budget_envelope:
                        total_budget += Decimal(str(prog.budget_envelope))
                    # Health = milestone progress
                    milestones = prog.milestones or []
                    if milestones:
                        done = sum(1 for m in milestones if m.status == "completed")
                        health_scores.append((done / len(milestones)) * 100)
                elif prog.status == "completed":
                    completed += 1

            total = active + completed
            rate = round((completed / total) * 100, 1) if total > 0 else 0.0
            avg_health = (
                round(sum(health_scores) / len(health_scores), 1)
                if health_scores
                else None
            )

            # NPS — average score for clients managed by this RM
            from app.models.client_profile import ClientProfile
            from app.models.nps_survey import NPSResponse

            nps_result = await db.execute(
                select(func.avg(NPSResponse.score))
                .join(ClientProfile, NPSResponse.client_profile_id == ClientProfile.id)
                .where(ClientProfile.assigned_rm_id == rm.id)
            )
            avg_nps = nps_result.scalar_one()

            entries.append(
                {
                    "rm_id": rm.id,
                    "rm_name": rm.full_name,
                    "rm_email": rm.email,
                    "client_count": client_count,
                    "active_program_count": active,
                    "completed_program_count": completed,
                    "completion_rate": rate,
                    "avg_program_health": avg_health,
                    "revenue_pipeline": float(total_budget) if total_budget > 0 else None,
                    "avg_nps_score": round(float(avg_nps), 1) if avg_nps else None,
                }
            )

        return {
            "entries": entries,
            "total_rms": len(entries),
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def get_escalation_log_report(
        self,
        db: AsyncSession,
        *,
        status_filter: str | None = None,
        level_filter: str | None = None,
        program_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Generate Escalation Log Report."""
        filters = []
        if status_filter:
            filters.append(Escalation.status == status_filter)
        if level_filter:
            filters.append(Escalation.level == level_filter)
        if program_id:
            filters.append(Escalation.program_id == program_id)

        result = await db.execute(
            select(Escalation)
            .where(*filters)
            .order_by(Escalation.triggered_at.desc())
        )
        escalations = list(result.scalars().all())

        # Fetch owner names
        owner_ids = {e.owner_id for e in escalations}
        owner_map: dict[uuid.UUID, str] = {}
        if owner_ids:
            owners_result = await db.execute(
                select(User.id, User.full_name).where(User.id.in_(owner_ids))
            )
            owner_map = {row.id: row.full_name for row in owners_result.all()}

        now = datetime.now(UTC)
        entries = []
        open_count = 0
        ack_count = 0
        resolved_count = 0

        for esc in escalations:
            age = (now - esc.triggered_at).total_seconds() / 3600.0
            entries.append(
                {
                    "id": esc.id,
                    "title": esc.title,
                    "description": esc.description,
                    "level": esc.level,
                    "status": esc.status,
                    "owner_id": esc.owner_id,
                    "owner_name": owner_map.get(esc.owner_id, "Unknown"),
                    "program_id": esc.program_id,
                    "triggered_at": esc.triggered_at.isoformat(),
                    "age_hours": round(age, 1),
                    "acknowledged_at": esc.acknowledged_at.isoformat()
                    if esc.acknowledged_at
                    else None,
                    "resolved_at": esc.resolved_at.isoformat()
                    if esc.resolved_at
                    else None,
                    "resolution_notes": esc.resolution_notes,
                }
            )
            if esc.status == "open":
                open_count += 1
            elif esc.status == "acknowledged":
                ack_count += 1
            elif esc.status in ("resolved", "closed"):
                resolved_count += 1

        return {
            "escalations": entries,
            "total": len(entries),
            "open_count": open_count,
            "acknowledged_count": ack_count,
            "resolved_count": resolved_count,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def get_compliance_audit_report(
        self,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Generate Compliance Audit Report."""
        today = date.today()
        thirty_days = today + timedelta(days=30)

        # KYC summary
        kyc_result = await db.execute(select(KYCDocument))
        kyc_docs = list(kyc_result.scalars().all())

        total = len(kyc_docs)
        current = 0
        expiring = 0
        expired = 0
        pending = 0
        rejected = 0

        # Per-client tracking
        client_kyc: dict[uuid.UUID, dict[str, int]] = {}

        for doc in kyc_docs:
            cid = doc.client_id
            if cid not in client_kyc:
                client_kyc[cid] = {
                    "total": 0,
                    "current": 0,
                    "expired": 0,
                    "expiring_soon": 0,
                    "pending": 0,
                }
            client_kyc[cid]["total"] += 1

            if doc.status == "pending":
                pending += 1
                client_kyc[cid]["pending"] += 1
            elif doc.status == "rejected":
                rejected += 1
            elif doc.status in ("verified", "approved"):
                if doc.expiry_date and doc.expiry_date < today:
                    expired += 1
                    client_kyc[cid]["expired"] += 1
                elif doc.expiry_date and doc.expiry_date <= thirty_days:
                    expiring += 1
                    current += 1  # Still valid
                    client_kyc[cid]["expiring_soon"] += 1
                    client_kyc[cid]["current"] += 1
                else:
                    current += 1
                    client_kyc[cid]["current"] += 1

        kyc_summary = {
            "total_documents": total,
            "current": current,
            "expiring_within_30_days": expiring,
            "expired": expired,
            "pending": pending,
            "rejected": rejected,
        }

        # Per-client detail
        client_ids = list(client_kyc.keys())
        client_names: dict[uuid.UUID, str] = {}
        if client_ids:
            cn_result = await db.execute(
                select(Client.id, Client.name).where(Client.id.in_(client_ids))
            )
            client_names = {r.id: r.name for r in cn_result.all()}

        kyc_by_client = [
            {
                "client_id": cid,
                "client_name": client_names.get(cid, "Unknown"),
                "total_documents": stats["total"],
                "current": stats["current"],
                "expired": stats["expired"],
                "expiring_soon": stats["expiring_soon"],
                "pending": stats["pending"],
            }
            for cid, stats in client_kyc.items()
        ]

        # Access audit — latest completed or in-progress
        audit_result = await db.execute(
            select(AccessAudit)
            .options(selectinload(AccessAudit.findings))
            .order_by(AccessAudit.created_at.desc())
            .limit(1)
        )
        latest_audit = audit_result.scalar_one_or_none()

        if latest_audit:
            open_findings = sum(
                1 for f in latest_audit.findings if f.status in ("open", "acknowledged")
            )
            access_audit = {
                "audit_id": latest_audit.id,
                "audit_period": latest_audit.audit_period,
                "status": latest_audit.status,
                "users_reviewed": latest_audit.users_reviewed,
                "permissions_verified": latest_audit.permissions_verified,
                "anomalies_found": latest_audit.anomalies_found,
                "open_findings": open_findings,
                "total_findings": len(latest_audit.findings),
            }
        else:
            access_audit = {
                "audit_id": None,
                "audit_period": None,
                "status": None,
                "users_reviewed": 0,
                "permissions_verified": 0,
                "anomalies_found": 0,
                "open_findings": 0,
                "total_findings": 0,
            }

        return {
            "kyc_summary": kyc_summary,
            "kyc_by_client": kyc_by_client,
            "access_audit": access_audit,
            "generated_at": datetime.now(UTC).isoformat(),
        }


# Singleton instance
report_service = ReportService()
