"""Partner-facing (Class C) report service."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.deliverable import Deliverable
from app.models.partner_assignment import PartnerAssignment


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

        items = [
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
            for a in assignments
        ]

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

        assignment_query = select(PartnerAssignment.id, PartnerAssignment.title).where(
            PartnerAssignment.partner_id == partner_id
        )
        if assignment_id:
            assignment_query = assignment_query.where(PartnerAssignment.id == assignment_id)

        assignment_result = await db.execute(assignment_query)
        assignment_map: dict[Any, str] = {row[0]: row[1] for row in assignment_result.all()}

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

        items = [
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
            for d in deliverables
        ]

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


partner_report_service = PartnerReportService()
