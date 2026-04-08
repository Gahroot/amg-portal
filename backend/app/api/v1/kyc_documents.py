"""KYC document management endpoints."""

from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, RLSContext, require_internal
from app.api.v1.documents import build_document_response
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.client import Client
from app.models.document import Document
from app.models.kyc_document import KYCDocument
from app.schemas.document import DocumentResponse
from app.schemas.kyc_document import (
    KYCDocumentListResponse,
    KYCDocumentResponse,
    KYCVerifyRequest,
)
from app.services.crud_base import paginate
from app.services.storage import storage_service

router = APIRouter()


def build_kyc_response(kyc: KYCDocument, include_document: bool = False) -> KYCDocumentResponse:
    doc_response: DocumentResponse | None = None
    if include_document and kyc.document:
        doc_response = build_document_response(kyc.document)

    data: dict[str, object] = {
        "id": kyc.id,
        "client_id": kyc.client_id,
        "document_id": kyc.document_id,
        "document_type": kyc.document_type,
        "status": kyc.status,
        "expiry_date": kyc.expiry_date,
        "verified_by": kyc.verified_by,
        "verified_at": kyc.verified_at,
        "rejection_reason": kyc.rejection_reason,
        "notes": kyc.notes,
        "created_at": kyc.created_at,
        "updated_at": kyc.updated_at,
        "document": doc_response,
    }
    return KYCDocumentResponse.model_validate(data)


