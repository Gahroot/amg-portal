"""Program template management endpoints."""

import uuid

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from app.api.deps import (
    DB,
    CurrentUser,
    RLSContext,
    require_rm_or_above,
)
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.program_template import ProgramTemplate
from app.schemas.program_template import (
    ProgramTemplateCreate,
    ProgramTemplateListResponse,
    ProgramTemplateResponse,
    ProgramTemplateUpdate,
)
from app.services.crud_base import paginate

router = APIRouter()


@router.get("/", response_model=ProgramTemplateListResponse)
async def list_program_templates(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    category: str | None = Query(None),
    is_system: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> ProgramTemplateListResponse:
    """List program templates, optionally filtered by category or system flag."""
    query = select(ProgramTemplate).where(ProgramTemplate.is_active.is_(True))

    if category is not None:
        query = query.where(ProgramTemplate.category == category)
    if is_system is not None:
        query = query.where(ProgramTemplate.is_system_template.is_(is_system))

    query = query.order_by(ProgramTemplate.created_at)
    templates, total = await paginate(db, query, skip=skip, limit=limit)

    return ProgramTemplateListResponse(
        templates=[ProgramTemplateResponse.model_validate(t) for t in templates],
        total=total,
    )


@router.get("/{template_id}", response_model=ProgramTemplateResponse)
async def get_program_template(
    template_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ProgramTemplateResponse:
    """Get a single program template by ID."""
    result = await db.execute(
        select(ProgramTemplate).where(ProgramTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Program template not found")
    return ProgramTemplateResponse.model_validate(template)


@router.post("/", response_model=ProgramTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_program_template(
    data: ProgramTemplateCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = require_rm_or_above,
) -> ProgramTemplateResponse:
    """Create a custom program template. Requires RM or above."""
    template = ProgramTemplate(
        name=data.name,
        description=data.description,
        category=data.category,
        milestones_template=[m.model_dump() for m in data.milestones_template],
        estimated_duration_days=data.estimated_duration_days,
        is_system_template=False,
        created_by=current_user.id,
        is_active=True,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return ProgramTemplateResponse.model_validate(template)


@router.patch("/{template_id}", response_model=ProgramTemplateResponse)
async def update_program_template(
    template_id: uuid.UUID,
    data: ProgramTemplateUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ProgramTemplateResponse:
    """Update a program template. Admins can update any; others can only update their own."""
    from app.models.enums import UserRole

    result = await db.execute(
        select(ProgramTemplate).where(ProgramTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Program template not found")

    is_admin = current_user.role == UserRole.managing_director
    is_owner = template.created_by == current_user.id
    if not is_admin and not is_owner:
        raise ForbiddenException("You do not have permission to update this template")

    if data.name is not None:
        template.name = data.name
    if data.description is not None:
        template.description = data.description
    if data.category is not None:
        template.category = data.category
    if data.milestones_template is not None:
        template.milestones_template = [m.model_dump() for m in data.milestones_template]
    if data.estimated_duration_days is not None:
        template.estimated_duration_days = data.estimated_duration_days
    if data.is_active is not None:
        template.is_active = data.is_active

    await db.commit()
    await db.refresh(template)
    return ProgramTemplateResponse.model_validate(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program_template(
    template_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> None:
    """Delete a custom program template. System templates cannot be deleted."""
    result = await db.execute(
        select(ProgramTemplate).where(ProgramTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Program template not found")

    if template.is_system_template:
        raise ForbiddenException("System templates cannot be deleted")

    if template.created_by != current_user.id:
        raise ForbiddenException("You can only delete your own templates")

    await db.delete(template)
    await db.commit()
