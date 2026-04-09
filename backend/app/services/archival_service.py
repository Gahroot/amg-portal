"""Data retention and program archival service.

Design doc requirement:
  "operational data (tasks, messages) can be archived per program close
   after defined retention period."

Archival moves a closed program's operational data (tasks, communications,
SLA trackers) to a read-only archived state while preserving the permanent
record (program, milestones, deliverables, partner ratings) unchanged.
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.models.communication import Communication
from app.models.enums import MessageStatus, ProgramStatus, TaskStatus
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.program_closure import ProgramClosure
from app.models.sla_tracker import SLATracker
from app.models.task import Task
from app.schemas.program import ArchivalCandidateList, ArchivalCandidateResponse

logger = logging.getLogger(__name__)

# Task statuses that are already terminal — skip them during archival
_TERMINAL_TASK_STATUSES = {TaskStatus.done.value, TaskStatus.cancelled.value}


async def get_archival_candidates(db: AsyncSession) -> ArchivalCandidateList:
    """Return closed programs whose retention period has elapsed.

    A program becomes eligible once:
        closure.completed_at + DATA_RETENTION_DAYS <= now
    """
    cutoff = datetime.now(UTC) - timedelta(days=settings.DATA_RETENTION_DAYS)

    result = await db.execute(
        select(Program, ProgramClosure)
        .join(ProgramClosure, ProgramClosure.program_id == Program.id)
        .options(selectinload(Program.client))
        .where(
            Program.status == "closed",
            ProgramClosure.completed_at.isnot(None),
            ProgramClosure.completed_at <= cutoff,
        )
        .order_by(ProgramClosure.completed_at.asc())
        .limit(settings.ARCHIVE_BATCH_SIZE)
    )
    rows = result.all()

    candidates: list[ArchivalCandidateResponse] = []
    for program, closure in rows:
        closed_at: datetime = closure.completed_at
        eligible_at = closed_at + timedelta(days=settings.DATA_RETENTION_DAYS)
        candidates.append(
            ArchivalCandidateResponse(
                program_id=program.id,
                title=program.title,
                client_id=program.client_id,
                client_name=program.client.name if program.client else "",
                closed_at=closed_at,
                eligible_at=eligible_at,
            )
        )

    return ArchivalCandidateList(candidates=candidates, total=len(candidates))


async def archive_program(db: AsyncSession, program_id: uuid.UUID) -> Program:
    """Archive a single closed program and its operational data.

    Operational data archived:
    - Tasks (non-terminal tasks are cancelled)
    - Communications linked to this program (status → archived)
    - SLA trackers for those communications (open trackers are resolved)

    Permanent record left intact:
    - Program record (status → archived, archived_at set)
    - Milestones
    - Deliverables
    - Partner ratings
    """
    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones).selectinload(Milestone.tasks),
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    if program.status == "archived":
        raise ConflictException("Program is already archived")

    if program.status != "closed":
        raise BadRequestException("Only closed programs can be archived")

    now = datetime.now(UTC)

    # --- 1. Cancel non-terminal tasks ---
    milestone_ids = [m.id for m in (program.milestones or [])]
    if milestone_ids:
        task_result = await db.execute(
            select(Task.id).where(
                Task.milestone_id.in_(milestone_ids),
                Task.status.notin_(list(_TERMINAL_TASK_STATUSES)),
            )
        )
        open_task_ids = task_result.scalars().all()

        if open_task_ids:
            await db.execute(
                update(Task)
                .where(Task.id.in_(open_task_ids))
                .values(status=TaskStatus.cancelled.value, updated_at=now)
            )
            logger.info(
                "Archived program %s: cancelled %d open task(s)",
                program_id,
                len(open_task_ids),
            )

    # --- 2. Archive communications linked to this program ---
    comm_result = await db.execute(
        select(Communication.id).where(
            Communication.program_id == program_id,
            Communication.status != MessageStatus.archived.value,
        )
    )
    open_comm_ids = comm_result.scalars().all()

    if open_comm_ids:
        await db.execute(
            update(Communication)
            .where(Communication.id.in_(open_comm_ids))
            .values(status=MessageStatus.archived.value, updated_at=now)
        )
        logger.info(
            "Archived program %s: archived %d communication(s)",
            program_id,
            len(open_comm_ids),
        )

        # --- 3. Resolve open SLA trackers for those communications ---
        # SLA trackers reference entity_type="communication" / entity_id=str(comm_id)
        comm_id_strs = [str(cid) for cid in open_comm_ids]
        sla_result = await db.execute(
            select(SLATracker.id).where(
                SLATracker.entity_type == "communication",
                SLATracker.entity_id.in_(comm_id_strs),
                SLATracker.responded_at.is_(None),
            )
        )
        open_sla_ids = sla_result.scalars().all()

        if open_sla_ids:
            await db.execute(
                update(SLATracker)
                .where(SLATracker.id.in_(open_sla_ids))
                .values(responded_at=now, updated_at=now)
            )
            logger.info(
                "Archived program %s: resolved %d open SLA tracker(s)",
                program_id,
                len(open_sla_ids),
            )

    # --- 4. Mark program as archived ---
    program.status = ProgramStatus.archived
    program.archived_at = now

    await db.commit()
    await db.refresh(program)

    logger.info("Program %s archived at %s", program_id, now.isoformat())
    return program
