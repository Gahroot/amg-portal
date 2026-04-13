"""Escalation endpoints — CRUD + status workflows for internal staff."""

import csv
import io
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, Pagination, require_admin, require_internal
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.enums import EscalationLevel, EscalationStatus
from app.models.escalation import Escalation
from app.models.user import User
from app.schemas.escalation import (
    EscalationChainResponse,
    EscalationCreate,
    EscalationListResponse,
    EscalationMetricsResponse,
    EscalationProgressRequest,
    EscalationResponse,
    EscalationTriggerRequest,
    EscalationUpdate,
    OverdueEscalationResponse,
    ReassignRequest,
)
from app.schemas.escalation_playbook import (
    ExecutionResponse,
    PlaybookCreate,
    PlaybookListResponse,
    PlaybookResponse,
    PlaybookUpdate,
    PlaybookWithExecutionResponse,
    ProgressSummary,
    StepStateUpdate,
)
from app.schemas.escalation_rule import (
    EscalationRuleCreate,
    EscalationRuleListResponse,
    EscalationRuleResponse,
    EscalationRuleUpdate,
)
from app.services.escalation_metrics_service import get_escalation_metrics
from app.services.escalation_service import (
    check_and_escalate_milestone_risk,
    create_escalation,
    get_escalation_chain,
    get_escalations_with_owner_info,
    get_overdue_escalations,
    get_simple_escalation_metrics,
    progress_escalation_chain,
    reassign_escalation,
    update_escalation_status,
)

router = APIRouter()


@router.get("/metrics", dependencies=[Depends(require_internal)])
async def get_metrics(
    db: DB,
    date_from: datetime | None = Query(None, description="Start of period (ISO 8601)"),
    date_to: datetime | None = Query(None, description="End of period (ISO 8601)"),
    level: str | None = Query(None, description="Filter by escalation level"),
    status: str | None = Query(None, description="Filter by status"),
    owner_id: UUID | None = Query(None, description="Filter by assignee (owner_id)"),
) -> dict[str, Any]:
    """Return aggregated escalation metrics for the dashboard."""
    return await get_escalation_metrics(
        db,
        date_from=date_from,
        date_to=date_to,
        level=level,
        status=status,
        owner_id=owner_id,
    )


@router.get("/", response_model=EscalationListResponse, dependencies=[Depends(require_internal)])
async def list_escalations(
    db: DB,
    pagination: Pagination,
    level: str | None = None,
    status: str | None = None,
    program_id: UUID | None = None,
    client_id: UUID | None = None,
    search: str | None = None,
) -> EscalationListResponse:
    """List escalations with filters."""
    escalations, total = await get_escalations_with_owner_info(
        db,
        skip=pagination.skip,
        limit=pagination.limit,
        level=level,
        status=status,
        program_id=program_id,
        client_id=client_id,
        search=search,
    )
    return EscalationListResponse(escalations=escalations, total=total)  # type: ignore[arg-type]


