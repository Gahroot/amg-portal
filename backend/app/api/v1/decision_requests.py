"""Decision request management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import DB, CurrentUser, require_internal
from app.schemas.decision_request import (
    DecisionListResponse,
    DecisionRequestCreate,
    DecisionRequestResponse,
    DecisionRequestUpdate,
    DecisionRespondRequest,
)
from app.services.decision_service import decision_service

router = APIRouter()


@router.post(
    "/",
    response_model=DecisionRequestResponse,
    status_code=201,
    dependencies=[Depends(require_internal)],
)
async def create_decision_request(
    data: DecisionRequestCreate,
    db: DB,
    current_user: CurrentUser,
):
    """Create a new decision request for a client."""
    decision = await decision_service.create(db, obj_in=data, created_by_id=current_user.id)
    return decision


@router.get("/", response_model=DecisionListResponse)
async def list_decision_requests(
    db: DB,
    current_user: CurrentUser,
    client_id: uuid.UUID | None = None,
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List decision requests."""
    decisions, total = await decision_service.get_decision_requests_for_user(
        db,
        user_id=current_user.id,
        user_role=current_user.role,
        client_id=client_id,
        status=status,
        skip=skip,
        limit=limit,
    )
    return DecisionListResponse(decisions=decisions, total=total)


@router.get("/pending", response_model=DecisionListResponse)
async def list_pending_decisions(
    db: DB,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List pending decision requests for current user."""
    decisions, total = await decision_service.get_decision_requests_for_user(
        db,
        user_id=current_user.id,
        user_role=current_user.role,
        status="pending",
        skip=skip,
        limit=limit,
    )
    return DecisionListResponse(decisions=decisions, total=total)


@router.get("/{decision_id}", response_model=DecisionRequestResponse)
async def get_decision_request(
    decision_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Get a specific decision request."""
    decision = await decision_service.get(db, decision_id)
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Decision request not found"
        )

    # Check access based on role
    # - Internal users can see all decisions for their clients
    # - Clients can only see their own decisions
    # - Partners can see decisions for their assignments
    has_access = await decision_service.check_access(db, decision, current_user)
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return decision


@router.post("/{decision_id}/respond", response_model=DecisionRequestResponse)
async def respond_to_decision(
    decision_id: uuid.UUID,
    data: DecisionRespondRequest,
    db: DB,
    current_user: CurrentUser,
):
    """Respond to a decision request."""
    decision = await decision_service.get(db, decision_id)
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Decision request not found"
        )

    if decision.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Decision is not pending"
        )

    result = await decision_service.submit_response(db, decision, data.response, current_user.id)

    return result


@router.patch("/{decision_id}", response_model=DecisionRequestResponse)
async def update_decision_request(
    decision_id: uuid.UUID,
    data: DecisionRequestUpdate,
    db: DB,
    current_user: CurrentUser,
):
    """Update a decision request (internal use)."""
    decision = await decision_service.get(db, decision_id)
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Decision request not found"
        )

    return await decision_service.update(db, db_obj=decision, obj_in=data)
