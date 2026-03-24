"""Document request endpoints — internal staff create requests, clients fulfil them."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import DB, CurrentUser, RLSContext, require_internal
from app.core.exceptions import NotFoundException
from app.schemas.document_request import (
    DocumentRequestCreate,
    DocumentRequestListResponse,
    DocumentRequestResponse,
    DocumentRequestTransition,
    DocumentRequestUpdate,
    FulfillDocumentRequestBody,
)
from app.services import document_request_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/",
    response_model=DocumentRequestResponse,
    status_code=201,
    dependencies=[Depends(require_internal)],
)
async def create_document_request(
    data: DocumentRequestCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentRequestResponse:
    """Create a document request for a client."""
    req = await document_request_service.create_document_request(
        db, data, requested_by=current_user.id
    )
    return DocumentRequestResponse.model_validate(req)


@router.get(
    "/",
    response_model=DocumentRequestListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_document_requests(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    client_id: UUID | None = None,
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> DocumentRequestListResponse:
    """List document requests, optionally filtered by client or status."""
    requests, total = await document_request_service.list_document_requests(
        db, client_id=client_id, status=status, skip=skip, limit=limit
    )
    return DocumentRequestListResponse(
        requests=[DocumentRequestResponse.model_validate(r) for r in requests],
        total=total,
    )


@router.get(
    "/{request_id}",
    response_model=DocumentRequestResponse,
    dependencies=[Depends(require_internal)],
)
async def get_document_request(
    request_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentRequestResponse:
    """Get a single document request."""
    req = await document_request_service.get_document_request(db, request_id)
    if not req:
        raise NotFoundException("Document request not found")
    return DocumentRequestResponse.model_validate(req)


@router.patch(
    "/{request_id}",
    response_model=DocumentRequestResponse,
    dependencies=[Depends(require_internal)],
)
async def update_document_request(
    request_id: UUID,
    data: DocumentRequestUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentRequestResponse:
    """Update a document request (title, description, deadline, etc.)."""
    req = await document_request_service.update_document_request(db, request_id, data)
    if not req:
        raise NotFoundException("Document request not found")
    return DocumentRequestResponse.model_validate(req)


@router.post(
    "/{request_id}/cancel",
    response_model=DocumentRequestResponse,
    dependencies=[Depends(require_internal)],
)
async def cancel_document_request(
    request_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentRequestResponse:
    """Cancel a pending document request."""
    req = await document_request_service.cancel_document_request(db, request_id)
    if not req:
        raise NotFoundException("Document request not found")
    return DocumentRequestResponse.model_validate(req)


@router.post(
    "/{request_id}/remind",
    response_model=DocumentRequestResponse,
    dependencies=[Depends(require_internal)],
)
async def send_reminder(
    request_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentRequestResponse:
    """Send a reminder notification to the client for a pending/overdue request."""
    req = await document_request_service.send_reminder(db, request_id)
    if not req:
        raise NotFoundException("Document request not found")
    return DocumentRequestResponse.model_validate(req)


@router.post(
    "/{request_id}/fulfill",
    response_model=DocumentRequestResponse,
    dependencies=[Depends(require_internal)],
)
async def fulfill_document_request(
    request_id: UUID,
    body: FulfillDocumentRequestBody,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentRequestResponse:
    """Mark a document request as fulfilled with the given document ID."""
    req = await document_request_service.fulfill_document_request(
        db, request_id, body.document_id
    )
    if not req:
        raise NotFoundException("Document request not found")
    return DocumentRequestResponse.model_validate(req)


@router.post(
    "/{request_id}/transition",
    response_model=DocumentRequestResponse,
    dependencies=[Depends(require_internal)],
)
async def transition_document_request(
    request_id: UUID,
    data: DocumentRequestTransition,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentRequestResponse:
    """Transition a document request to a new status.

    Valid transitions:
    - pending / overdue → in_progress
    - in_progress → received
    - received → processing
    - processing → complete
    - Any non-terminal state → cancelled
    """
    from app.core.exceptions import BadRequestException

    req = await document_request_service.transition_document_request(db, request_id, data)
    if req is None:
        raise BadRequestException(
            "Invalid status transition or document request not found"
        )
    return DocumentRequestResponse.model_validate(req)
