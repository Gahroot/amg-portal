"""Report service — aggregates data for client-facing reports."""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.deliverable import Deliverable
from app.models.milestone import Milestone
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program


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


# Singleton instance
report_service = ReportService()
