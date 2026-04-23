"""Document lifecycle endpoints — expiry, archival, metadata."""

import contextlib
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    DB,
    CurrentUser,
    RLSContext,
    require_compliance,
    require_internal,
)
from app.core.exceptions import (
    BadRequestException,
    NotFoundException,
)
from app.models.document import Document
from app.schemas.document import ExpiringDocumentsResponse
from app.schemas.document_delivery import (
    CustodyChainResponse,
    SealDocumentRequest,
    VaultDocumentResponse,
)
from app.services import document_expiry_service, document_vault_service
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_vault_response(doc: Document) -> VaultDocumentResponse:
    data: dict[str, object] = {
        "id": doc.id,
        "file_path": doc.file_path,
        "file_name": doc.file_name,
        "file_size": doc.file_size,
        "content_type": doc.content_type,
        "entity_type": doc.entity_type,
        "entity_id": doc.entity_id,
        "category": doc.category,
        "description": doc.description,
        "version": doc.version,
        "uploaded_by": doc.uploaded_by,
        "vault_status": doc.vault_status,
        "sealed_at": doc.sealed_at,
        "sealed_by": doc.sealed_by,
        "retention_policy": doc.retention_policy,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
        "download_url": None,
    }
    if doc.file_path:
        with contextlib.suppress(Exception):
            data["download_url"] = storage_service.get_presigned_url(str(doc.file_path))
    return VaultDocumentResponse.model_validate(data)


@router.get("/expiring", response_model=ExpiringDocumentsResponse)
async def list_expiring_documents(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    status: str | None = Query(None, description="Filter: expired, expiring_30, expiring_90"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> ExpiringDocumentsResponse:
    """List documents with expiry dates within the next 90 days or already expired."""
    return await document_expiry_service.list_expiring_documents(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        status_filter=status,
        skip=skip,
        limit=limit,
    )


@router.post("/{document_id}/seal", response_model=VaultDocumentResponse)
async def seal_document(
    document_id: UUID,
    body: SealDocumentRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_compliance),
) -> VaultDocumentResponse:
    """Seal a document for compliance — makes it immutable."""
    try:
        doc = await document_vault_service.seal_document(
            db, document_id, current_user.id, body.retention_policy
        )
    except ValueError as e:
        raise BadRequestException(str(e)) from e
    return _build_vault_response(doc)


@router.get("/{document_id}/custody-chain", response_model=CustodyChainResponse)
async def get_custody_chain(
    document_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> CustodyChainResponse:
    """Get full chain of custody audit trail for a document."""
    try:
        data = await document_vault_service.get_chain_of_custody(db, document_id)
    except ValueError as e:
        raise NotFoundException(str(e)) from e
    return CustodyChainResponse.model_validate(data)


@router.get("/{document_id}/integrity")
async def verify_integrity(
    document_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_compliance),
) -> dict[str, object]:
    """Verify document integrity in storage."""
    try:
        result = await document_vault_service.verify_document_integrity(db, document_id)
    except ValueError as e:
        raise NotFoundException(str(e)) from e
    return result