@router.get("/export", dependencies=[Depends(require_internal)])
async def export_escalations_csv(
    db: DB,
    level: str | None = None,
    status: str | None = None,
    program_id: UUID | None = None,
    client_id: UUID | None = None,
    search: str | None = None,
) -> StreamingResponse:
    """Export escalations to CSV."""
    escalations, _ = await get_escalations_with_owner_info(
        db,
        skip=0,
        limit=10000,
        level=level,
        status=status,
        program_id=program_id,
        client_id=client_id,
        search=search,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "level",
            "status",
            "title",
            "entity_type",
            "entity_id",
            "owner_email",
            "program_id",
            "client_id",
            "triggered_at",
            "acknowledged_at",
            "resolved_at",
            "risk_factors",
        ]
    )
    for esc in escalations:
        writer.writerow(
            [
                str(esc["id"]),
                esc["level"],
                esc["status"],
                esc["title"],
                esc["entity_type"],
                esc["entity_id"],
                esc["owner_email"] or "",
                str(esc["program_id"]) if esc["program_id"] else "",
                str(esc["client_id"]) if esc["client_id"] else "",
                esc["triggered_at"].isoformat() if esc["triggered_at"] else "",  # type: ignore[attr-defined]
                esc["acknowledged_at"].isoformat() if esc["acknowledged_at"] else "",  # type: ignore[attr-defined]
                esc["resolved_at"].isoformat() if esc["resolved_at"] else "",  # type: ignore[attr-defined]
                str(esc["risk_factors"]) if esc["risk_factors"] else "",
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=escalations.csv"},
    )


@router.post("/", response_model=EscalationResponse, dependencies=[Depends(require_internal)])
async def create_manual_escalation(
    data: EscalationCreate,
    db: DB,
    current_user: CurrentUser,
) -> EscalationResponse:
    """Manually create an escalation."""
    escalation = await create_escalation(
        db=db,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        level=EscalationLevel(data.level),
        triggered_by=current_user,
        title=data.title,
        description=data.description,
        program_id=data.program_id,
        client_id=data.client_id,
    )
    # Fetch with owner info
    result = await db.execute(select(User).where(User.id == escalation.owner_id))
    owner = result.scalar_one_or_none()
    result2 = await db.execute(select(User).where(User.id == escalation.triggered_by))
    triggerer = result2.scalar_one_or_none()

    return EscalationResponse(
        id=escalation.id,
        level=escalation.level,
        status=escalation.status,
        title=escalation.title,
        description=escalation.description,
        entity_type=escalation.entity_type,
        entity_id=escalation.entity_id,
        owner_id=escalation.owner_id,
        owner_email=owner.email if owner else None,
        owner_name=owner.full_name if owner else None,
        program_id=escalation.program_id,
        client_id=escalation.client_id,
        triggered_at=escalation.triggered_at,
        acknowledged_at=escalation.acknowledged_at,
        resolved_at=escalation.resolved_at,
        closed_at=escalation.closed_at,
        triggered_by=escalation.triggered_by,
        triggered_by_email=triggerer.email if triggerer else None,
        triggered_by_name=triggerer.full_name if triggerer else None,
        risk_factors=escalation.risk_factors,
        escalation_chain=escalation.escalation_chain,
        resolution_notes=escalation.resolution_notes,
        created_at=escalation.created_at,
        updated_at=escalation.updated_at,
    )


# ── Escalation Rules CRUD ──────────────────────────────────────────────


@router.get(
    "/escalation-rules",
    response_model=EscalationRuleListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_escalation_rules(
    db: DB,
    pagination: Pagination,
    is_active: bool | None = None,
    trigger_type: str | None = None,
) -> EscalationRuleListResponse:
    """List escalation auto-trigger rules."""
    from sqlalchemy import func as sa_func

    from app.models.escalation_rule import EscalationRule

    q = select(EscalationRule)
    if is_active is not None:
        q = q.where(EscalationRule.is_active == is_active)
    if trigger_type:
        q = q.where(EscalationRule.trigger_type == trigger_type)

    count_result = await db.execute(select(sa_func.count()).select_from(q.subquery()))
    total = count_result.scalar_one()

    q = q.order_by(EscalationRule.created_at.desc()).offset(pagination.skip).limit(pagination.limit)
    result = await db.execute(q)
    rules = result.scalars().all()

    return EscalationRuleListResponse(
        rules=[EscalationRuleResponse.model_validate(r) for r in rules],
        total=total,
    )


@router.post(
    "/escalation-rules",
    response_model=EscalationRuleResponse,
    dependencies=[Depends(require_admin)],
    status_code=status.HTTP_201_CREATED,
)
async def create_escalation_rule(
    data: EscalationRuleCreate,
    db: DB,
) -> EscalationRuleResponse:
    """Create a new escalation auto-trigger rule (MD only)."""
    from app.models.escalation_rule import EscalationRule

    rule = EscalationRule(
        name=data.name,
        description=data.description,
        trigger_type=data.trigger_type,
        trigger_conditions=data.trigger_conditions,
        escalation_level=data.escalation_level,
        auto_assign_to_role=data.auto_assign_to_role,
        is_active=data.is_active,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return EscalationRuleResponse.model_validate(rule)


@router.get(
    "/escalation-rules/{rule_id}",
    response_model=EscalationRuleResponse,
    dependencies=[Depends(require_internal)],
)
async def get_escalation_rule(
    rule_id: UUID,
    db: DB,
) -> EscalationRuleResponse:
    """Get a single escalation rule by ID."""
    from app.models.escalation_rule import EscalationRule

    result = await db.execute(select(EscalationRule).where(EscalationRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise NotFoundException("Escalation rule not found")
    return EscalationRuleResponse.model_validate(rule)


@router.put(
    "/escalation-rules/{rule_id}",
    response_model=EscalationRuleResponse,
    dependencies=[Depends(require_admin)],
)
async def update_escalation_rule(
    rule_id: UUID,
    data: EscalationRuleUpdate,
    db: DB,
) -> EscalationRuleResponse:
    """Update an escalation rule (MD only)."""
    from app.models.escalation_rule import EscalationRule

    result = await db.execute(select(EscalationRule).where(EscalationRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise NotFoundException("Escalation rule not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return EscalationRuleResponse.model_validate(rule)


@router.delete(
    "/escalation-rules/{rule_id}",
    dependencies=[Depends(require_admin)],
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_escalation_rule(
    rule_id: UUID,
    db: DB,
) -> None:
    """Delete an escalation rule (MD only)."""
    from app.models.escalation_rule import EscalationRule

    result = await db.execute(select(EscalationRule).where(EscalationRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise NotFoundException("Escalation rule not found")
    await db.delete(rule)
    await db.commit()


# ── Playbook Management ────────────────────────────────────────────────
# NOTE: these static /playbooks/* routes MUST appear before /{escalation_id}
# so FastAPI doesn't swallow them as escalation-id path parameters.


@router.get(
    "/playbooks/list",
    response_model=PlaybookListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_playbooks(
    db: DB,
    is_active: bool | None = None,
    escalation_type: str | None = None,
) -> PlaybookListResponse:
    """List all escalation playbooks."""
    from sqlalchemy import func as sa_func

    from app.models.escalation_playbook import EscalationPlaybook

    q = select(EscalationPlaybook)
    if is_active is not None:
        q = q.where(EscalationPlaybook.is_active == is_active)
    if escalation_type:
        q = q.where(EscalationPlaybook.escalation_type == escalation_type)

    count_result = await db.execute(select(sa_func.count()).select_from(q.subquery()))
    total = count_result.scalar_one()

    q = q.order_by(EscalationPlaybook.created_at.asc())
    result = await db.execute(q)
    playbooks = result.scalars().all()

    return PlaybookListResponse(
        playbooks=[PlaybookResponse.model_validate(p) for p in playbooks],
        total=total,
    )


@router.post(
    "/playbooks/list",
    response_model=PlaybookResponse,
    dependencies=[Depends(require_admin)],
    status_code=status.HTTP_201_CREATED,
)
async def create_playbook(
    data: PlaybookCreate,
    db: DB,
) -> PlaybookResponse:
    """Create a new escalation playbook (MD only)."""
    from app.models.escalation_playbook import EscalationPlaybook

    playbook = EscalationPlaybook(
        escalation_type=data.escalation_type,
        name=data.name,
        description=data.description,
        steps=[s.model_dump() for s in data.steps],
        success_criteria=data.success_criteria,
        escalation_paths=[p.model_dump() for p in data.escalation_paths],
        is_active=data.is_active,
    )
    db.add(playbook)
    await db.commit()
    await db.refresh(playbook)
    return PlaybookResponse.model_validate(playbook)


@router.post(
    "/playbooks/seed",
    dependencies=[Depends(require_admin)],
    status_code=status.HTTP_204_NO_CONTENT,
)
async def seed_playbooks(db: DB) -> None:
    """Seed default playbooks for all escalation types (idempotent, MD only)."""
    from app.services.escalation_playbook_service import seed_default_playbooks

    await seed_default_playbooks(db)


@router.get(
    "/playbooks/{playbook_id}",
    response_model=PlaybookResponse,
    dependencies=[Depends(require_internal)],
)
async def get_playbook(
    playbook_id: UUID,
    db: DB,
) -> PlaybookResponse:
    """Get a playbook by ID."""
    from app.models.escalation_playbook import EscalationPlaybook

    result = await db.execute(
        select(EscalationPlaybook).where(EscalationPlaybook.id == playbook_id)
    )
    playbook = result.scalar_one_or_none()
    if not playbook:
        raise NotFoundException("Playbook not found")
    return PlaybookResponse.model_validate(playbook)


@router.put(
    "/playbooks/{playbook_id}",
    response_model=PlaybookResponse,
    dependencies=[Depends(require_admin)],
)
async def update_playbook(
    playbook_id: UUID,
    data: PlaybookUpdate,
    db: DB,
) -> PlaybookResponse:
    """Update a playbook (MD only)."""
    from app.models.escalation_playbook import EscalationPlaybook

    result = await db.execute(
        select(EscalationPlaybook).where(EscalationPlaybook.id == playbook_id)
    )
    playbook = result.scalar_one_or_none()
    if not playbook:
        raise NotFoundException("Playbook not found")

    update_data = data.model_dump(exclude_unset=True)
    if "steps" in update_data and update_data["steps"] is not None:
        update_data["steps"] = [
            s.model_dump() if hasattr(s, "model_dump") else s
            for s in update_data["steps"]
        ]
    if "escalation_paths" in update_data and update_data["escalation_paths"] is not None:
        update_data["escalation_paths"] = [
            p.model_dump() if hasattr(p, "model_dump") else p
            for p in update_data["escalation_paths"]
        ]

    for field, value in update_data.items():
        setattr(playbook, field, value)

    await db.commit()
    await db.refresh(playbook)
    return PlaybookResponse.model_validate(playbook)


@router.delete(
    "/playbooks/{playbook_id}",
    dependencies=[Depends(require_admin)],
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_playbook(
    playbook_id: UUID,
    db: DB,
) -> None:
    """Delete a playbook (MD only)."""
    from app.models.escalation_playbook import EscalationPlaybook

    result = await db.execute(
        select(EscalationPlaybook).where(EscalationPlaybook.id == playbook_id)
    )
    playbook = result.scalar_one_or_none()
    if not playbook:
        raise NotFoundException("Playbook not found")
    await db.delete(playbook)
    await db.commit()


@router.get(
    "/overdue",
    response_model=OverdueEscalationResponse,
    dependencies=[Depends(require_internal)],
)
async def list_overdue_escalations(
    db: DB,
    pagination: Pagination,
) -> OverdueEscalationResponse:
    """List escalations where the response deadline has passed and status is still active."""
    escalations, total = await get_overdue_escalations(
        db, skip=pagination.skip, limit=pagination.limit
    )
    return OverdueEscalationResponse(escalations=escalations, total=total)  # type: ignore[arg-type]


@router.get(
    "/simple-metrics",
    response_model=EscalationMetricsResponse,
    dependencies=[Depends(require_internal)],
)
async def get_simple_metrics(db: DB) -> EscalationMetricsResponse:
    """Return concise escalation metrics: open by level, avg resolution, overdue count, trends."""
    metrics = await get_simple_escalation_metrics(db)
    return EscalationMetricsResponse(**metrics)  # type: ignore[arg-type]


@router.get(
    "/{escalation_id}",
    response_model=EscalationResponse,
    dependencies=[Depends(require_internal)],
)
async def get_escalation(
    escalation_id: UUID,
    db: DB,
) -> EscalationResponse:
    """Get a single escalation by ID."""
    result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise NotFoundException("Escalation not found")

    # Get owner info
    owner_result = await db.execute(select(User).where(User.id == escalation.owner_id))
    owner = owner_result.scalar_one_or_none()

    # Get triggerer info
    triggerer_result = await db.execute(select(User).where(User.id == escalation.triggered_by))
    triggerer = triggerer_result.scalar_one_or_none()

    return EscalationResponse(
        id=escalation.id,
        level=escalation.level,
        status=escalation.status,
        title=escalation.title,
        description=escalation.description,
        entity_type=escalation.entity_type,
        entity_id=escalation.entity_id,
        owner_id=escalation.owner_id,
        owner_email=owner.email if owner else None,
        owner_name=owner.full_name if owner else None,
        program_id=escalation.program_id,
        client_id=escalation.client_id,
        triggered_at=escalation.triggered_at,
        acknowledged_at=escalation.acknowledged_at,
        resolved_at=escalation.resolved_at,
        closed_at=escalation.closed_at,
        triggered_by=escalation.triggered_by,
        triggered_by_email=triggerer.email if triggerer else None,
        triggered_by_name=triggerer.full_name if triggerer else None,
        risk_factors=escalation.risk_factors,
        escalation_chain=escalation.escalation_chain,
        resolution_notes=escalation.resolution_notes,
        created_at=escalation.created_at,
        updated_at=escalation.updated_at,
    )


@router.put(
    "/{escalation_id}",
    response_model=EscalationResponse,
    dependencies=[Depends(require_internal)],
)
async def update_escalation_endpoint(
    escalation_id: UUID,
    data: EscalationUpdate,
    db: DB,
    current_user: CurrentUser,
) -> EscalationResponse:
    """Update escalation status and/or notes."""
    escalation: Escalation | None
    if data.status:
        escalation = await update_escalation_status(
            db=db,
            escalation_id=escalation_id,
            new_status=EscalationStatus(data.status),
            user=current_user,
            notes=data.resolution_notes,
        )
    else:
        result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
        escalation = result.scalar_one_or_none()
        if escalation is None:
            raise NotFoundException("Escalation not found")
        if data.resolution_notes:
            escalation.resolution_notes = data.resolution_notes
        await db.commit()
        await db.refresh(escalation)

    # Get owner info
    owner_result = await db.execute(select(User).where(User.id == escalation.owner_id))
    owner = owner_result.scalar_one_or_none()

    # Get triggerer info
    triggerer_result = await db.execute(select(User).where(User.id == escalation.triggered_by))
    triggerer = triggerer_result.scalar_one_or_none()

    return EscalationResponse(
        id=escalation.id,
        level=escalation.level,
        status=escalation.status,
        title=escalation.title,
        description=escalation.description,
        entity_type=escalation.entity_type,
        entity_id=escalation.entity_id,
        owner_id=escalation.owner_id,
        owner_email=owner.email if owner else None,
        owner_name=owner.full_name if owner else None,
        program_id=escalation.program_id,
        client_id=escalation.client_id,
        triggered_at=escalation.triggered_at,
        acknowledged_at=escalation.acknowledged_at,
        resolved_at=escalation.resolved_at,
        closed_at=escalation.closed_at,
        triggered_by=escalation.triggered_by,
        triggered_by_email=triggerer.email if triggerer else None,
        triggered_by_name=triggerer.full_name if triggerer else None,
        risk_factors=escalation.risk_factors,
        escalation_chain=escalation.escalation_chain,
        resolution_notes=escalation.resolution_notes,
        created_at=escalation.created_at,
        updated_at=escalation.updated_at,
    )


@router.post(
    "/{escalation_id}/acknowledge",
    response_model=EscalationResponse,
    dependencies=[Depends(require_internal)],
)
async def acknowledge_escalation(
    escalation_id: UUID,
    db: DB,
    current_user: CurrentUser,
) -> EscalationResponse:
    """Acknowledge an escalation."""
    escalation = await update_escalation_status(
        db=db,
        escalation_id=escalation_id,
        new_status=EscalationStatus.acknowledged,
        user=current_user,
    )

    # Get owner info
    owner_result = await db.execute(select(User).where(User.id == escalation.owner_id))
    owner = owner_result.scalar_one_or_none()

    # Get triggerer info
    triggerer_result = await db.execute(select(User).where(User.id == escalation.triggered_by))
    triggerer = triggerer_result.scalar_one_or_none()

    return EscalationResponse(
        id=escalation.id,
        level=escalation.level,
        status=escalation.status,
        title=escalation.title,
        description=escalation.description,
        entity_type=escalation.entity_type,
        entity_id=escalation.entity_id,
        owner_id=escalation.owner_id,
        owner_email=owner.email if owner else None,
        owner_name=owner.full_name if owner else None,
        program_id=escalation.program_id,
        client_id=escalation.client_id,
        triggered_at=escalation.triggered_at,
        acknowledged_at=escalation.acknowledged_at,
        resolved_at=escalation.resolved_at,
        closed_at=escalation.closed_at,
        triggered_by=escalation.triggered_by,
        triggered_by_email=triggerer.email if triggerer else None,
        triggered_by_name=triggerer.full_name if triggerer else None,
        risk_factors=escalation.risk_factors,
        escalation_chain=escalation.escalation_chain,
        resolution_notes=escalation.resolution_notes,
        created_at=escalation.created_at,
        updated_at=escalation.updated_at,
    )


@router.post(
    "/{escalation_id}/resolve",
    response_model=EscalationResponse,
    dependencies=[Depends(require_internal)],
)
async def resolve_escalation(
    escalation_id: UUID,
    db: DB,
    current_user: CurrentUser,
    notes: str | None = None,
) -> EscalationResponse:
    """Resolve an escalation."""
    escalation = await update_escalation_status(
        db=db,
        escalation_id=escalation_id,
        new_status=EscalationStatus.resolved,
        user=current_user,
        notes=notes,
    )

    # Get owner info
    owner_result = await db.execute(select(User).where(User.id == escalation.owner_id))
    owner = owner_result.scalar_one_or_none()

    # Get triggerer info
    triggerer_result = await db.execute(select(User).where(User.id == escalation.triggered_by))
    triggerer = triggerer_result.scalar_one_or_none()

    return EscalationResponse(
        id=escalation.id,
        level=escalation.level,
        status=escalation.status,
        title=escalation.title,
        description=escalation.description,
        entity_type=escalation.entity_type,
        entity_id=escalation.entity_id,
        owner_id=escalation.owner_id,
        owner_email=owner.email if owner else None,
        owner_name=owner.full_name if owner else None,
        program_id=escalation.program_id,
        client_id=escalation.client_id,
        triggered_at=escalation.triggered_at,
        acknowledged_at=escalation.acknowledged_at,
        resolved_at=escalation.resolved_at,
        closed_at=escalation.closed_at,
        triggered_by=escalation.triggered_by,
        triggered_by_email=triggerer.email if triggerer else None,
        triggered_by_name=triggerer.full_name if triggerer else None,
        risk_factors=escalation.risk_factors,
        escalation_chain=escalation.escalation_chain,
        resolution_notes=escalation.resolution_notes,
        created_at=escalation.created_at,
        updated_at=escalation.updated_at,
    )


@router.get(
    "/entity/{entity_type}/{entity_id}",
    response_model=EscalationListResponse,
    dependencies=[Depends(require_internal)],
)
async def get_entity_escalations(
    entity_type: str,
    entity_id: str,
    db: DB,
    pagination: Pagination,
) -> EscalationListResponse:
    """Get escalations for a specific entity."""
    from app.services.escalation_service import get_active_escalations

    escalations = await get_active_escalations(
        db=db,
    )
    # Filter by entity
    filtered = [e for e in escalations if e.entity_type == entity_type and e.entity_id == entity_id]

    return EscalationListResponse(
        escalations=filtered[pagination.skip : pagination.skip + pagination.limit],  # type: ignore[arg-type]
        total=len(filtered),
    )


@router.post(
    "/check-risks",
    response_model=list[EscalationResponse],
    dependencies=[Depends(require_internal)],
)
async def trigger_risk_check(
    data: EscalationTriggerRequest,
    db: DB,
) -> list[EscalationResponse]:
    """Trigger risk check on an entity (e.g., milestone)."""
    if data.entity_type == "milestone":
        try:
            milestone_id = UUID(data.entity_id)
        except ValueError as err:
            raise BadRequestException("Invalid entity_id format") from err
        escalations = await check_and_escalate_milestone_risk(db, milestone_id)

        # Build response with owner info
        responses = []
        for esc in escalations:
            owner_result = await db.execute(select(User).where(User.id == esc.owner_id))
            owner = owner_result.scalar_one_or_none()
            triggerer_result = await db.execute(select(User).where(User.id == esc.triggered_by))
            triggerer = triggerer_result.scalar_one_or_none()

            responses.append(
                EscalationResponse(
                    id=esc.id,
                    level=esc.level,
                    status=esc.status,
                    title=esc.title,
                    description=esc.description,
                    entity_type=esc.entity_type,
                    entity_id=esc.entity_id,
                    owner_id=esc.owner_id,
                    owner_email=owner.email if owner else None,
                    owner_name=owner.full_name if owner else None,
                    program_id=esc.program_id,
                    client_id=esc.client_id,
                    triggered_at=esc.triggered_at,
                    acknowledged_at=esc.acknowledged_at,
                    resolved_at=esc.resolved_at,
                    closed_at=esc.closed_at,
                    triggered_by=esc.triggered_by,
                    triggered_by_email=triggerer.email if triggerer else None,
                    triggered_by_name=triggerer.full_name if triggerer else None,
                    risk_factors=esc.risk_factors,
                    escalation_chain=esc.escalation_chain,
                    resolution_notes=esc.resolution_notes,
                    created_at=esc.created_at,
                    updated_at=esc.updated_at,
                )
            )
        return responses
    else:
        raise BadRequestException(f"Risk checks not implemented for {data.entity_type}")


# ── Overdue + Reassign ────────────────────────────────────────────────


@router.post(
    "/{escalation_id}/reassign",
    response_model=EscalationResponse,
    dependencies=[Depends(require_admin)],
)
async def reassign_escalation_endpoint(
    escalation_id: UUID,
    data: ReassignRequest,
    db: DB,
    current_user: CurrentUser,
) -> EscalationResponse:
    """Reassign an escalation to a new owner (MD only)."""
    try:
        escalation = await reassign_escalation(
            db=db,
            escalation_id=escalation_id,
            new_owner_id=data.new_owner_id,
            user=current_user,
        )
    except ValueError as e:
        raise NotFoundException(str(e)) from e

    owner_result = await db.execute(select(User).where(User.id == escalation.owner_id))
    owner = owner_result.scalar_one_or_none()
    triggerer_result = await db.execute(select(User).where(User.id == escalation.triggered_by))
    triggerer = triggerer_result.scalar_one_or_none()

    return EscalationResponse(
        id=escalation.id,
        level=escalation.level,
        status=escalation.status,
        title=escalation.title,
        description=escalation.description,
        entity_type=escalation.entity_type,
        entity_id=escalation.entity_id,
        owner_id=escalation.owner_id,
        owner_email=owner.email if owner else None,
        owner_name=owner.full_name if owner else None,
        program_id=escalation.program_id,
        client_id=escalation.client_id,
        triggered_at=escalation.triggered_at,
        acknowledged_at=escalation.acknowledged_at,
        resolved_at=escalation.resolved_at,
        closed_at=escalation.closed_at,
        triggered_by=escalation.triggered_by,
        triggered_by_email=triggerer.email if triggerer else None,
        triggered_by_name=triggerer.full_name if triggerer else None,
        risk_factors=escalation.risk_factors,
        escalation_chain=escalation.escalation_chain,
        resolution_notes=escalation.resolution_notes,
        created_at=escalation.created_at,
        updated_at=escalation.updated_at,
        response_deadline=escalation.response_deadline,
        is_overdue=escalation.is_overdue,
    )


# ── Chain Progression ──────────────────────────────────────────────────


@router.post(
    "/{escalation_id}/progress",
    response_model=EscalationResponse,
    dependencies=[Depends(require_internal)],
)
async def progress_escalation(
    escalation_id: UUID,
    data: EscalationProgressRequest,
    db: DB,
    current_user: CurrentUser,
) -> EscalationResponse:
    """Progress an escalation to the next level in the chain."""
    try:
        escalation = await progress_escalation_chain(
            db=db,
            escalation_id=escalation_id,
            user=current_user,
            notes=data.notes,
        )
    except ValueError as e:
        raise BadRequestException(str(e)) from e

    # Get owner info
    owner_result = await db.execute(select(User).where(User.id == escalation.owner_id))
    owner = owner_result.scalar_one_or_none()

    # Get triggerer info
    triggerer_result = await db.execute(select(User).where(User.id == escalation.triggered_by))
    triggerer = triggerer_result.scalar_one_or_none()

    return EscalationResponse(
        id=escalation.id,
        level=escalation.level,
        status=escalation.status,
        title=escalation.title,
        description=escalation.description,
        entity_type=escalation.entity_type,
        entity_id=escalation.entity_id,
        owner_id=escalation.owner_id,
        owner_email=owner.email if owner else None,
        owner_name=owner.full_name if owner else None,
        program_id=escalation.program_id,
        client_id=escalation.client_id,
        triggered_at=escalation.triggered_at,
        acknowledged_at=escalation.acknowledged_at,
        resolved_at=escalation.resolved_at,
        closed_at=escalation.closed_at,
        triggered_by=escalation.triggered_by,
        triggered_by_email=triggerer.email if triggerer else None,
        triggered_by_name=triggerer.full_name if triggerer else None,
        risk_factors=escalation.risk_factors,
        escalation_chain=escalation.escalation_chain,
        resolution_notes=escalation.resolution_notes,
        created_at=escalation.created_at,
        updated_at=escalation.updated_at,
    )


@router.get(
    "/{escalation_id}/chain",
    response_model=EscalationChainResponse,
    dependencies=[Depends(require_internal)],
)
async def get_escalation_chain_endpoint(
    escalation_id: UUID,
    db: DB,
) -> EscalationChainResponse:
    """Get the escalation chain history."""
    try:
        chain_data = await get_escalation_chain(db=db, escalation_id=escalation_id)
    except ValueError as e:
        raise NotFoundException(str(e)) from e

    return EscalationChainResponse(**chain_data)  # type: ignore[arg-type]
# ── Per-escalation playbook endpoints ─────────────────────────────────


@router.get(
    "/{escalation_id}/playbook",
    response_model=PlaybookWithExecutionResponse,
    dependencies=[Depends(require_internal)],
)
async def get_escalation_playbook(
    escalation_id: UUID,
    db: DB,
    current_user: CurrentUser,
) -> PlaybookWithExecutionResponse:
    """Get the applicable playbook and execution state for an escalation."""
    from app.services.escalation_playbook_service import get_playbook_view

    try:
        result = await get_playbook_view(db, escalation_id, current_user)
    except ValueError as e:
        raise NotFoundException(str(e)) from e

    if result is None:
        raise NotFoundException("No playbook found for this escalation type")

    return result


@router.patch(
    "/{escalation_id}/playbook/steps",
    response_model=ExecutionResponse,
    dependencies=[Depends(require_internal)],
)
async def update_playbook_step(
    escalation_id: UUID,
    data: StepStateUpdate,
    db: DB,
    current_user: CurrentUser,
) -> ExecutionResponse:
    """Mark a playbook step as complete, skipped, or add notes."""
    from app.services.escalation_playbook_service import update_step_state

    try:
        execution = await update_step_state(db, escalation_id, data, current_user)
    except ValueError as e:
        raise BadRequestException(str(e)) from e

    progress_data = execution.compute_progress()
    return ExecutionResponse(
        id=execution.id,
        playbook_id=execution.playbook_id,
        escalation_id=execution.escalation_id,
        status=execution.status,
        step_states=execution.step_states,
        started_by=execution.started_by,
        completed_steps=execution.completed_steps,
        total_steps=execution.total_steps,
        completed_at=execution.completed_at,
        progress=ProgressSummary(**progress_data),  # type: ignore[arg-type]
        created_at=execution.created_at,
        updated_at=execution.updated_at,
    )
