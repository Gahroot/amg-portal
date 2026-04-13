"""Recurring task template CRUD endpoints.

Internal staff can create, read, update, and deactivate recurring task templates.
The daily scheduler job (process_recurring_tasks) reads these templates and generates
Task records when they fall due.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from app.api.deps import (
    DB,
    CurrentUser,
    Pagination,
    RLSContext,
    require_internal,
)
from app.core.exceptions import NotFoundException
from app.models.milestone import Milestone
from app.models.recurring_task import RecurringTaskTemplate
from app.models.user import User
from app.schemas.recurring_task import (
    RecurringTaskTemplateCreate,
    RecurringTaskTemplateListResponse,
    RecurringTaskTemplateResponse,
    RecurringTaskTemplateUpdate,
)
from app.services.crud_base import paginate
from app.services.recurring_task_service import initialize_next_due

logger = logging.getLogger(__name__)

router = APIRouter()


async def _build_response(
    db: DB, template: RecurringTaskTemplate
) -> RecurringTaskTemplateResponse:
    """Enrich a template record with denormalized milestone title and assignee name."""
    milestone_title: str | None = None
    assignee_name: str | None = None

    if template.milestone_id:
        row = (
            await db.execute(
                select(Milestone.title).where(Milestone.id == template.milestone_id)
            )
        ).first()
        if row:
            milestone_title = row.title

    if template.assignee_id:
        row = (
            await db.execute(
                select(User.full_name).where(User.id == template.assignee_id)
            )
        ).first()
        if row:
            assignee_name = row.full_name

    response = RecurringTaskTemplateResponse.model_validate(template)
    response.milestone_title = milestone_title
    response.assignee_name = assignee_name
    return response


@router.get("/", response_model=RecurringTaskTemplateListResponse)
async def list_recurring_task_templates(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    pagination: Pagination,
    _: None = Depends(require_internal),
    is_active: bool | None = Query(None),
    milestone_id: UUID | None = Query(None),
) -> RecurringTaskTemplateListResponse:
    """List recurring task templates. Restricted to internal staff."""
    query = select(RecurringTaskTemplate)

    if is_active is not None:
        query = query.where(RecurringTaskTemplate.is_active.is_(is_active))
    if milestone_id:
        query = query.where(RecurringTaskTemplate.milestone_id == milestone_id)

    query = query.order_by(RecurringTaskTemplate.name)
    templates, total = await paginate(db, query, skip=pagination.skip, limit=pagination.limit)

    return RecurringTaskTemplateListResponse(
        templates=[await _build_response(db, t) for t in templates],
        total=total,
    )


@router.get("/{template_id}", response_model=RecurringTaskTemplateResponse)
async def get_recurring_task_template(
    template_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> RecurringTaskTemplateResponse:
    """Fetch a single recurring task template by ID."""
    result = await db.execute(
        select(RecurringTaskTemplate).where(RecurringTaskTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Recurring task template not found")
    return await _build_response(db, template)


@router.post(
    "/",
    response_model=RecurringTaskTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_recurring_task_template(
    data: RecurringTaskTemplateCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> RecurringTaskTemplateResponse:
    """Create a new recurring task template.

    ``next_due_date`` is computed automatically from the RRULE starting today.
    """
    template = RecurringTaskTemplate(
        name=data.name,
        description=data.description,
        rrule=data.rrule,
        milestone_id=data.milestone_id,
        assignee_id=data.assignee_id,
        priority=data.priority,
        task_title_template=data.task_title_template,
        task_description=data.task_description,
        created_by=current_user.id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    # Compute the first next_due_date from the RRULE
    await initialize_next_due(db, template)
    await db.refresh(template)

    return await _build_response(db, template)


@router.patch("/{template_id}", response_model=RecurringTaskTemplateResponse)
async def update_recurring_task_template(
    template_id: UUID,
    data: RecurringTaskTemplateUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> RecurringTaskTemplateResponse:
    """Update a recurring task template.

    If the RRULE changes, ``next_due_date`` is recomputed from today.
    """
    result = await db.execute(
        select(RecurringTaskTemplate).where(RecurringTaskTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Recurring task template not found")

    rrule_changed = data.rrule is not None and data.rrule != template.rrule

    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)

    if rrule_changed:
        await initialize_next_due(db, template)
        await db.refresh(template)

    return await _build_response(db, template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_recurring_task_template(
    template_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> None:
    """Deactivate a recurring task template (soft-delete)."""
    result = await db.execute(
        select(RecurringTaskTemplate).where(RecurringTaskTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Recurring task template not found")

    template.is_active = False
    await db.commit()