@router.post(
    "/clients/{client_id}/kyc-documents",
    response_model=KYCDocumentResponse,
    status_code=201,
)
async def upload_kyc_document(
    client_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    file: UploadFile = File(...),
    document_type: str = Form(...),
    expiry_date: date | None = Form(None),
    notes: str | None = Form(None),
) -> KYCDocumentResponse:
    # Validate client exists
    client_result = await db.execute(select(Client).where(Client.id == client_id))
    if not client_result.scalar_one_or_none():
        raise NotFoundException("Client not found")

    await storage_service.validate_file(file)

    object_path, file_size = await storage_service.upload_file_scoped(
        file,
        "client",
        str(client_id),
        subfolder="kyc",
    )

    doc = Document(
        file_path=object_path,
        file_name=file.filename or "untitled",
        file_size=file_size,
        content_type=file.content_type,
        entity_type="client",
        entity_id=client_id,
        category="compliance",
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.flush()

    kyc = KYCDocument(
        client_id=client_id,
        document_id=doc.id,
        document_type=document_type,
        expiry_date=expiry_date,
        notes=notes,
    )
    db.add(kyc)
    await db.commit()
    await db.refresh(kyc)
    await db.refresh(doc)

    kyc.document = doc
    return build_kyc_response(kyc, include_document=True)


@router.get(
    "/clients/{client_id}/kyc-documents",
    response_model=KYCDocumentListResponse,
)
async def list_kyc_documents(
    client_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> KYCDocumentListResponse:
    query = (
        select(KYCDocument)
        .options(selectinload(KYCDocument.document))
        .where(KYCDocument.client_id == client_id)
        .order_by(KYCDocument.created_at.desc())
    )

    kyc_docs, total = await paginate(db, query, skip=skip, limit=limit)

    return KYCDocumentListResponse(
        kyc_documents=[build_kyc_response(k, include_document=True) for k in kyc_docs],
        total=total,
    )


@router.get(
    "/clients/{client_id}/kyc-documents/{kyc_id}",
    response_model=KYCDocumentResponse,
)
async def get_kyc_document(
    client_id: UUID,
    kyc_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> KYCDocumentResponse:
    result = await db.execute(
        select(KYCDocument)
        .options(selectinload(KYCDocument.document))
        .where(KYCDocument.id == kyc_id, KYCDocument.client_id == client_id)
    )
    kyc = result.scalar_one_or_none()
    if not kyc:
        raise NotFoundException("KYC document not found")
    return build_kyc_response(kyc, include_document=True)


@router.post(
    "/clients/{client_id}/kyc-documents/{kyc_id}/verify",
    response_model=KYCDocumentResponse,
)
async def verify_kyc_document(
    client_id: UUID,
    kyc_id: UUID,
    data: KYCVerifyRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> KYCDocumentResponse:
    if data.status not in ("verified", "rejected"):
        raise BadRequestException("Status must be 'verified' or 'rejected'")

    result = await db.execute(
        select(KYCDocument)
        .options(selectinload(KYCDocument.document))
        .where(KYCDocument.id == kyc_id, KYCDocument.client_id == client_id)
    )
    kyc = result.scalar_one_or_none()
    if not kyc:
        raise NotFoundException("KYC document not found")

    kyc.status = data.status  # type: ignore[assignment]
    kyc.verified_by = current_user.id  # type: ignore[assignment]
    kyc.verified_at = datetime.now(UTC)  # type: ignore[assignment]
    kyc.rejection_reason = data.rejection_reason  # type: ignore[assignment]
    kyc.notes = data.notes  # type: ignore[assignment]

    await db.commit()
    await db.refresh(kyc)
    return build_kyc_response(kyc, include_document=True)


@router.get("/kyc-documents/expiring", response_model=KYCDocumentListResponse)
async def list_expiring_kyc_documents(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    days: int = Query(30, ge=1, le=365),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> KYCDocumentListResponse:
    cutoff = datetime.now(UTC).date()
    from datetime import timedelta

    expiry_limit = cutoff + timedelta(days=days)

    query = (
        select(KYCDocument)
        .options(selectinload(KYCDocument.document))
        .where(
            KYCDocument.expiry_date.isnot(None),
            KYCDocument.expiry_date <= expiry_limit,
            KYCDocument.status == "verified",
        )
        .order_by(KYCDocument.expiry_date.asc())
    )

    kyc_docs, total = await paginate(db, query, skip=skip, limit=limit)

    return KYCDocumentListResponse(
        kyc_documents=[build_kyc_response(k, include_document=True) for k in kyc_docs],
        total=total,
    )


class KYCExpirySummaryResponse(BaseModel):
    """Summary of KYC documents by expiry window."""

    expired: int  # Already expired
    urgent: int  # Expiring within 7 days
    warning: int  # Expiring within 30 days (but > 7)
    total: int  # Total within 30 days


@router.get("/kyc-documents/expiry-summary", response_model=KYCExpirySummaryResponse)
async def get_kyc_expiry_summary(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> KYCExpirySummaryResponse:
    """Get summary counts of KYC documents by expiry window.

    Per design doc Section 08: "Monthly compliance review: KYC expiry dates."
    """
    from datetime import timedelta

    today = datetime.now(UTC).date()
    urgent_cutoff = today + timedelta(days=7)
    warning_cutoff = today + timedelta(days=30)

    # Count expired documents (verified status, expiry_date < today)
    expired_result = await db.execute(
        select(func.count())
        .select_from(KYCDocument)
        .where(
            KYCDocument.expiry_date.isnot(None),
            KYCDocument.expiry_date < today,
            KYCDocument.status == "verified",
        )
    )
    expired = expired_result.scalar() or 0

    # Count urgent (expiring within 7 days, not yet expired)
    urgent_result = await db.execute(
        select(func.count())
        .select_from(KYCDocument)
        .where(
            KYCDocument.expiry_date.isnot(None),
            KYCDocument.expiry_date >= today,
            KYCDocument.expiry_date <= urgent_cutoff,
            KYCDocument.status == "verified",
        )
    )
    urgent = urgent_result.scalar() or 0

    # Count warning (expiring within 30 days but > 7 days)
    warning_result = await db.execute(
        select(func.count())
        .select_from(KYCDocument)
        .where(
            KYCDocument.expiry_date.isnot(None),
            KYCDocument.expiry_date > urgent_cutoff,
            KYCDocument.expiry_date <= warning_cutoff,
            KYCDocument.status == "verified",
        )
    )
    warning = warning_result.scalar() or 0

    return KYCExpirySummaryResponse(
        expired=expired,
        urgent=urgent,
        warning=warning,
        total=expired + urgent + warning,
    )
