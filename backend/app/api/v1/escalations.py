"""Escalation endpoints — CRUD + status workflows for internal staff."""

import csv
import io
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, require_internal
from app.models.enums import EscalationLevel, EscalationStatus
from app.models.escalation import Escalation
from app.models.user import User
from app.schemas.escalation import (
    EscalationCreate,
    EscalationListResponse,
    EscalationResponse,
    EscalationTriggerRequest,
    EscalationUpdate,
)
from app.services.audit_service import log_action, model_to_dict
from app.services.escalation_service import (
    check_and_escalate_milestone_risk,
    create_escalation,
    get_escalations_with_owner_info,
    update_escalation_status,
)

router = APIRouter()


@router.get("/", response_model=EscalationListResponse, dependencies=[Depends(require_internal)])
async def list_escalations(
    db: DB,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    level: str | None = None,
    status: str | None = None,
    program_id: UUID | None = None,
    client_id: UUID | None = None,
) -> EscalationListResponse:
    """List escalations with filters."""
    escalations, total = await get_escalations_with_owner_info(
        db,
        skip=skip,
        limit=limit,
        level=level,
        status=status,
        program_id=program_id,
        client_id=client_id,
    )
    return EscalationListResponse(escalations=escalations, total=total)  # type: ignore[arg-type]


@router.get("/export", dependencies=[Depends(require_internal)])
async def export_escalations_csv(
    db: DB,
    level: str | None = None,
    status: str | None = None,
    program_id: UUID | None = None,
    client_id: UUID | None = None,
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
    request: Request,
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
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="create",
        entity_type="escalation",
        entity_id=str(escalation.id),
        after_state=model_to_dict(escalation),
        request=request,
    )
    await db.commit()

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escalation not found")

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
    request: Request,
) -> EscalationResponse:
    """Update escalation status and/or notes."""
    # Capture before state
    pre_result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    pre_esc = pre_result.scalar_one_or_none()
    before = model_to_dict(pre_esc) if pre_esc else None

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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Escalation not found"
            )
        if data.resolution_notes:
            escalation.resolution_notes = data.resolution_notes
        await db.commit()
        await db.refresh(escalation)

    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="escalation",
        entity_id=str(escalation_id),
        before_state=before,
        after_state=model_to_dict(escalation),
        request=request,
    )
    await db.commit()

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
    request: Request,
) -> EscalationResponse:
    """Acknowledge an escalation."""
    # Capture before state
    pre_result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    pre_esc = pre_result.scalar_one_or_none()
    before = model_to_dict(pre_esc) if pre_esc else None

    escalation = await update_escalation_status(
        db=db,
        escalation_id=escalation_id,
        new_status=EscalationStatus.acknowledged,
        user=current_user,
    )

    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="escalation",
        entity_id=str(escalation_id),
        before_state=before,
        after_state=model_to_dict(escalation),
        request=request,
    )
    await db.commit()

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
    request: Request,
    notes: str | None = None,
) -> EscalationResponse:
    """Resolve an escalation."""
    # Capture before state
    pre_result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    pre_esc = pre_result.scalar_one_or_none()
    before = model_to_dict(pre_esc) if pre_esc else None

    escalation = await update_escalation_status(
        db=db,
        escalation_id=escalation_id,
        new_status=EscalationStatus.resolved,
        user=current_user,
        notes=notes,
    )

    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="escalation",
        entity_id=str(escalation_id),
        before_state=before,
        after_state=model_to_dict(escalation),
        request=request,
    )
    await db.commit()

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
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> EscalationListResponse:
    """Get escalations for a specific entity."""
    from app.services.escalation_service import get_active_escalations

    escalations = await get_active_escalations(
        db=db,
    )
    # Filter by entity
    filtered = [e for e in escalations if e.entity_type == entity_type and e.entity_id == entity_id]

    return EscalationListResponse(
        escalations=filtered[skip : skip + limit],  # type: ignore[arg-type]
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid entity_id format",
            ) from err
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Risk checks not implemented for {data.entity_type}",
        )
