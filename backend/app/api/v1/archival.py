"""Program archival endpoints.

POST /api/v1/programs/{id}/archive   — manually archive a closed program (MD only)
GET  /api/v1/programs/archival-candidates — list programs eligible for archival
"""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, RLSContext, require_admin, require_compliance
from app.models.milestone import Milestone
from app.models.program import Program
from app.schemas.program import ArchivalCandidateList, ProgramResponse
from app.services.archival_service import archive_program, get_archival_candidates

router = APIRouter()


@router.get(
    "/archival-candidates",
    response_model=ArchivalCandidateList,
    dependencies=[Depends(require_compliance)],
    summary="List programs eligible for archival",
    description=(
        "Returns closed programs whose retention period has elapsed "
        "(closed_at + DATA_RETENTION_DAYS ≤ today). "
        "Accessible by compliance team and managing directors."
    ),
)
async def list_archival_candidates(
    db: DB,
    _rls: RLSContext,
) -> ArchivalCandidateList:
    return await get_archival_candidates(db)


@router.post(
    "/{program_id}/archive",
    response_model=ProgramResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],
    summary="Archive a closed program",
    description=(
        "Manually archives a closed program. "
        "Cancels non-terminal tasks, archives communications, "
        "and resolves open SLA trackers. "
        "The program record, milestones, deliverables, and partner ratings are retained. "
        "Requires managing director role."
    ),
)
async def archive_program_endpoint(
    program_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ProgramResponse:
    from app.api.v1.programs import build_program_response

    await archive_program(db, program_id)

    # Reload with relationships for the response builder
    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones).selectinload(Milestone.tasks),
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one()

    return build_program_response(program)
