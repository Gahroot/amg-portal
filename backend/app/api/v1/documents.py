"""Document management endpoints."""

import contextlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import bcrypt
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    DB,
    CurrentUser,
    Pagination,
    RLSContext,
    require_client,
    require_compliance,
    require_coordinator_or_above,
    require_internal,
)
from app.core.config import settings
from app.core.exceptions import BadRequestException, GoneException, NotFoundException
from app.models.document import Document
from app.models.document_share import DocumentShare
from app.schemas.document import (
    DocumentCompareResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentVersionListResponse,
    DocumentVersionResponse,
    ExpiringDocumentsResponse,
)
from app.schemas.document_delivery import (
    CustodyChainResponse,
    DocumentDeliverRequest,
    DocumentDeliveryListResponse,
    DocumentDeliveryResponse,
    SealDocumentRequest,
    SecureLinkRequest,
    SecureLinkResponse,
    VaultDocumentListResponse,
    VaultDocumentResponse,
)
from app.schemas.document_share import (
    DocumentShareAccessResponse,
    DocumentShareCreate,
    DocumentShareListResponse,
    DocumentShareResponse,
    DocumentShareVerifyRequest,
)
from app.services import document_diff_service, document_expiry_service, document_vault_service
from app.services.crud_base import paginate
from app.services.email_service import send_email
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _compute_expiry_status(doc: Document) -> str | None:
    """Return expiry bucket string or None if document has no expiry date."""
    if doc.expiry_date is None:
        return None
    from datetime import date as _date

    from app.services.document_expiry_service import compute_expiry_status
    expiry: _date = doc.expiry_date
    return compute_expiry_status(expiry).value


def build_document_response(doc: Document) -> DocumentResponse:
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
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
        "vault_status": doc.vault_status,
        "download_url": None,
        "document_type": doc.document_type,
        "expiry_date": doc.expiry_date,
        "expiry_status": _compute_expiry_status(doc),
    }
    if doc.file_path:
        with contextlib.suppress(Exception):
            data["download_url"] = storage_service.get_presigned_url(str(doc.file_path))
    return DocumentResponse.model_validate(data)


def build_version_response(doc: Document) -> DocumentVersionResponse:
    data: dict[str, object] = {
        "id": doc.id,
        "version": doc.version,
        "uploaded_by": doc.uploaded_by,
        "created_at": doc.created_at,
        "file_size": doc.file_size,
        "download_url": None,
    }
    if doc.file_path:
        with contextlib.suppress(Exception):
            data["download_url"] = storage_service.get_presigned_url(str(doc.file_path))
    return DocumentVersionResponse.model_validate(data)


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


# ── Upload & list (no path-param prefix) ─────────────────────────────────────


@router.post("/", response_model=DocumentResponse, status_code=201)
async def upload_document(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    entity_id: UUID = Form(...),
    category: str = Form("general"),
    description: str | None = Form(None),
) -> DocumentResponse:
    await storage_service.validate_file(file)

    file_name = file.filename or "untitled"

    # Determine next version number for this file name + entity combination
    existing_version_result = await db.execute(
        select(func.max(Document.version)).where(
            Document.entity_type == entity_type,
            Document.entity_id == entity_id,
            Document.file_name == file_name,
        )
    )
    max_version: int = existing_version_result.scalar() or 0
    next_version = max_version + 1

    object_path, file_size = await storage_service.upload_file_scoped(
        file,
        entity_type,
        str(entity_id),
    )

    doc = Document(
        file_path=object_path,
        file_name=file_name,
        file_size=file_size,
        content_type=file.content_type,
        entity_type=entity_type,
        entity_id=entity_id,
        category=category,
        description=description,
        version=next_version,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return build_document_response(doc)


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    db: DB,
    current_user: CurrentUser,
    pagination: Pagination,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    category: str | None = None,
) -> DocumentListResponse:
    filters = []
    if entity_type:
        filters.append(Document.entity_type == entity_type)
    if entity_id:
        filters.append(Document.entity_id == entity_id)
    if category:
        filters.append(Document.category == category)

    # Subquery: latest version per (entity_type, entity_id, file_name)
    latest_select = select(
        Document.entity_type,
        Document.entity_id,
        Document.file_name,
        func.max(Document.version).label("max_version"),
    ).group_by(Document.entity_type, Document.entity_id, Document.file_name)
    for f in filters:
        latest_select = latest_select.where(f)
    latest_subq = latest_select.subquery()

    join_condition = (
        (Document.entity_type == latest_subq.c.entity_type)
        & (Document.entity_id == latest_subq.c.entity_id)
        & (Document.file_name == latest_subq.c.file_name)
        & (Document.version == latest_subq.c.max_version)
    )

    query = (
        select(Document)
        .join(latest_subq, join_condition)
        .order_by(Document.created_at.desc())
    )
    documents, total = await paginate(db, query, skip=pagination.skip, limit=pagination.limit)

    return DocumentListResponse(
        documents=[build_document_response(d) for d in documents],
        total=total,
    )


