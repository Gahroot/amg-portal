"""Two-person deletion request management endpoints."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.api.deps import DB, CurrentUser, require_compliance, require_rm_or_above
from app.models.user import User
from app.schemas.deletion_request import (
    DeletionRequestApprove,
    DeletionRequestCreate,
    DeletionRequestListResponse,
    DeletionRequestReject,
    DeletionRequestResponse,
)
from app.services.audit_service import log_action, model_to_dict
from app.services.deletion_service import deletion_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/",
    response_model=DeletionRequestResponse,
    status_code=201,
)
async def create_deletion_request(
    data: DeletionRequestCreate,
    db: DB,
    current_user: Annotated[User, Depends(require_rm_or_above)],
    request: Request,
) -> DeletionRequestResponse:
    """Create a new deletion request. Requires RM or above."""
    try:
        deletion_request = await deletion_service.create_request(
            db, data=data, requested_by=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="create",
        entity_type="deletion_request",
        entity_id=str(deletion_request.id),
        after_state=model_to_dict(deletion_request),
        request=request,
    )
    await db.commit()
    return DeletionRequestResponse.model_validate(deletion_request)


@router.get("/", response_model=DeletionRequestListResponse)
async def list_deletion_requests(
    db: DB,
    current_user: CurrentUser,
    request_status: str | None = Query(None, alias="status"),
    entity_type: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> DeletionRequestListResponse:
    """List deletion requests with optional filters."""
    requests, total = await deletion_service.list_requests(
        db, status=request_status, entity_type=entity_type, skip=skip, limit=limit
    )
    return DeletionRequestListResponse(
        deletion_requests=[DeletionRequestResponse.model_validate(r) for r in requests],
        total=total,
    )


@router.get("/{request_id}", response_model=DeletionRequestResponse)
async def get_deletion_request(
    request_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> DeletionRequestResponse:
    """Get a specific deletion request by ID."""
    deletion_request = await deletion_service.get(db, request_id)
    if not deletion_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Deletion request not found"
        )
    return DeletionRequestResponse.model_validate(deletion_request)


@router.post("/{request_id}/approve", response_model=DeletionRequestResponse)
async def approve_deletion_request(
    request_id: uuid.UUID,
    _body: DeletionRequestApprove,
    db: DB,
    current_user: Annotated[User, Depends(require_compliance)],
    request: Request,
) -> DeletionRequestResponse:
    """Approve a deletion request (two-person authorization).

    Only managing_director or finance_compliance roles may approve.
    The approver must be a different user than the requester.
    """
    deletion_request = await deletion_service.get(db, request_id)
    if not deletion_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Deletion request not found"
        )

    before = model_to_dict(deletion_request)
    try:
        result = await deletion_service.approve_request(
            db, deletion_request=deletion_request, approved_by=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="deletion_request",
        entity_id=str(request_id),
        before_state=before,
        after_state=model_to_dict(result),
        request=request,
    )
    await db.commit()
    return DeletionRequestResponse.model_validate(result)


@router.post("/{request_id}/reject", response_model=DeletionRequestResponse)
async def reject_deletion_request(
    request_id: uuid.UUID,
    body: DeletionRequestReject,
    db: DB,
    current_user: Annotated[User, Depends(require_compliance)],
    request: Request,
) -> DeletionRequestResponse:
    """Reject a deletion request. Requires managing_director or finance_compliance."""
    deletion_request = await deletion_service.get(db, request_id)
    if not deletion_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Deletion request not found"
        )

    before = model_to_dict(deletion_request)
    try:
        result = await deletion_service.reject_request(
            db,
            deletion_request=deletion_request,
            rejected_by=current_user.id,
            reason=body.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="deletion_request",
        entity_id=str(request_id),
        before_state=before,
        after_state=model_to_dict(result),
        request=request,
    )
    await db.commit()
    return DeletionRequestResponse.model_validate(result)
