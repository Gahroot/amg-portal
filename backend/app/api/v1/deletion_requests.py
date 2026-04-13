"""Two-person deletion authorization endpoints.

Every destructive deletion must be requested by one internal user and
approved by a different Managing Director before it is executed.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DB, CurrentUser, Pagination, require_admin, require_internal
from app.core.exceptions import NotFoundException
from app.schemas.deletion_request import (
    DeletionRequestCreate,
    DeletionRequestListResponse,
    DeletionRequestResponse,
    RejectDeletionRequest,
)
from app.services.deletion_service import SUPPORTED_ENTITY_TYPES, deletion_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/",
    response_model=DeletionRequestResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal)],
    summary="Request deletion of an entity",
    description=(
        "Creates a pending two-person deletion request. A different Managing Director"
        " must approve before the entity is soft-deleted."
    ),
)
async def create_deletion_request(
    data: DeletionRequestCreate,
    db: DB,
    current_user: CurrentUser,
) -> DeletionRequestResponse:
    """Submit a deletion request for review."""
    req = await deletion_service.request_deletion(db, data=data, requester=current_user)
    return DeletionRequestResponse.model_validate(req)


@router.get(
    "/",
    response_model=DeletionRequestListResponse,
    dependencies=[Depends(require_admin)],
    summary="List deletion requests",
)
async def list_deletion_requests(
    db: DB,
    pagination: Pagination,
    status_filter: str | None = Query(None, alias="status"),
    entity_type: str | None = Query(None, description=f"One of: {SUPPORTED_ENTITY_TYPES}"),
) -> DeletionRequestListResponse:
    """List all deletion requests. Restricted to Managing Directors."""
    requests, total = await deletion_service.list_requests(
        db,
        status_filter=status_filter,
        entity_type=entity_type,
        skip=pagination.skip,
        limit=pagination.limit,
    )
    return DeletionRequestListResponse(
        requests=[DeletionRequestResponse.model_validate(r) for r in requests],
        total=total,
    )


@router.get(
    "/{request_id}",
    response_model=DeletionRequestResponse,
    dependencies=[Depends(require_internal)],
    summary="Get a deletion request",
)
async def get_deletion_request(
    request_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> DeletionRequestResponse:
    """Fetch a single deletion request by ID."""
    req = await deletion_service.get(db, request_id)
    if req is None:
        raise NotFoundException("Deletion request not found")
    return DeletionRequestResponse.model_validate(req)


@router.post(
    "/{request_id}/approve",
    response_model=DeletionRequestResponse,
    dependencies=[Depends(require_admin)],
    summary="Approve a deletion request",
    description=(
        "Approves and executes the deletion. The approver must be a Managing Director"
        " and must be a different user from the requester (two-person rule)."
    ),
)
async def approve_deletion_request(
    request_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> DeletionRequestResponse:
    """Approve and execute a pending deletion request."""
    req = await deletion_service.approve_deletion(db, request_id=request_id, approver=current_user)
    return DeletionRequestResponse.model_validate(req)


@router.post(
    "/{request_id}/reject",
    response_model=DeletionRequestResponse,
    dependencies=[Depends(require_admin)],
    summary="Reject a deletion request",
)
async def reject_deletion_request(
    request_id: uuid.UUID,
    data: RejectDeletionRequest,
    db: DB,
    current_user: CurrentUser,
) -> DeletionRequestResponse:
    """Reject a pending deletion request with a reason."""
    req = await deletion_service.reject_deletion(
        db,
        request_id=request_id,
        approver=current_user,
        reason=data.reason,
    )
    return DeletionRequestResponse.model_validate(req)
