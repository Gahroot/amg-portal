"""Escalation template management endpoints — CRUD for pre-defined escalation templates."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from app.api.deps import DB, require_admin, require_internal
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.escalation_template import EscalationTemplate
from app.schemas.escalation_template import (
    EscalationTemplateCreate,
    EscalationTemplateListResponse,
    EscalationTemplateResponse,
    EscalationTemplateUpdate,
)
from app.services.crud_base import paginate

router = APIRouter()

VALID_CATEGORIES = {
    "partner_sla_breach",
    "client_dissatisfaction",
    "resource_unavailable",
    "budget_overrun",
    "timeline_delay",
    "quality_issue",
}

VALID_SEVERITIES = {"task", "milestone", "program", "client_impact"}


@router.get(
    "/",
    response_model=EscalationTemplateListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_escalation_templates(
    db: DB,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    category: str | None = None,
    severity: str | None = None,
    is_active: bool | None = None,
    is_system: bool | None = None,
) -> EscalationTemplateListResponse:
    """List escalation templates with optional filters."""
    q = select(EscalationTemplate)
    if category:
        q = q.where(EscalationTemplate.category == category)
    if severity:
        q = q.where(EscalationTemplate.severity == severity)
    if is_active is not None:
        q = q.where(EscalationTemplate.is_active == is_active)
    if is_system is not None:
        q = q.where(EscalationTemplate.is_system == is_system)

    q = q.order_by(EscalationTemplate.is_system.desc(), EscalationTemplate.name)
    templates, total = await paginate(db, q, skip=skip, limit=limit)

    return EscalationTemplateListResponse(
        templates=[EscalationTemplateResponse.model_validate(t) for t in templates],
        total=total,
    )


@router.get(
    "/{template_id}",
    response_model=EscalationTemplateResponse,
    dependencies=[Depends(require_internal)],
)
async def get_escalation_template(
    template_id: UUID,
    db: DB,
) -> EscalationTemplateResponse:
    """Get a single escalation template by ID."""
    result = await db.execute(
        select(EscalationTemplate).where(EscalationTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Escalation template not found")
    return EscalationTemplateResponse.model_validate(template)


@router.post(
    "/",
    response_model=EscalationTemplateResponse,
    dependencies=[Depends(require_admin)],
    status_code=status.HTTP_201_CREATED,
)
async def create_escalation_template(
    data: EscalationTemplateCreate,
    db: DB,
) -> EscalationTemplateResponse:
    """Create a custom escalation template (MD only)."""
    if data.category not in VALID_CATEGORIES:
        raise BadRequestException(
            f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}"
        )
    if data.severity not in VALID_SEVERITIES:
        raise BadRequestException(
            f"Invalid severity. Must be one of: {', '.join(sorted(VALID_SEVERITIES))}"
        )

    template = EscalationTemplate(
        name=data.name,
        category=data.category,
        severity=data.severity,
        description_template=data.description_template,
        suggested_actions=data.suggested_actions,
        notification_template=data.notification_template,
        is_system=False,
        is_active=data.is_active,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return EscalationTemplateResponse.model_validate(template)


@router.put(
    "/{template_id}",
    response_model=EscalationTemplateResponse,
    dependencies=[Depends(require_admin)],
)
async def update_escalation_template(
    template_id: UUID,
    data: EscalationTemplateUpdate,
    db: DB,
) -> EscalationTemplateResponse:
    """Update an escalation template (MD only). System templates can only have is_active toggled."""
    result = await db.execute(
        select(EscalationTemplate).where(EscalationTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Escalation template not found")

    update_data = data.model_dump(exclude_unset=True)

    # System templates: only allow toggling is_active
    if template.is_system:
        allowed = {"is_active"}
        restricted = set(update_data.keys()) - allowed
        if restricted:
            raise BadRequestException(
                "System templates can only have 'is_active' updated."
            )

    if "category" in update_data and update_data["category"] not in VALID_CATEGORIES:
        raise BadRequestException(
            f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}"
        )
    if "severity" in update_data and update_data["severity"] not in VALID_SEVERITIES:
        raise BadRequestException(
            f"Invalid severity. Must be one of: {', '.join(sorted(VALID_SEVERITIES))}"
        )

    for field, value in update_data.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)
    return EscalationTemplateResponse.model_validate(template)


@router.delete(
    "/{template_id}",
    dependencies=[Depends(require_admin)],
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_escalation_template(
    template_id: UUID,
    db: DB,
) -> None:
    """Delete a custom escalation template (MD only). System templates cannot be deleted."""
    result = await db.execute(
        select(EscalationTemplate).where(EscalationTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Escalation template not found")
    if template.is_system:
        raise BadRequestException("System templates cannot be deleted.")
    await db.delete(template)
    await db.commit()
