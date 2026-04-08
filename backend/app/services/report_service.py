"""Report service — aggregates data for client-facing and internal reports."""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.deliverable import Deliverable
from app.models.milestone import Milestone
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.models.user import User
from app.utils.rag import compute_rag_status

__all__ = ["compute_rag_status", "ReportService", "report_service"]


class ReportService:
    """Service for generating client-facing reports."""

    async def get_portfolio_overview(
        self, db: AsyncSession, client_id: uuid.UUID
    ) -> dict[str, Any] | None:
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
                if assignment.partner is None:
                    continue
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
                if assignment.partner is None:
                    continue
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

    async def get_annual_review(  # noqa: PLR0912
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
            if assignment.partner is None:
                continue
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


    async def get_rm_portfolio_report(
        self, db: AsyncSession, rm_id: uuid.UUID
    ) -> dict[str, Any] | None:
        """
        Generate RM portfolio report for MD review.

        Returns:
        - RM identity and overall metrics
        - Per-client: program counts, statuses, RAG summary, milestone rates, revenue pipeline
        - RM-level NPS satisfaction signal (avg from linked client profiles)
        """
        rm_result = await db.execute(select(User).where(User.id == rm_id))
        rm = rm_result.scalar_one_or_none()
        if not rm:
            return None

        # Get all clients assigned to this RM with their programs and milestones
        clients_result = await db.execute(
            select(Client)
            .options(
                selectinload(Client.programs).selectinload(Program.milestones),
            )
            .where(Client.rm_id == rm_id)
            .order_by(Client.name)
        )
        clients = list(clients_result.scalars().all())

        # Get RM-level NPS average from client profiles assigned to this RM
        from app.models.client_profile import ClientProfile
        from app.models.nps_survey import NPSResponse

        cp_ids_result = await db.execute(
            select(ClientProfile.id).where(ClientProfile.assigned_rm_id == rm_id)
        )
        cp_ids = list(cp_ids_result.scalars().all())

        rm_avg_nps: float | None = None
        if cp_ids:
            nps_avg_result = await db.execute(
                select(func.avg(NPSResponse.score)).where(
                    NPSResponse.client_profile_id.in_(cp_ids)
                )
            )
            avg_raw = nps_avg_result.scalar_one_or_none()
            if avg_raw is not None:
                rm_avg_nps = round(float(avg_raw), 1)

        # Build per-client summaries
        client_summaries: list[dict[str, Any]] = []
        total_active_programs = 0
        total_revenue_pipeline = 0.0

        for client in clients:
            programs = client.programs or []
            active_programs = [
                p for p in programs if p.status in ("active", "design", "intake", "on_hold")
            ]
            completed_programs = [p for p in programs if p.status == "completed"]

            status_breakdown: dict[str, int] = {}
            rag_summary: dict[str, int] = {"red": 0, "amber": 0, "green": 0}
            total_ms = 0
            total_ms_done = 0

            program_summaries: list[dict[str, Any]] = []
            for p in programs:
                milestones = p.milestones or []
                m_count = len(milestones)
                m_done = sum(1 for m in milestones if m.status == "completed")
                progress = round((m_done / m_count * 100), 1) if m_count > 0 else 0.0
                rag = compute_rag_status(milestones)

                status_breakdown[p.status] = status_breakdown.get(p.status, 0) + 1
                rag_summary[rag] = rag_summary.get(rag, 0) + 1
                total_ms += m_count
                total_ms_done += m_done

                program_summaries.append(
                    {
                        "id": p.id,
                        "title": p.title,
                        "status": p.status,
                        "rag_status": rag,
                        "start_date": p.start_date,
                        "end_date": p.end_date,
                        "budget_envelope": float(p.budget_envelope)
                        if p.budget_envelope
                        else None,
                        "milestone_count": m_count,
                        "completed_milestone_count": m_done,
                        "milestone_progress": progress,
                    }
                )

            milestone_completion_rate = (
                round((total_ms_done / total_ms) * 100, 1) if total_ms > 0 else None
            )

            revenue_pipeline = sum(
                float(p.budget_envelope) for p in active_programs if p.budget_envelope
            )
            total_active_programs += len(active_programs)
            total_revenue_pipeline += revenue_pipeline

            client_summaries.append(
                {
                    "client_id": client.id,
                    "client_name": client.name,
                    "client_type": client.client_type,
                    "client_status": client.status,
                    "total_programs": len(programs),
                    "active_programs": len(active_programs),
                    "completed_programs": len(completed_programs),
                    "status_breakdown": status_breakdown,
                    "rag_summary": rag_summary,
                    "milestone_completion_rate": milestone_completion_rate,
                    "revenue_pipeline": revenue_pipeline if revenue_pipeline > 0 else None,
                    "programs": program_summaries,
                }
            )

        return {
            "rm_id": rm.id,
            "rm_name": rm.full_name,
            "rm_email": rm.email,
            "total_clients": len(clients),
            "total_active_programs": total_active_programs,
            "total_revenue_pipeline": total_revenue_pipeline
            if total_revenue_pipeline > 0
            else None,
            "avg_nps_score": rm_avg_nps,
            "clients": client_summaries,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def get_escalation_log_report(
        self,
        db: AsyncSession,
        program_id: uuid.UUID | None = None,
        client_id: uuid.UUID | None = None,
        level: str | None = None,
        status_filter: str | None = None,
    ) -> dict[str, Any]:
        """
        Generate escalation log report for internal review.

        Includes:
        - All escalations (filterable by program, client, level, status)
        - Owner details, age, resolution status
        - Average resolution time metrics
        """
        from app.models.escalation import Escalation

        # Build query joining owner User for name/email
        owner_alias = User
        query = (
            select(
                Escalation,
                owner_alias.full_name.label("owner_name"),
                owner_alias.email.label("owner_email"),
            )
            .join(owner_alias, owner_alias.id == Escalation.owner_id, isouter=True)
            .order_by(Escalation.triggered_at.desc())
        )

        if program_id is not None:
            query = query.where(Escalation.program_id == program_id)
        if client_id is not None:
            query = query.where(Escalation.client_id == client_id)
        if level is not None:
            query = query.where(Escalation.level == level)
        if status_filter is not None:
            query = query.where(Escalation.status == status_filter)

        result = await db.execute(query)
        rows = result.all()

        now = datetime.now(UTC)
        escalation_items: list[dict[str, Any]] = []
        open_count = 0
        resolution_times: list[float] = []

        for row in rows:
            esc = row[0]
            owner_name: str | None = row[1]
            owner_email: str | None = row[2]

            # Normalise timezone
            triggered_at = esc.triggered_at
            if triggered_at.tzinfo is None:
                triggered_at = triggered_at.replace(tzinfo=UTC)
            age_days = (now - triggered_at).days

            resolution_time_days: float | None = None
            if esc.resolved_at:
                resolved_at = esc.resolved_at
                if resolved_at.tzinfo is None:
                    resolved_at = resolved_at.replace(tzinfo=UTC)
                resolution_time_days = round(
                    (resolved_at - triggered_at).total_seconds() / 86400, 1
                )
                resolution_times.append(resolution_time_days)

            if esc.status in ("open", "acknowledged"):
                open_count += 1

            escalation_items.append(
                {
                    "id": esc.id,
                    "title": esc.title,
                    "description": esc.description,
                    "level": esc.level,
                    "status": esc.status,
                    "entity_type": esc.entity_type,
                    "entity_id": esc.entity_id,
                    "program_id": esc.program_id,
                    "client_id": esc.client_id,
                    "owner_id": esc.owner_id,
                    "owner_name": owner_name,
                    "owner_email": owner_email,
                    "triggered_at": triggered_at.isoformat(),
                    "acknowledged_at": esc.acknowledged_at.isoformat()
                    if esc.acknowledged_at
                    else None,
                    "resolved_at": esc.resolved_at.isoformat() if esc.resolved_at else None,
                    "age_days": age_days,
                    "resolution_time_days": resolution_time_days,
                    "resolution_notes": esc.resolution_notes,
                }
            )

        avg_resolution_time = (
            round(sum(resolution_times) / len(resolution_times), 1)
            if resolution_times
            else None
        )

        return {
            "total_escalations": len(escalation_items),
            "open_escalations": open_count,
            "avg_resolution_time_days": avg_resolution_time,
            "escalations": escalation_items,
            "generated_at": now.isoformat(),
        }

    async def get_compliance_audit_report(  # noqa: PLR0912, PLR0915
        self,
        db: AsyncSession,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        """
        Generate compliance audit report for finance/compliance and MD review.

        Covers:
        - KYC status per client: current, expiring ≤30 days, expired
        - Document completeness percentage per client
        - Open access anomalies from the latest access audit
        - User account status summary

        When ``start_date`` / ``end_date`` are supplied, all record fetches are
        filtered to rows whose ``created_at`` falls within that range, avoiding
        unbounded full-table scans.
        """
        from app.models.access_audit import AccessAudit
        from app.models.kyc_document import KYCDocument

        today = datetime.now(UTC).date()
        expiry_threshold = today + timedelta(days=30)

        # Build reusable timestamp bounds for WHERE filters.
        # We convert date → timezone-aware datetime at the boundaries so that
        # comparisons against TIMESTAMPTZ columns work correctly.
        ts_start = (
            datetime(start_date.year, start_date.month, start_date.day, tzinfo=UTC)
            if start_date
            else None
        )
        ts_end = (
            datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999, tzinfo=UTC)
            if end_date
            else None
        )

        # ------------------------------------------------------------------
        # 1. Clients filtered by creation date range
        # ------------------------------------------------------------------
        client_query = select(Client).order_by(Client.name)
        if ts_start is not None:
            client_query = client_query.where(Client.created_at >= ts_start)
        if ts_end is not None:
            client_query = client_query.where(Client.created_at <= ts_end)
        clients_result = await db.execute(client_query)
        clients = list(clients_result.scalars().all())

        # ------------------------------------------------------------------
        # 1b. KYC document counts aggregated in SQL — one row per client.
        #
        # Each bucket is computed with a conditional COUNT so we never pull
        # raw document rows into Python.
        # ------------------------------------------------------------------
        kyc_agg_query = (
            select(
                KYCDocument.client_id,
                func.count().label("total"),
                # verified + no expiry OR expiry > threshold  →  "current"
                func.count(
                    case(
                        (
                            and_(
                                KYCDocument.status == "verified",
                                (KYCDocument.expiry_date.is_(None))
                                | (KYCDocument.expiry_date > expiry_threshold),
                            ),
                            KYCDocument.id,
                        )
                    )
                ).label("current"),
                # verified + expiry in (today, threshold]  →  "expiring_30d"
                func.count(
                    case(
                        (
                            and_(
                                KYCDocument.status == "verified",
                                KYCDocument.expiry_date.isnot(None),
                                KYCDocument.expiry_date > today,
                                KYCDocument.expiry_date <= expiry_threshold,
                            ),
                            KYCDocument.id,
                        )
                    )
                ).label("expiring_30d"),
                # verified + expiry < today  OR  status == "expired"  →  "expired"
                func.count(
                    case(
                        (
                            (KYCDocument.status == "expired")
                            | and_(
                                KYCDocument.status == "verified",
                                KYCDocument.expiry_date.isnot(None),
                                KYCDocument.expiry_date < today,
                            ),
                            KYCDocument.id,
                        )
                    )
                ).label("expired"),
                # pending / uploaded  →  "pending"
                func.count(
                    case(
                        (
                            KYCDocument.status.in_(["pending", "uploaded"]),
                            KYCDocument.id,
                        )
                    )
                ).label("pending"),
            )
            .group_by(KYCDocument.client_id)
        )
        if ts_start is not None:
            kyc_agg_query = kyc_agg_query.where(KYCDocument.created_at >= ts_start)
        if ts_end is not None:
            kyc_agg_query = kyc_agg_query.where(KYCDocument.created_at <= ts_end)

        kyc_agg_result = await db.execute(kyc_agg_query)
        # Keyed by client_id UUID → named-tuple row
        kyc_by_client: dict[Any, Any] = {row.client_id: row for row in kyc_agg_result}

        client_kyc_statuses: list[dict[str, Any]] = []
        total_kyc_current = 0
        total_kyc_expiring = 0
        total_kyc_expired = 0

        for client in clients:
            agg = kyc_by_client.get(client.id)
            total: int = agg.total if agg else 0
            current: int = agg.current if agg else 0
            expiring_30d: int = agg.expiring_30d if agg else 0
            expired: int = agg.expired if agg else 0
            pending: int = agg.pending if agg else 0

            completeness_pct = (
                round((current + expiring_30d) / total * 100, 1) if total > 0 else 0.0
            )

            total_kyc_current += current
            total_kyc_expiring += expiring_30d
            total_kyc_expired += expired

            if expired > 0:
                kyc_status = "expired"
            elif expiring_30d > 0:
                kyc_status = "expiring"
            elif pending > 0:
                kyc_status = "pending"
            elif current > 0:
                kyc_status = "current"
            else:
                kyc_status = "incomplete"

            client_kyc_statuses.append(
                {
                    "client_id": client.id,
                    "client_name": client.name,
                    "client_type": client.client_type,
                    "total_documents": total,
                    "current": current,
                    "expiring_30d": expiring_30d,
                    "expired": expired,
                    "pending": pending,
                    "document_completeness_pct": completeness_pct,
                    "kyc_status": kyc_status,
                }
            )

        # ------------------------------------------------------------------
        # 2. Latest access audit open findings
        # ------------------------------------------------------------------
        latest_audit_result = await db.execute(
            select(AccessAudit)
            .options(selectinload(AccessAudit.findings))
            .order_by(AccessAudit.created_at.desc())
            .limit(1)
        )
        latest_audit = latest_audit_result.scalar_one_or_none()

        access_anomalies: list[dict[str, Any]] = []
        latest_audit_period: str | None = None
        if latest_audit:
            latest_audit_period = latest_audit.audit_period
            for finding in latest_audit.findings or []:
                if finding.status not in ("remediated", "closed", "waived"):
                    access_anomalies.append(
                        {
                            "id": finding.id,
                            "audit_period": latest_audit.audit_period,
                            "finding_type": finding.finding_type,
                            "severity": finding.severity,
                            "description": finding.description,
                            "status": finding.status,
                            "user_id": finding.user_id,
                        }
                    )

        # ------------------------------------------------------------------
        # 3. User account statuses
        #
        # Summary counts: aggregate in SQL with GROUP BY status — no full scan.
        # Per-user detail list: filtered select of only the columns we need.
        # ------------------------------------------------------------------

        # 3a. Summary counts via GROUP BY — avoids loading every User row.
        user_counts_query = (
            select(User.status, func.count(User.id).label("cnt"))
            .group_by(User.status)
        )
        if ts_start is not None:
            user_counts_query = user_counts_query.where(User.created_at >= ts_start)
        if ts_end is not None:
            user_counts_query = user_counts_query.where(User.created_at <= ts_end)
        user_counts_result = await db.execute(user_counts_query)

        active_users = 0
        inactive_users = 0
        deactivated_users = 0
        for status_row in user_counts_result:
            if status_row.status == "active":
                active_users = status_row.cnt
            elif status_row.status == "deactivated":
                deactivated_users = status_row.cnt
            else:
                inactive_users += status_row.cnt

        # 3b. Per-row detail list — filtered and restricted to needed columns.
        user_detail_query = (
            select(
                User.id,
                User.full_name,
                User.email,
                User.role,
                User.status,
                User.created_at,
            )
            .order_by(User.full_name)
        )
        if ts_start is not None:
            user_detail_query = user_detail_query.where(User.created_at >= ts_start)
        if ts_end is not None:
            user_detail_query = user_detail_query.where(User.created_at <= ts_end)
        users_result = await db.execute(user_detail_query)

        user_account_statuses: list[dict[str, Any]] = []
        total_users = 0
        for u in users_result:
            total_users += 1
            user_account_statuses.append(
                {
                    "user_id": u.id,
                    "full_name": u.full_name,
                    "email": u.email,
                    "role": u.role,
                    "status": u.status,
                    "created_at": u.created_at.isoformat(),
                }
            )

        return {
            "total_clients": len(clients),
            "kyc_current": total_kyc_current,
            "kyc_expiring_30d": total_kyc_expiring,
            "kyc_expired": total_kyc_expired,
            "client_kyc_statuses": client_kyc_statuses,
            "access_anomalies": access_anomalies,
            "latest_audit_period": latest_audit_period,
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": inactive_users,
            "deactivated_users": deactivated_users,
            "user_account_statuses": user_account_statuses,
            "generated_at": datetime.now(UTC).isoformat(),
        }


# Singleton instance
report_service = ReportService()


class PartnerReportService:
    """Service for generating partner-facing (Class C) reports.

    All methods are scoped to the requesting partner's own data.
    No client metadata or budget information is exposed.
    """

    async def get_brief_summary(
        self, db: AsyncSession, partner_id: uuid.UUID
    ) -> dict[str, Any] | None:
        """Active brief summary — active assignments with tasks, deadlines, coordinator contact."""
        from app.models.partner import PartnerProfile

        partner_result = await db.execute(
            select(PartnerProfile).where(PartnerProfile.id == partner_id)
        )
        partner = partner_result.scalar_one_or_none()
        if not partner:
            return None

        # Active statuses: dispatched (awaiting response), accepted, in_progress
        result = await db.execute(
            select(PartnerAssignment)
            .options(
                selectinload(PartnerAssignment.program),
                selectinload(PartnerAssignment.assigner),
            )
            .where(
                PartnerAssignment.partner_id == partner_id,
                PartnerAssignment.status.in_(["dispatched", "accepted", "in_progress"]),
            )
            .order_by(PartnerAssignment.due_date.asc().nulls_last())
        )
        assignments = list(result.scalars().all())

        items = []
        for a in assignments:
            items.append(
                {
                    "assignment_id": a.id,
                    "assignment_title": a.title,
                    "status": a.status,
                    "brief": a.brief,
                    "sla_terms": a.sla_terms,
                    "due_date": a.due_date,
                    "accepted_at": a.accepted_at,
                    "program_title": a.program.title if a.program else None,
                    "coordinator_name": a.assigner.full_name if a.assigner else None,
                    "coordinator_email": a.assigner.email if a.assigner else None,
                }
            )

        return {
            "partner_id": partner.id,
            "firm_name": partner.firm_name,
            "total_active": len(items),
            "assignments": items,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def get_deliverable_feedback(
        self,
        db: AsyncSession,
        partner_id: uuid.UUID,
        assignment_id: uuid.UUID | None = None,
    ) -> dict[str, Any] | None:
        """History of all deliverable submissions with review status and comments."""
        from app.models.partner import PartnerProfile

        partner_result = await db.execute(
            select(PartnerProfile).where(PartnerProfile.id == partner_id)
        )
        partner = partner_result.scalar_one_or_none()
        if not partner:
            return None

        # Fetch assignments for this partner (optionally filtered)
        assignment_query = select(PartnerAssignment.id, PartnerAssignment.title).where(
            PartnerAssignment.partner_id == partner_id
        )
        if assignment_id:
            assignment_query = assignment_query.where(PartnerAssignment.id == assignment_id)

        assignment_result = await db.execute(assignment_query)
        assignment_map: dict[Any, str] = {
            row[0]: row[1] for row in assignment_result.all()
        }

        if not assignment_map:
            return {
                "partner_id": partner.id,
                "firm_name": partner.firm_name,
                "total_deliverables": 0,
                "deliverables": [],
                "generated_at": datetime.now(UTC).isoformat(),
            }

        deliverable_result = await db.execute(
            select(Deliverable)
            .where(Deliverable.assignment_id.in_(list(assignment_map.keys())))
            .order_by(Deliverable.submitted_at.desc().nulls_last())
        )
        deliverables = list(deliverable_result.scalars().all())

        items = []
        for d in deliverables:
            items.append(
                {
                    "deliverable_id": d.id,
                    "title": d.title,
                    "deliverable_type": d.deliverable_type,
                    "assignment_id": d.assignment_id,
                    "assignment_title": assignment_map.get(d.assignment_id),
                    "status": d.status,
                    "submitted_at": d.submitted_at,
                    "reviewed_at": d.reviewed_at,
                    "review_comments": d.review_comments,
                    "due_date": d.due_date,
                }
            )

        return {
            "partner_id": partner.id,
            "firm_name": partner.firm_name,
            "total_deliverables": len(items),
            "deliverables": items,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def get_engagement_history(
        self,
        db: AsyncSession,
        partner_id: uuid.UUID,
    ) -> dict[str, Any] | None:
        """All past engagements with completion stats and performance score."""
        from app.models.partner import PartnerProfile

        partner_result = await db.execute(
            select(PartnerProfile).where(PartnerProfile.id == partner_id)
        )
        partner = partner_result.scalar_one_or_none()
        if not partner:
            return None

        result = await db.execute(
            select(PartnerAssignment)
            .options(
                selectinload(PartnerAssignment.program),
                selectinload(PartnerAssignment.deliverables),
            )
            .where(PartnerAssignment.partner_id == partner_id)
            .order_by(PartnerAssignment.created_at.desc())
        )
        assignments = list(result.scalars().all())

        completed_count = 0
        items = []
        for a in assignments:
            deliverables = a.deliverables or []
            deliverable_count = len(deliverables)
            approved_count = sum(1 for d in deliverables if d.status == "approved")

            if a.status == "completed":
                completed_count += 1

            items.append(
                {
                    "assignment_id": a.id,
                    "title": a.title,
                    "program_title": a.program.title if a.program else None,
                    "status": a.status,
                    "created_at": a.created_at,
                    "accepted_at": a.accepted_at,
                    "completed_at": a.completed_at,
                    "due_date": a.due_date,
                    "deliverable_count": deliverable_count,
                    "approved_deliverable_count": approved_count,
                }
            )

        return {
            "partner_id": partner.id,
            "firm_name": partner.firm_name,
            "total_engagements": len(items),
            "completed_engagements": completed_count,
            "performance_rating": float(partner.performance_rating)
            if partner.performance_rating
            else None,
            "assignments": items,
            "generated_at": datetime.now(UTC).isoformat(),
        }


# Singleton instance
partner_report_service = PartnerReportService()
