"""Escalation log report."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class EscalationLogMixin:
    """Internal escalation log report."""

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
            round(sum(resolution_times) / len(resolution_times), 1) if resolution_times else None
        )

        return {
            "total_escalations": len(escalation_items),
            "open_escalations": open_count,
            "avg_resolution_time_days": avg_resolution_time,
            "escalations": escalation_items,
            "generated_at": now.isoformat(),
        }
