"""Communication template management endpoints."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import (
    DB,
    CurrentUser,
    RLSContext,
    require_coordinator_or_above,
)
from app.core.exceptions import ForbiddenException, NotFoundException, ValidationException
from app.schemas.communication_template import (
    TemplateCreate,
    TemplateListResponse,
    TemplateRenderRequest,
    TemplateRenderResponse,
    TemplateResponse,
    TemplateStatusAction,
    TemplateUpdate,
)
from app.services.template_service import template_service

router = APIRouter()


@router.get("/", response_model=TemplateListResponse)
async def list_templates(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    template_type: str | None = Query(None),
    include_inactive: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> TemplateListResponse:
    """List communication templates. Coordinators and above may request inactive templates."""
    templates, total = await template_service.get_active_templates(
        db,
        template_type=template_type,
        skip=skip,
        limit=limit,
        include_inactive=include_inactive,
    )
    return TemplateListResponse(
        templates=[TemplateResponse.model_validate(t) for t in templates],
        total=total,
    )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> TemplateResponse:
    """Get a single communication template by ID."""
    template = await template_service.get(db, template_id)
    if not template:
        raise NotFoundException("Template not found")
    return TemplateResponse.model_validate(template)


@router.post(
    "/",
    response_model=TemplateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def create_template(
    data: TemplateCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> TemplateResponse:
    """Create a new communication template (coordinator or above)."""
    template = await template_service.create(db, obj_in=data)
    return TemplateResponse.model_validate(template)


@router.patch(
    "/{template_id}",
    response_model=TemplateResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def update_template(
    template_id: uuid.UUID,
    data: TemplateUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> TemplateResponse:
    """Update an existing communication template."""
    template = await template_service.get(db, template_id)
    if not template:
        raise NotFoundException("Template not found")
    if template.is_system:
        raise ForbiddenException("System templates cannot be modified")
    updated = await template_service.update(db, db_obj=template, obj_in=data)
    return TemplateResponse.model_validate(updated)


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def delete_template(
    template_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> None:
    """Delete a communication template. System templates cannot be deleted."""
    template = await template_service.get(db, template_id)
    if not template:
        raise NotFoundException("Template not found")
    if template.is_system:
        raise ForbiddenException("System templates cannot be deleted")
    await template_service.delete(db, template_id)


@router.post("/render", response_model=TemplateRenderResponse)
async def render_template(
    data: TemplateRenderRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> TemplateRenderResponse:
    """Render a template with the given variables (preview)."""
    try:
        rendered = await template_service.render_template(db, data.template_id, data.variables)
    except ValueError as e:
        raise ValidationException(str(e)) from None

    if rendered is None:
        raise NotFoundException("Template not found")

    body = rendered["body"]
    if body is None:
        raise ValidationException("Template body rendered to empty")
    return TemplateRenderResponse(subject=rendered.get("subject"), body=body)


@router.patch(
    "/{template_id}/status",
    response_model=TemplateResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def update_template_status(
    template_id: uuid.UUID,
    data: TemplateStatusAction,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> TemplateResponse:
    """Update the approval status of a template.

    - submit: Any coordinator+ can submit a draft for approval (→ pending).
    - approve: Only managing directors can approve a pending template.
    - reject: Only managing directors can reject a pending template.
    """
    template = await template_service.get(db, template_id)
    if not template:
        raise NotFoundException("Template not found")
    if template.is_system:
        raise ForbiddenException("System templates cannot go through approval workflow")

    if data.action == "submit":
        if template.status not in ("draft", "rejected"):
            raise ValidationException(f"Cannot submit a template with status '{template.status}'")
        template.status = "pending"
        template.rejection_reason = None
        template.reviewed_by = None
        template.reviewed_at = None
    elif data.action == "approve":
        if current_user.role != "managing_director":
            raise ForbiddenException("Only managing directors can approve templates")
        if template.status != "pending":
            raise ValidationException(f"Cannot approve a template with status '{template.status}'")
        template.status = "approved"
        template.rejection_reason = None
        template.reviewed_by = current_user.id
        template.reviewed_at = datetime.now(UTC)
    elif data.action == "reject":
        if current_user.role != "managing_director":
            raise ForbiddenException("Only managing directors can reject templates")
        if template.status != "pending":
            raise ValidationException(f"Cannot reject a template with status '{template.status}'")
        template.status = "rejected"
        template.rejection_reason = data.reason
        template.reviewed_by = current_user.id
        template.reviewed_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(template)
    return TemplateResponse.model_validate(template)