# ── Bulk upload (static — must come before {document_id}) ────────────────────


@router.post("/bulk", response_model=DocumentListResponse, status_code=201)
async def bulk_upload_documents(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    files: list[UploadFile] = File(...),
    entity_type: str = Form(...),
    entity_id: UUID = Form(...),
    category: str = Form("general"),
    description: str | None = Form(None),
) -> DocumentListResponse:
    """Upload multiple documents at once."""
    docs = await document_vault_service.bulk_upload_documents(
        db, files, entity_type, entity_id, category, description, current_user.id
    )
    return DocumentListResponse(
        documents=[build_document_response(d) for d in docs],
        total=len(docs),
    )


# ── Expiring documents (static — must come before {document_id}) ─────────────


@router.get("/expiring", response_model=ExpiringDocumentsResponse)
async def list_expiring_documents(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    pagination: Pagination,
    _: None = Depends(require_internal),
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    status: str | None = Query(None, description="Filter: expired, expiring_30, expiring_90"),
) -> ExpiringDocumentsResponse:
    """List documents with expiry dates within the next 90 days or already expired."""
    return await document_expiry_service.list_expiring_documents(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        status_filter=status,
        skip=pagination.skip,
        limit=pagination.limit,
    )


# ── Vault & secure-link (static path segments — must come before {document_id}) ──


@router.get("/vault", response_model=VaultDocumentListResponse)
async def list_vault_documents(
    db: DB,
    current_user: CurrentUser,
    pagination: Pagination,
    _rls: RLSContext,
    _: None = Depends(require_compliance),
    vault_status: str | None = None,
) -> VaultDocumentListResponse:
    """List documents in the evidence vault (sealed/archived)."""
    docs, total = await document_vault_service.get_vault_documents(
        db, vault_status, pagination.skip, pagination.limit
    )
    return VaultDocumentListResponse(
        documents=[_build_vault_response(d) for d in docs],
        total=total,
    )


@router.get("/secure/{token}")
async def download_via_secure_link(
    token: str,
    db: DB,
) -> dict[str, str]:
    """Download a document via secure link token (no auth required)."""
    try:
        doc, _delivery = await document_vault_service.resolve_secure_link(db, token)
    except ValueError as e:
        raise NotFoundException(str(e)) from e
    url = storage_service.get_presigned_url(str(doc.file_path))
    return {"download_url": url}


# ── Compare endpoint (static — must come before {document_id}) ───────────────


