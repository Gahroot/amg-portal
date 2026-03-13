"""Automated data-retention archival service.

Archives programs whose closure retention period has elapsed.  Archived
programs remain fully searchable and readable but are treated as read-only
by the API layer.  Nothing is deleted — this satisfies the governance rule
that client profiles are retained indefinitely while operational data is
archived after the configured retention window.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.enums import ProgramStatus
from app.models.program import Program
from app.models.program_closure import ProgramClosure

logger = logging.getLogger(__name__)


async def archive_closed_programs(db: AsyncSession) -> int:
    """Transition closed programs past the retention window to archived.

    For each qualifying program:
    1. Set ``program.status`` to ``archived``.
    2. Create an ``AuditLog`` entry recording the automated archival.

    Returns the number of programs archived.
    """
    retention_days = settings.DATA_RETENTION_DAYS
    cutoff = datetime.now(UTC) - timedelta(days=retention_days)

    # Find closed programs whose closure was completed before the cutoff
    result = await db.execute(
        select(Program)
        .join(ProgramClosure, ProgramClosure.program_id == Program.id)
        .where(
            Program.status == ProgramStatus.closed,
            ProgramClosure.completed_at.isnot(None),
            ProgramClosure.completed_at <= cutoff,
        )
    )
    programs = list(result.scalars().all())

    if not programs:
        return 0

    for program in programs:
        old_status = program.status
        program.status = ProgramStatus.archived

        db.add(
            AuditLog(
                user_id=None,
                user_email=None,
                action="archive",
                entity_type="program",
                entity_id=str(program.id),
                before_state={"status": old_status},
                after_state={
                    "status": ProgramStatus.archived,
                    "retention_days": retention_days,
                    "cutoff": cutoff.isoformat(),
                    "automated": True,
                },
            )
        )

    await db.commit()
    return len(programs)


class RetentionInfoData:
    """Typed container for retention metadata."""

    __slots__ = (
        "is_archived",
        "retention_period_days",
        "days_until_archival",
        "closure_completed_at",
    )

    def __init__(
        self,
        *,
        is_archived: bool,
        retention_period_days: int,
        days_until_archival: int | None,
        closure_completed_at: str | None,
    ) -> None:
        self.is_archived = is_archived
        self.retention_period_days = retention_period_days
        self.days_until_archival = days_until_archival
        self.closure_completed_at = closure_completed_at


def get_retention_info(
    program_status: str,
    closure_completed_at: datetime | None,
) -> RetentionInfoData:
    """Compute retention metadata for a program.

    Returns a ``RetentionInfoData`` with:
    - ``is_archived``: whether the program is archived.
    - ``retention_period_days``: the configured retention window.
    - ``days_until_archival``: days remaining before auto-archival
      (``None`` when not applicable, e.g. the program isn't closed
      or is already archived).
    - ``closure_completed_at``: ISO-formatted timestamp of closure completion.
    """
    retention_days = settings.DATA_RETENTION_DAYS
    is_archived = program_status == ProgramStatus.archived

    days_until_archival: int | None = None
    if (
        program_status == ProgramStatus.closed
        and closure_completed_at is not None
    ):
        archival_date = closure_completed_at + timedelta(days=retention_days)
        remaining = (archival_date - datetime.now(UTC)).days
        days_until_archival = max(remaining, 0)

    return RetentionInfoData(
        is_archived=is_archived,
        retention_period_days=retention_days,
        days_until_archival=days_until_archival,
        closure_completed_at=(
            closure_completed_at.isoformat() if closure_completed_at else None
        ),
    )
