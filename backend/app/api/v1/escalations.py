"""Escalation endpoints — CRUD + status workflows for internal staff."""

import csv
import io
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api.deps import DB, require_internal
from app.api.v1.escalations_workflow import router as escalations_workflow_router
from app.core.exceptions import BadRequestException
from app.schemas.escalation import (
    EscalationListResponse,
    EscalationMetricsResponse,
    EscalationResponse,
    EscalationTriggerRequest,
    OverdueEscalationResponse,
)
from app.services.escalation_metrics_service import get_escalation_metrics
from app.services.escalation_service import (
    check_and_escalate_milestone_risk,
    get_escalations_with_owner_info,
    get_overdue_escalations,
    get_simple_escalation_metrics,
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
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    level: str | None = None,
    status: str | None = None,
    program_id: UUID | None = None,
    client_id: UUID | None = None,
    search: str | None = None,
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


@router.get(
    "/overdue",
    response_model=OverdueEscalationResponse,
    dependencies=[Depends(require_internal)],
)
async def list_overdue_escalations(
    db: DB,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> OverdueEscalationResponse:
    """List escalations where the response deadline has passed and status is still active."""
    escalations, total = await get_overdue_escalations(db, skip=skip, limit=limit)
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
    from app.models.user import User

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


router.include_router(escalations_workflow_router)
