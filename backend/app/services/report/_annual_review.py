"""Annual relationship review report."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.utils.rag import compute_rag_status

_MONTH_NAMES = (
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
)


class AnnualReviewMixin:
    """Annual relationship review aggregation."""

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
        client_result = await db.execute(select(Client).where(Client.id == client_id))
        client = client_result.scalar_one_or_none()
        if not client:
            return None

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

        total_engagement_value = Decimal("0")
        status_breakdown: dict[str, int] = {}
        programs_by_month: list[dict[str, Any]] = [
            {
                "month": month,
                "month_name": _MONTH_NAMES[month - 1],
                "new_programs": 0,
                "completed_programs": 0,
            }
            for month in range(1, 13)
        ]
        completed_count = 0

        program_summaries = []

        for program in programs:
            milestones = program.milestones or []
            rag_status = compute_rag_status(milestones)

            status_breakdown[program.status] = status_breakdown.get(program.status, 0) + 1

            if program.created_at:
                month_num = program.created_at.month
                programs_by_month[month_num - 1]["new_programs"] += 1

            if program.status == "completed":
                completed_count += 1
                if program.updated_at:
                    month_num = program.updated_at.month
                    programs_by_month[month_num - 1]["completed_programs"] += 1

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

        assignment_result = await db.execute(
            select(PartnerAssignment)
            .options(selectinload(PartnerAssignment.partner))
            .where(
                PartnerAssignment.program_id.in_([p.id for p in programs]),
                extract("year", PartnerAssignment.created_at) == year,
            )
        )
        assignments = list(assignment_result.scalars().all())

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
            "new_programs": len(programs),
            "completed_programs": completed_count,
            "active_programs": sum(
                1 for p in programs if p.status in ("active", "design", "on_hold")
            ),
            "total_engagement_value": float(total_engagement_value)
            if total_engagement_value > 0
            else None,
            "total_budget_consumed": None,
            "programs_by_status": status_breakdown,
            "programs_by_month": programs_by_month,
            "partner_performance": partner_performance,
            "programs": program_summaries,
            "generated_at": datetime.now(UTC).isoformat(),
        }
