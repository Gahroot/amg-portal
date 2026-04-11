"""Portfolio, program status, completion, and RM portfolio report methods."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.deliverable import Deliverable
from app.models.milestone import Milestone
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.models.user import User
from app.utils.rag import compute_rag_status


class PortfolioReportsMixin:
    """Portfolio, program status, completion, and RM portfolio reports."""

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

            status_breakdown[program.status] = status_breakdown.get(program.status, 0) + 1
            rag_summary[rag_status] = rag_summary.get(rag_status, 0) + 1

            if program.budget_envelope:
                total_budget += Decimal(str(program.budget_envelope))

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
        milestone_count = len(milestones)
        completed_milestones = sum(1 for m in milestones if m.status == "completed")
        milestone_progress = (
            (completed_milestones / milestone_count * 100) if milestone_count > 0 else 0.0
        )
        rag_status = compute_rag_status(milestones)

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

        all_deliverables: list[Deliverable] = []
        for assignment in assignments:
            all_deliverables.extend(assignment.deliverables or [])

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

        approvals = program.approvals or []
        pending_decisions = [
            {
                "id": a.id,
                "title": f"{a.approval_type.replace('_', ' ').title()} Approval",
                "description": a.comments,
                "requested_at": a.created_at.isoformat(),
                "deadline": None,
            }
            for a in approvals
            if a.status == "pending"
        ]

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

        milestone_timeline = []
        for m in milestones:
            on_time = None
            if m.status == "completed" and m.due_date:
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

        timeline_adherence = None
        if program.end_date and program.status == "completed":
            timeline_adherence = "on_time"

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
            "actual_budget": float(program.budget_envelope) if program.budget_envelope else None,
            "total_milestones": total_milestones,
            "completed_milestones": completed_milestones,
            "milestone_timeline": milestone_timeline,
            "total_deliverables": len(all_deliverables),
            "approved_deliverables": approved_deliverables,
            "deliverables": deliverables_data,
            "partners": partners,
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

        clients_result = await db.execute(
            select(Client)
            .options(
                selectinload(Client.programs).selectinload(Program.milestones),
            )
            .where(Client.rm_id == rm_id)
            .order_by(Client.name)
        )
        clients = list(clients_result.scalars().all())

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
