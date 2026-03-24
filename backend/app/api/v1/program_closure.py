"""Program closure workflow endpoints."""

import uuid

from fastapi import APIRouter, Depends, status

from app.api.deps import (
    DB,
    CurrentUser,
    require_internal,
    require_rm_or_above,
)
from app.models.user import User
from app.schemas.partner_rating import (
    PartnerRatingCreate,
    PartnerRatingResponse,
)
from app.schemas.program_closure import (
    ChecklistUpdate,
    DebriefNotesUpdate,
    ProgramClosureCreate,
    ProgramClosureResponse,
)
from app.services.closure_service import (
    complete_closure,
    get_closure_status,
    get_partner_ratings,
    initiate_closure,
    save_debrief_notes,
    submit_partner_rating,
    update_checklist,
)

router = APIRouter()


@router.post(
    "/{program_id}/closure",
    response_model=ProgramClosureResponse,
    status_code=status.HTTP_201_CREATED,
)
async def initiate_program_closure(
    program_id: uuid.UUID,
    data: ProgramClosureCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
) -> ProgramClosureResponse:
    closure = await initiate_closure(db, program_id, current_user.id, data.notes)
    return ProgramClosureResponse.model_validate(closure)


@router.get(
    "/{program_id}/closure",
    response_model=ProgramClosureResponse,
)
async def get_program_closure(
    program_id: uuid.UUID,
    db: DB,
    _user: User = Depends(require_internal),
) -> ProgramClosureResponse:
    closure = await get_closure_status(db, program_id)
    return ProgramClosureResponse.model_validate(closure)


@router.patch(
    "/{program_id}/closure/checklist",
    response_model=ProgramClosureResponse,
)
async def update_closure_checklist(
    program_id: uuid.UUID,
    data: ChecklistUpdate,
    db: DB,
    _: None = Depends(require_rm_or_above),
) -> ProgramClosureResponse:
    closure = await update_checklist(db, program_id, data.items)
    return ProgramClosureResponse.model_validate(closure)


@router.post(
    "/{program_id}/closure/partner-ratings",
    response_model=PartnerRatingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_program_partner_rating(
    program_id: uuid.UUID,
    data: PartnerRatingCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
) -> PartnerRatingResponse:
    rating = await submit_partner_rating(db, program_id, current_user.id, data)
    return PartnerRatingResponse.model_validate(rating)


@router.get(
    "/{program_id}/closure/partner-ratings",
    response_model=list[PartnerRatingResponse],
)
async def list_partner_ratings(
    program_id: uuid.UUID,
    db: DB,
    _user: User = Depends(require_internal),
) -> list[PartnerRatingResponse]:
    ratings = await get_partner_ratings(db, program_id)
    return [PartnerRatingResponse.model_validate(r) for r in ratings]


@router.patch(
    "/{program_id}/closure/debrief-notes",
    response_model=ProgramClosureResponse,
)
async def save_program_debrief_notes(
    program_id: uuid.UUID,
    data: DebriefNotesUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
) -> ProgramClosureResponse:
    closure = await save_debrief_notes(
        db,
        program_id,
        current_user.id,
        current_user.full_name,
        data.notes,
    )
    return ProgramClosureResponse.model_validate(closure)


@router.post(
    "/{program_id}/closure/complete",
    response_model=ProgramClosureResponse,
)
async def complete_program_closure(
    program_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
) -> ProgramClosureResponse:
    closure = await complete_closure(db, program_id, current_user.id)
    return ProgramClosureResponse.model_validate(closure)
