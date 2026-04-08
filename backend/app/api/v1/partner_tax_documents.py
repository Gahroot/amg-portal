"""Partner tax document endpoints — year-end 1099s and related filings."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.api.deps import (
    DB,
    CurrentPartner,
    CurrentUser,
    RLSContext,
    require_internal,
)
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.partner import PartnerProfile
from app.models.tax_document import TaxDocument, TaxDocumentAccessLog
from app.services.storage import storage_service

router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# Schemas (inline — small API surface)
# ─────────────────────────────────────────────────────────────────────────────


class TaxDocumentResponse(BaseModel):
    id: uuid.UUID
    partner_id: uuid.UUID
    tax_year: int
    document_type: str
    status: str
    file_path: str | None
    notes: str | None
    generated_at: datetime | None
    generated_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TaxDocumentListResponse(BaseModel):
    documents: list[TaxDocumentResponse]
    total: int


class TaxDocumentCreate(BaseModel):
    partner_id: uuid.UUID
    tax_year: int = Field(..., ge=2000, le=2100)
    document_type: str = Field(..., description="1099-NEC | 1099-MISC | annual_summary")
    notes: str | None = Field(None, max_length=2000)


class TaxDocumentStatusUpdate(BaseModel):
    status: str = Field(..., description="draft | published | superseded")
    notes: str | None = Field(None, max_length=2000)


class TaxDocumentDownloadResponse(BaseModel):
    """Presigned download URL response for a tax document."""

    download_url: str
    document_id: uuid.UUID
    document_type: str
    tax_year: int
    expires_in_seconds: int


VALID_DOCUMENT_TYPES = {"1099-NEC", "1099-MISC", "annual_summary"}
VALID_STATUSES = {"draft", "published", "superseded"}


def _build_response(doc: TaxDocument) -> TaxDocumentResponse:
    return TaxDocumentResponse(
        id=doc.id,
        partner_id=doc.partner_id,
        tax_year=doc.tax_year,
        document_type=doc.document_type,
        status=doc.status,
        file_path=doc.file_path,
        notes=doc.notes,
        generated_at=doc.generated_at,
        generated_by=doc.generated_by,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Internal endpoints (finance / internal staff)
# ─────────────────────────────────────────────────────────────────────────────


@router.get(
    "/",
    response_model=TaxDocumentListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_all_tax_documents(
    db: DB,
    partner_id: uuid.UUID | None = Query(None),
    tax_year: int | None = Query(None),
    document_type: str | None = Query(None),
    doc_status: str | None = Query(None, alias="status"),
) -> TaxDocumentListResponse:
    """List all tax documents with optional filters (internal staff)."""
    q = select(TaxDocument)
    if partner_id:
        q = q.where(TaxDocument.partner_id == partner_id)
    if tax_year:
        q = q.where(TaxDocument.tax_year == tax_year)
    if document_type:
        q = q.where(TaxDocument.document_type == document_type)
    if doc_status:
        q = q.where(TaxDocument.status == doc_status)
    q = q.order_by(TaxDocument.tax_year.desc(), TaxDocument.created_at.desc())

    result = await db.execute(q)
    docs = result.scalars().all()
    return TaxDocumentListResponse(documents=[_build_response(d) for d in docs], total=len(docs))


@router.post(
    "/",
    response_model=TaxDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal)],
)
async def create_tax_document(
    payload: TaxDocumentCreate,
    db: DB,
    current_user: CurrentUser,
) -> TaxDocumentResponse:
    """Create a new tax document record (no file yet — upload separately)."""
    if payload.document_type not in VALID_DOCUMENT_TYPES:
        raise BadRequestException(
            f"document_type must be one of {sorted(VALID_DOCUMENT_TYPES)}"
        )

    # Verify partner exists
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == payload.partner_id)
    )
    if not partner_result.scalar_one_or_none():
        raise NotFoundException("Partner not found")

    doc = TaxDocument(
        partner_id=payload.partner_id,
        tax_year=payload.tax_year,
        document_type=payload.document_type,
        notes=payload.notes,
        status="draft",
        generated_by=current_user.id,
        generated_at=datetime.now(UTC),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return _build_response(doc)


@router.post(
    "/{document_id}/upload",
    response_model=TaxDocumentResponse,
    dependencies=[Depends(require_internal)],
)
async def upload_tax_document_file(
    document_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> TaxDocumentResponse:
    """Upload (or replace) the PDF file for a tax document."""
    result = await db.execute(select(TaxDocument).where(TaxDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Tax document not found")

    # Only allow PDF uploads for tax documents
    if file.content_type not in {"application/pdf"}:
        raise BadRequestException("Only PDF files are accepted for tax documents")

    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise BadRequestException("File size exceeds 20 MB limit")
    await file.seek(0)

    object_path, _ = await storage_service.upload_file_scoped(
        file,
        "partner",
        str(doc.partner_id),
        subfolder=f"tax/{doc.tax_year}",
    )

    doc.file_path = object_path
    doc.generated_at = datetime.now(UTC)
    doc.generated_by = current_user.id
    await db.commit()
    await db.refresh(doc)
    return _build_response(doc)


@router.patch(
    "/{document_id}/status",
    response_model=TaxDocumentResponse,
    dependencies=[Depends(require_internal)],
)
async def update_tax_document_status(
    document_id: uuid.UUID,
    payload: TaxDocumentStatusUpdate,
    db: DB,
) -> TaxDocumentResponse:
    """Publish, supersede, or move a tax document back to draft."""
    if payload.status not in VALID_STATUSES:
        raise BadRequestException(f"status must be one of {sorted(VALID_STATUSES)}")

    result = await db.execute(select(TaxDocument).where(TaxDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Tax document not found")

    if payload.status == "published" and not doc.file_path:
        raise BadRequestException("Cannot publish a tax document without an uploaded file")

    doc.status = payload.status
    if payload.notes is not None:
        doc.notes = payload.notes
    await db.commit()
    await db.refresh(doc)
    return _build_response(doc)


@router.get(
    "/{document_id}",
    response_model=TaxDocumentResponse,
    dependencies=[Depends(require_internal)],
)
async def get_tax_document(
    document_id: uuid.UUID,
    db: DB,
) -> TaxDocumentResponse:
    """Get a single tax document by ID (internal)."""
    result = await db.execute(select(TaxDocument).where(TaxDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Tax document not found")
    return _build_response(doc)


# ─────────────────────────────────────────────────────────────────────────────
# Partner-portal endpoints (authenticated partner, own documents only)
# ─────────────────────────────────────────────────────────────────────────────


@router.get(
    "/my",
    response_model=TaxDocumentListResponse,
)
async def get_my_tax_documents(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    tax_year: int | None = Query(None),
) -> TaxDocumentListResponse:
    """List published tax documents available to the authenticated partner."""
    q = (
        select(TaxDocument)
        .where(TaxDocument.partner_id == partner.id)
        .where(TaxDocument.status == "published")
    )
    if tax_year:
        q = q.where(TaxDocument.tax_year == tax_year)
    q = q.order_by(TaxDocument.tax_year.desc(), TaxDocument.document_type)

    result = await db.execute(q)
    docs = result.scalars().all()
    return TaxDocumentListResponse(documents=[_build_response(d) for d in docs], total=len(docs))


@router.get(
    "/my/{document_id}/download",
    response_model=TaxDocumentDownloadResponse,
)
async def download_my_tax_document(
    document_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    request: Request,
) -> TaxDocumentDownloadResponse:
    """Get a presigned download URL for a tax document. Access is audit-logged."""
    result = await db.execute(
        select(TaxDocument).where(
            TaxDocument.id == document_id,
            TaxDocument.partner_id == partner.id,
            TaxDocument.status == "published",
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Tax document not found")
    if not doc.file_path:
        raise BadRequestException("Tax document file is not yet available")

    # Generate presigned download URL (1-hour expiry)
    from datetime import timedelta

    download_url = storage_service.get_presigned_url(doc.file_path, expires=timedelta(hours=1))

    # Write immutable access log
    from app.core.ip_utils import get_client_ip

    ip_address = get_client_ip(request)
    user_agent = request.headers.get("User-Agent")
    access_log = TaxDocumentAccessLog(
        tax_document_id=doc.id,
        accessed_by=current_user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        accessed_at=datetime.now(UTC),
    )
    db.add(access_log)
    await db.commit()

    return TaxDocumentDownloadResponse(
        download_url=download_url,
        document_id=doc.id,
        document_type=doc.document_type,
        tax_year=doc.tax_year,
        expires_in_seconds=3600,
    )