@router.get("/compare", response_model=DocumentCompareResponse)
async def compare_document_versions(
    version_a_id: UUID,
    version_b_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> DocumentCompareResponse:
    """Compare two document versions and return their diff."""
    try:
        return await document_diff_service.compare_document_versions(db, version_a_id, version_b_id)
    except ValueError as e:
        raise BadRequestException(str(e)) from e


# ── Per-document endpoints (with {document_id} path param) ───────────────────


@router.get("/{document_id}/versions", response_model=DocumentVersionListResponse)
async def get_document_versions(
    document_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> DocumentVersionListResponse:
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Document not found")

    versions_result = await db.execute(
        select(Document)
        .where(
            Document.entity_type == doc.entity_type,
            Document.entity_id == doc.entity_id,
            Document.file_name == doc.file_name,
        )
        .order_by(Document.version.desc())
    )
    versions = list(versions_result.scalars().all())

    return DocumentVersionListResponse(
        versions=[build_version_response(v) for v in versions],
        total=len(versions),
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> DocumentResponse:
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Document not found")
    return build_document_response(doc)


@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> dict[str, str]:
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Document not found")

    url = storage_service.get_presigned_url(str(doc.file_path))
    return {"download_url": url}


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
) -> None:
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Document not found")

    with contextlib.suppress(Exception):
        await storage_service.delete_file(str(doc.file_path))

    await db.delete(doc)
    await db.commit()


# ── Delivery & vault action endpoints ────────────────────────────────────────


@router.post("/{document_id}/deliver", response_model=DocumentDeliveryListResponse, status_code=201)
async def deliver_document(
    document_id: UUID,
    body: DocumentDeliverRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> DocumentDeliveryListResponse:
    """Deliver a document to one or more recipients."""
    try:
        deliveries = await document_vault_service.deliver_document(
            db,
            document_id,
            body.recipient_ids,
            body.delivery_method,
            body.notes,
            delivered_by=current_user.id,
        )
    except ValueError as e:
        raise NotFoundException(str(e)) from e
    return DocumentDeliveryListResponse(
        deliveries=[DocumentDeliveryResponse.model_validate(d) for d in deliveries],
        total=len(deliveries),
    )


@router.post("/{document_id}/secure-link", response_model=SecureLinkResponse, status_code=201)
async def create_secure_link(
    document_id: UUID,
    body: SecureLinkRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> SecureLinkResponse:
    """Generate a time-limited secure download link."""
    try:
        delivery = await document_vault_service.generate_secure_link(
            db,
            document_id,
            body.recipient_id,
            body.expires_hours,
            issued_by=current_user.id,
        )
    except ValueError as e:
        raise NotFoundException(str(e)) from e
    download_url = f"/api/v1/documents/secure/{delivery.secure_link_token}"
    return SecureLinkResponse(
        token=str(delivery.secure_link_token),
        download_url=download_url,
        expires_at=delivery.secure_link_expires_at,  # type: ignore[arg-type]
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


@router.get("/{document_id}/deliveries", response_model=DocumentDeliveryListResponse)
async def get_deliveries(
    document_id: UUID,
    db: DB,
    current_user: CurrentUser,
    pagination: Pagination,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> DocumentDeliveryListResponse:
    """Get delivery records for a document."""
    deliveries, total = await document_vault_service.get_document_deliveries(
        db, document_id, pagination.skip, pagination.limit
    )
    return DocumentDeliveryListResponse(
        deliveries=[DocumentDeliveryResponse.model_validate(d) for d in deliveries],
        total=total,
    )


# ── Document Sharing (client-facing) ─────────────────────────────────────────

_OTP_EXPIRE_MINUTES = 15
_OTP_DIGITS = 6


def _generate_otp() -> str:
    """Generate a random 6-digit numeric OTP."""
    return str(secrets.randbelow(10**_OTP_DIGITS)).zfill(_OTP_DIGITS)


def _hash_code(code: str) -> str:
    return bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode()


def _verify_code(code: str, hashed: str) -> bool:
    return bcrypt.checkpw(code.encode(), hashed.encode())


def _share_access_url(token: str) -> str:
    return f"{settings.FRONTEND_URL}/portal/documents/shared/{token}"


async def _resolve_share(token: str, db: AsyncSession) -> DocumentShare:
    """Fetch a share by token and validate it is active and not expired.

    Raises NotFoundException if not found, GoneException if revoked or expired.
    """
    result = await db.execute(select(DocumentShare).where(DocumentShare.share_token == token))
    share = result.scalar_one_or_none()
    if not share:
        raise NotFoundException("Share not found")
    if not share.is_active:
        raise GoneException("This share has been revoked")
    if share.expires_at and share.expires_at < datetime.now(UTC):
        raise GoneException("This share link has expired")
    return share


@router.post(
    "/{document_id}/shares",
    response_model=DocumentShareResponse,
    status_code=201,
)
async def create_document_share(
    document_id: UUID,
    body: DocumentShareCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_client),
) -> DocumentShareResponse:
    """Share a document with an external recipient via a secure, time-limited email link.

    Accessible by client users only. Creates a share record, generates an OTP,
    and emails the recipient with the access link.
    """
    # Verify document exists
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Document not found")

    # Validate access_level
    if body.access_level not in ("view", "download"):
        raise BadRequestException("access_level must be 'view' or 'download'")

    if body.expires_hours < 1 or body.expires_hours > 720:
        raise BadRequestException("expires_hours must be between 1 and 720")

    now = datetime.now(UTC)
    expires_at = now + timedelta(hours=body.expires_hours)
    otp = _generate_otp()
    otp_hash = _hash_code(otp)
    otp_expires_at = now + timedelta(minutes=_OTP_EXPIRE_MINUTES)

    share = DocumentShare(
        document_id=document_id,
        shared_by=current_user.id,
        shared_with_email=str(body.shared_with_email),
        access_level=body.access_level,
        share_token=secrets.token_urlsafe(32),
        verification_code_hash=otp_hash,
        verification_code_expires_at=otp_expires_at,
        expires_at=expires_at,
        access_count=0,
        is_active=True,
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)

    # Send notification email
    access_url = _share_access_url(share.share_token)
    sharer_name = current_user.full_name or "A client"
    subject = f"Document shared with you: {doc.file_name}"
    body_html = f"""
    <p>Hello,</p>
    <p><strong>{sharer_name}</strong> has shared a document with you:</p>
    <p><strong>{doc.file_name}</strong></p>
    <p>To access this document, click the link below and enter your verification code:</p>
    <p><a href="{access_url}">Access Document</a></p>
    <p>Your one-time verification code is: <strong>{otp}</strong></p>
    <p>This code expires in {_OTP_EXPIRE_MINUTES} minutes. The document access link expires on
    {expires_at.strftime('%B %d, %Y at %H:%M UTC')}.</p>
    <p>If you did not expect this, you can safely ignore this email.</p>
    """
    try:
        await send_email(
            to=str(body.shared_with_email),
            subject=subject,
            body_html=body_html,
        )
    except Exception:
        logger.warning("Failed to send share notification email to %s", body.shared_with_email)

    return DocumentShareResponse.model_validate(share)


@router.get(
    "/{document_id}/shares",
    response_model=DocumentShareListResponse,
)
async def list_document_shares(
    document_id: UUID,
    db: DB,
    current_user: CurrentUser,
    pagination: Pagination,
    _: None = Depends(require_client),
) -> DocumentShareListResponse:
    """List all active shares for a document. Client users see only shares they created."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Document not found")

    query = (
        select(DocumentShare)
        .where(
            DocumentShare.document_id == document_id,
            DocumentShare.shared_by == current_user.id,
        )
        .order_by(DocumentShare.created_at.desc())
    )
    shares, total = await paginate(db, query, skip=pagination.skip, limit=pagination.limit)

    return DocumentShareListResponse(
        shares=[DocumentShareResponse.model_validate(s) for s in shares],
        total=total,
    )


@router.delete("/shares/{share_id}", status_code=204)
async def revoke_document_share(
    share_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_client),
) -> None:
    """Revoke a document share. Only the share creator can revoke it."""
    result = await db.execute(
        select(DocumentShare).where(
            DocumentShare.id == share_id,
            DocumentShare.shared_by == current_user.id,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise NotFoundException("Share not found")

    now = datetime.now(UTC)
    share.is_active = False
    share.revoked_at = now
    share.revoked_by = current_user.id
    await db.commit()


# ── Public document-share access (no auth required) ──────────────────────────


@router.post("/shared/{token}/request-code", status_code=200)
async def request_share_verification_code(
    token: str,
    db: DB,
) -> dict[str, str]:
    """Resend a fresh OTP to the recipient's email address.

    Anyone with the share token can trigger a new code to be sent to the
    originally registered email address. The previous code is invalidated.
    """
    share = await _resolve_share(token, db)
    now = datetime.now(UTC)

    # Generate new OTP
    otp = _generate_otp()
    otp_hash = _hash_code(otp)
    otp_expires_at = now + timedelta(minutes=_OTP_EXPIRE_MINUTES)
    share.verification_code_hash = otp_hash
    share.verification_code_expires_at = otp_expires_at
    await db.commit()

    # Fetch the document for the email
    doc_result = await db.execute(
        select(Document).where(Document.id == share.document_id)
    )
    doc = doc_result.scalar_one_or_none()
    file_name = doc.file_name if doc else "Document"

    subject = f"Your verification code for: {file_name}"
    body_html = f"""
    <p>Hello,</p>
    <p>Your new one-time verification code to access <strong>{file_name}</strong> is:</p>
    <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">{otp}</p>
    <p>This code expires in {_OTP_EXPIRE_MINUTES} minutes.</p>
    """
    try:
        await send_email(
            to=share.shared_with_email,
            subject=subject,
            body_html=body_html,
        )
    except Exception:
        logger.warning("Failed to resend OTP to %s", share.shared_with_email)

    return {"message": f"Verification code sent to {share.shared_with_email}"}


@router.post(
    "/shared/{token}/access",
    response_model=DocumentShareAccessResponse,
)
async def access_shared_document(
    token: str,
    body: DocumentShareVerifyRequest,
    db: DB,
) -> DocumentShareAccessResponse:
    """Verify OTP and return a presigned view URL for the shared document.

    Public endpoint — no authentication required. Verifying the OTP
    constitutes the access control check. Access is logged.
    """
    share = await _resolve_share(token, db)
    now = datetime.now(UTC)

    if not share.verification_code_hash:
        raise BadRequestException("No verification code issued. Request a new code.")

    if share.verification_code_expires_at and share.verification_code_expires_at < now:
        raise BadRequestException("Verification code has expired. Please request a new code.")

    if not _verify_code(body.verification_code, share.verification_code_hash):
        raise BadRequestException("Invalid verification code")

    # Fetch document
    doc_result = await db.execute(
        select(Document).where(Document.id == share.document_id)
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Document not found")

    # Generate presigned URL (view-only; the caller cannot get a download URL separately)
    try:
        view_url = storage_service.get_presigned_url(str(doc.file_path))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Could not generate view URL") from exc

    # Log access: increment counter and invalidate used OTP
    share.access_count = share.access_count + 1
    share.verification_code_hash = None
    share.verification_code_expires_at = None
    await db.commit()

    return DocumentShareAccessResponse(
        share_id=share.id,
        document_id=share.document_id,
        file_name=str(doc.file_name),
        view_url=view_url,
        access_level=share.access_level,
        expires_at=share.expires_at,
    )


@router.get("/shared/{token}/info")
async def get_shared_document_info(
    token: str,
    db: DB,
) -> dict[str, object]:
    """Return basic info about a share (document name, expiry) without authentication.

    Used by the frontend to render the share access page before the OTP is entered.
    """
    share = await _resolve_share(token, db)

    doc_result = await db.execute(
        select(Document).where(Document.id == share.document_id)
    )
    doc = doc_result.scalar_one_or_none()

    return {
        "share_id": str(share.id),
        "document_id": str(share.document_id),
        "file_name": str(doc.file_name) if doc else "Document",
        "shared_with_email": share.shared_with_email,
        "access_level": share.access_level,
        "expires_at": share.expires_at.isoformat() if share.expires_at else None,
    }
