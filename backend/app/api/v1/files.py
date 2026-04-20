"""Secure file vault routes (Phase 2.1 + 2.3 + 2.4 + 2.5).

Upload flow:
    1.  validate size + MIME + magic bytes  (storage.StorageService.validate_file)
    2.  ClamAV INSTREAM scan of plaintext   (services.clamav.enforce_clean)
    3.  AES-256-GCM envelope encryption      (core.file_crypto.encrypt_bytes)
    4.  MinIO put_object with Object Lock    (storage.upload_encrypted_bytes)
    5.  Document row with envelope metadata + clam_result + retention

Download flow:
    * Small files (<= DOWNLOAD_PROXY_THRESHOLD_BYTES): proxy-through decrypt
    * Large files: issue a one-time redemption token; client redeems for
      a 60-120 s presigned URL.  The underlying object is still ciphertext —
      clients that want plaintext must hit the proxy route.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, require_step_up
from app.core.config import settings
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.document import Document
from app.models.download_token import DownloadToken
from app.models.enums import AuditAction, DocumentCategory, DocumentEntityType, UserRole
from app.services.audit_service import log_action
from app.services.clamav import enforce_clean
from app.services.storage import DocumentRetention, storage_service

router = APIRouter()


# ── Helpers ─────────────────────────────────────────────────


_STEP_UP_CATEGORIES = {
    DocumentCategory.compliance,
    DocumentCategory.contract,
}
_OBJECT_LOCK_CATEGORIES = {
    DocumentCategory.compliance,
    DocumentCategory.contract,
}

_INTERNAL_ROLES = {
    UserRole.managing_director.value,
    UserRole.relationship_manager.value,
    UserRole.coordinator.value,
    UserRole.finance_compliance.value,
}


def _retention_for_category(category: DocumentCategory) -> DocumentRetention | None:
    now = datetime.now(UTC)
    if category == DocumentCategory.compliance:
        return DocumentRetention(
            retain_until_date=now + timedelta(days=365 * settings.OBJECT_LOCK_KYC_YEARS)
        )
    if category == DocumentCategory.contract:
        return DocumentRetention(
            retain_until_date=now + timedelta(days=365 * settings.OBJECT_LOCK_CONTRACT_YEARS)
        )
    return None


async def _authorise_download(current_user: Any, document: Document) -> None:
    if document.crypto_shredded:
        raise NotFoundException("Document unavailable")
    if document.uploaded_by == current_user.id:
        return
    if current_user.role in _INTERNAL_ROLES:
        return
    raise ForbiddenException("Not authorised to access this document")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _safe_filename(name: str) -> str:
    """Strip CR/LF + quotes so the header never splits (RFC 6266 paranoia)."""
    return name.replace("\r", "").replace("\n", "").replace('"', "")


async def _stream_generator(
    object_name: str, *, file_uuid: uuid.UUID, subject_id: uuid.UUID
) -> AsyncIterator[bytes]:
    ciphertext = await storage_service.fetch_ciphertext(object_name)
    for chunk in storage_service.iter_decrypted_chunks(
        ciphertext, file_uuid=file_uuid, subject_id=subject_id
    ):
        yield chunk


# ── 2.1 + 2.3 — secure upload ───────────────────────────────


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def secure_upload(
    current_user: CurrentUser,
    db: DB,
    file: Annotated[UploadFile, File(...)],
    entity_type: Annotated[DocumentEntityType, Form(...)],
    entity_id: Annotated[uuid.UUID, Form(...)],
    category: Annotated[DocumentCategory, Form(DocumentCategory.general)],
    description: Annotated[str | None, Form()] = None,
    subject_id: Annotated[uuid.UUID | None, Form()] = None,
) -> dict[str, Any]:
    """Validate → ClamAV scan → envelope-encrypt → MinIO put + Object Lock."""
    await storage_service.validate_file(file)
    await file.seek(0)
    plaintext = await file.read()

    scan = await enforce_clean(plaintext)

    effective_subject = subject_id or entity_id

    file_uuid = uuid.uuid4()
    ext = ""
    if file.filename and "." in file.filename:
        ext = "." + file.filename.rsplit(".", 1)[1]
    object_name = f"vault/{entity_type.value}/{entity_id}/{file_uuid}{ext}.enc"

    retention = (
        _retention_for_category(category) if category in _OBJECT_LOCK_CATEGORIES else None
    )
    meta = await storage_service.upload_encrypted_bytes(
        object_name,
        plaintext,
        file_uuid=file_uuid,
        subject_id=effective_subject,
        content_type=file.content_type,
        retention=retention,
    )

    doc = Document(
        id=file_uuid,
        file_path=object_name,
        file_name=file.filename or f"{file_uuid}{ext}",
        file_size=len(plaintext),
        content_type=file.content_type,
        entity_type=entity_type.value,
        entity_id=entity_id,
        category=category.value,
        description=description,
        uploaded_by=current_user.id,
        kek_version=meta.kek_version,
        nonce_prefix=meta.nonce_prefix,
        sha256=meta.sha256_plaintext,
        clam_result=scan.as_column(),
        subject_id=effective_subject,
        object_lock_mode="COMPLIANCE" if retention else None,
        object_lock_retain_until=retention.retain_until_date if retention else None,
    )
    db.add(doc)
    await db.flush()
    await log_action(
        db,
        action=AuditAction.document_upload,
        entity_type="documents",
        entity_id=str(doc.id),
        user=current_user,
        after_state={
            "file_name": doc.file_name,
            "file_size": doc.file_size,
            "sha256": doc.sha256,
            "category": doc.category,
            "clam_result": doc.clam_result,
            "object_lock_mode": doc.object_lock_mode,
        },
    )
    await db.commit()
    await db.refresh(doc)

    return {
        "id": str(doc.id),
        "file_name": doc.file_name,
        "file_size": doc.file_size,
        "category": doc.category,
        "sha256": doc.sha256,
        "clam_result": doc.clam_result,
        "object_lock_mode": doc.object_lock_mode,
        "object_lock_retain_until": (
            doc.object_lock_retain_until.isoformat()
            if doc.object_lock_retain_until
            else None
        ),
    }


# ── 2.4 — proxy-through download ────────────────────────────


async def _audit_and_stream(
    db: Any,
    current_user: Any,
    doc: Document,
    *,
    action: AuditAction,
) -> StreamingResponse:
    await log_action(
        db,
        action=action,
        entity_type="documents",
        entity_id=str(doc.id),
        user=current_user,
        after_state={
            "file_name": doc.file_name,
            "sha256": doc.sha256,
            "via": "proxy",
        },
    )
    await db.commit()
    return StreamingResponse(
        _stream_generator(
            doc.file_path,
            file_uuid=doc.id,
            subject_id=doc.subject_id or doc.entity_id,
        ),
        media_type=doc.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{_safe_filename(doc.file_name)}"'
            ),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{document_id}/stream")
async def proxy_download(
    document_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> StreamingResponse:
    """Stream the decrypted plaintext through FastAPI to the client.

    For sensitive categories (compliance/contract), this route returns 401
    with ``WWW-Authenticate: insufficient_user_authentication``; callers
    must retry against ``/stream-gated`` after obtaining a step-up token.
    """
    doc = (
        await db.execute(select(Document).where(Document.id == document_id))
    ).scalar_one_or_none()
    if doc is None:
        raise NotFoundException("Document not found")
    if doc.kek_version is None:
        raise BadRequestException(
            "Document is not envelope-encrypted; use the legacy /documents route"
        )
    await _authorise_download(current_user, doc)
    if doc.category in {c.value for c in _STEP_UP_CATEGORIES}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "step_up_required",
                "action": "file_read_sensitive",
                "message": "Sensitive category requires step-up; use /stream-gated",
            },
            headers={
                "WWW-Authenticate": (
                    'Bearer error="insufficient_user_authentication", '
                    'action_scope="file_read_sensitive"'
                )
            },
        )
    return await _audit_and_stream(db, current_user, doc, action=AuditAction.document_stream)


@router.get(
    "/{document_id}/stream-gated",
    dependencies=[Depends(require_step_up("file_read_sensitive"))],
)
async def proxy_download_gated(
    document_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> StreamingResponse:
    """Same as /stream but requires a valid X-Step-Up-Token."""
    doc = (
        await db.execute(select(Document).where(Document.id == document_id))
    ).scalar_one_or_none()
    if doc is None:
        raise NotFoundException("Document not found")
    if doc.kek_version is None:
        raise BadRequestException("Document is not envelope-encrypted")
    await _authorise_download(current_user, doc)
    return await _audit_and_stream(
        db, current_user, doc, action=AuditAction.document_stream_stepup
    )


# ── 2.5 — one-time-redemption token for large files ─────────


@router.post("/{document_id}/issue-download-token")
async def issue_download_token(
    document_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> dict[str, Any]:
    """Issue a single-use redemption token for a large encrypted file."""
    doc = (
        await db.execute(select(Document).where(Document.id == document_id))
    ).scalar_one_or_none()
    if doc is None:
        raise NotFoundException("Document not found")
    await _authorise_download(current_user, doc)
    if doc.file_size <= settings.DOWNLOAD_PROXY_THRESHOLD_BYTES:
        raise BadRequestException(
            "File is small enough for direct proxy download; use /stream."
        )

    raw = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw)
    now = datetime.now(UTC)
    expires = now + timedelta(seconds=settings.DOWNLOAD_TOKEN_TTL_SECONDS)
    db.add(
        DownloadToken(
            token_hash=token_hash,
            document_id=doc.id,
            issued_to=current_user.id,
            issued_at=now,
            expires_at=expires,
        )
    )
    await db.commit()
    return {
        "token": raw,
        "redeem_url": f"/api/v1/files/download/{raw}",
        "expires_at": expires.isoformat(),
    }


@router.get("/download/{token}")
async def redeem_download_token(
    token: str,
    current_user: CurrentUser,
    db: DB,
) -> dict[str, Any]:
    """Single-use redemption: returns a 60-120s presigned URL and invalidates."""
    token_hash = _hash_token(token)
    row = (
        await db.execute(
            select(DownloadToken).where(DownloadToken.token_hash == token_hash)
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundException("Token not found")
    if row.redeemed_at is not None:
        raise ForbiddenException("Token already redeemed")
    now = datetime.now(UTC)
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < now:
        raise ForbiddenException("Token expired")
    if row.issued_to != current_user.id:
        raise ForbiddenException("Token not issued to this user")

    doc = (
        await db.execute(select(Document).where(Document.id == row.document_id))
    ).scalar_one_or_none()
    if doc is None:
        raise NotFoundException("Document deleted")

    row.redeemed_at = now
    await log_action(
        db,
        action=AuditAction.document_download_redeemed,
        entity_type="documents",
        entity_id=str(doc.id),
        user=current_user,
        after_state={"token_hash": token_hash[:16], "via": "presigned"},
    )
    url = storage_service.get_presigned_url(
        doc.file_path,
        expires=timedelta(seconds=settings.DOWNLOAD_TOKEN_TTL_SECONDS),
    )
    await db.commit()
    return {"url": url, "expires_in": settings.DOWNLOAD_TOKEN_TTL_SECONDS}
