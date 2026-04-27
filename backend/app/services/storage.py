import asyncio
import logging
import uuid
from collections.abc import Iterator
from datetime import datetime, timedelta
from io import BytesIO

import filetype
from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from minio import Minio
from minio.commonconfig import COMPLIANCE
from minio.retention import Retention
from minio.sseconfig import Rule, SSEConfig
from minio.versioningconfig import VersioningConfig

from app.core.config import settings
from app.core.exceptions import BadRequestException
from app.core.file_crypto import EnvelopeMetadata, decrypt_stream, encrypt_bytes

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
}

ALLOWED_AUDIO_MIME_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "video/webm",  # Chrome records as video/webm even for audio-only
}

MAX_AUDIO_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# Maps a declared MIME type to the set of MIME types that filetype.guess() may
# legitimately return for that content.  Types absent from this map either have
# no detectable magic bytes (plain text, CSV) or use a legacy container that
# filetype does not recognise (OLE2 .doc/.xls/.ppt), so they are validated by
# Content-Type header alone.  All other types MUST have matching magic bytes.
_MAGIC_MIME_ALLOWLIST: dict[str, set[str]] = {
    # Documents
    "application/pdf": {"application/pdf"},
    # OOXML formats share the ZIP container — filetype returns application/zip
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {"application/zip"},
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {"application/zip"},
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
        "application/zip"
    },
    # Images
    "image/jpeg": {"image/jpeg"},
    "image/png": {"image/png"},
    "image/gif": {"image/gif"},
    "image/webp": {"image/webp"},
    # Audio / video
    "audio/ogg": {"audio/ogg"},
    "audio/mp4": {"audio/mp4"},
    # WAV variants all share the RIFF/WAVE magic — filetype returns audio/x-wav
    "audio/wav": {"audio/x-wav"},
    "audio/x-wav": {"audio/x-wav"},
    "audio/wave": {"audio/x-wav"},
    # WebM: filetype detects video/webm for both audio-only and video WebM files
    "audio/webm": {"video/webm"},
    "video/webm": {"video/webm"},
    # audio/mpeg (MP3): ID3-tagged files are detectable; raw MPEG frames are not.
    # Only enforce when a signature is present; skip if filetype returns None.
    "audio/mpeg": {"audio/mpeg"},
}

# MIME types that have no reliable magic-byte signature; skip magic check.
_MAGIC_UNDETECTABLE: frozenset[str] = frozenset(
    {
        "text/plain",
        "text/csv",
        # Legacy OLE2 compound-document formats (.doc, .xls, .ppt)
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
    }
)


def _verify_magic_bytes(declared_mime: str, contents: bytes) -> None:
    """Raise BadRequestException if the file's magic bytes contradict the declared MIME type.

    For types without reliable magic signatures the check is skipped.
    """
    if declared_mime in _MAGIC_UNDETECTABLE:
        return

    allowed_magic = _MAGIC_MIME_ALLOWLIST.get(declared_mime)
    if allowed_magic is None:
        # Unknown type — no mapping defined; skip magic check rather than
        # blocking a legitimate upload for an unexpected MIME type.
        return

    detected = filetype.guess(contents)
    if detected is None:
        # filetype couldn't identify the file at all — for audio/mpeg this can
        # happen with raw MPEG frames; allow it through.  For all other types
        # treat an undetectable signature as a mismatch.
        if declared_mime != "audio/mpeg":
            raise BadRequestException(
                f"File content does not match the declared type '{declared_mime}'"
            )
        return

    if detected.mime not in allowed_magic:
        raise BadRequestException(
            f"File content does not match the declared type '{declared_mime}'"
        )


class DocumentRetention:
    """Object Lock retention window for an upload (Phase 2.3).

    Always COMPLIANCE mode — GOVERNANCE can be bypassed by a root key and
    provides no meaningful protection for IR evidence / KYC material.
    """

    def __init__(self, retain_until_date: datetime) -> None:
        self.retain_until_date = retain_until_date


class StorageService:
    def __init__(self) -> None:
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self.bucket = settings.MINIO_BUCKET
        self._bucket_initialized: bool = False
        self._bucket_lock: asyncio.Lock = asyncio.Lock()

        # A separate Minio client whose endpoint is the *public* address used in
        # presigned URLs.  When MINIO_PUBLIC_ENDPOINT is not configured it falls
        # back to the same client as above.
        public_endpoint = settings.MINIO_PUBLIC_ENDPOINT or settings.MINIO_ENDPOINT
        if public_endpoint != settings.MINIO_ENDPOINT:
            self._presign_client: Minio = Minio(
                public_endpoint,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE,
            )
        else:
            self._presign_client = self.client

    async def _ensure_bucket(self) -> None:
        if self._bucket_initialized:
            return

        async with self._bucket_lock:
            if self._bucket_initialized:
                return
            await self._init_bucket()
            self._bucket_initialized = True

    async def _init_bucket(self) -> None:
        def _init() -> None:
            try:
                if not self.client.bucket_exists(self.bucket):
                    # Enable object lock at creation — required for COMPLIANCE
                    # retention on sensitive category uploads (Phase 2.3).  On
                    # MinIO this is a no-op for legacy buckets created without
                    # ``object_lock=True``; we never retro-enable.
                    self.client.make_bucket(self.bucket, object_lock=True)
            except Exception:
                logger.warning(
                    "Could not check/create bucket '%s' — it may be externally managed",
                    self.bucket,
                    exc_info=True,
                )
            try:
                self.client.set_bucket_versioning(self.bucket, VersioningConfig("Enabled"))
            except Exception:
                logger.warning(
                    "Could not enable versioning on bucket '%s' — skipping",
                    self.bucket,
                    exc_info=True,
                )
            try:
                self.client.set_bucket_encryption(
                    self.bucket,
                    SSEConfig(Rule.new_sse_s3_rule()),
                )
            except Exception:
                logger.warning(
                    "Could not set encryption on bucket '%s' — skipping",
                    self.bucket,
                    exc_info=True,
                )

        await run_in_threadpool(_init)

    @staticmethod
    def _validate_prefix(prefix: str) -> None:
        if (
            not prefix
            or ".." in prefix
            or prefix.startswith("/")
            or "\\" in prefix
            or "\x00" in prefix
        ):
            raise BadRequestException("Invalid storage prefix")

    async def upload_file(
        self,
        file: UploadFile,
        prefix: str,
        *,
        max_size: int = MAX_FILE_SIZE,
        allowed_types: set[str] = ALLOWED_MIME_TYPES,
    ) -> tuple[str, int]:
        """Upload file to MinIO, return (object_path, file_size)."""
        self._validate_prefix(prefix)
        await self.validate_file(file, max_size=max_size, allowed_types=allowed_types)
        await self._ensure_bucket()

        ext = ""
        if file.filename and "." in file.filename:
            ext = "." + file.filename.rsplit(".", 1)[1]
        object_name = f"{prefix}/{uuid.uuid4()}{ext}"

        contents = await file.read()
        file_size = len(contents)

        content_type = file.content_type or "application/octet-stream"
        await self.upload_bytes(object_name, contents, content_type)

        return object_name, file_size

    async def upload_bytes(
        self,
        object_name: str,
        data: bytes,
        content_type: str,
    ) -> None:
        """Upload raw bytes to MinIO."""
        await run_in_threadpool(
            lambda: self.client.put_object(
                self.bucket,
                object_name,
                BytesIO(data),
                len(data),
                content_type=content_type,
            )
        )

    async def download_file(self, object_name: str) -> bytes:
        """Download a file from MinIO and return its bytes."""

        def _get() -> bytes:
            response = self.client.get_object(self.bucket, object_name)
            try:
                return bytes(response.read())
            finally:
                response.close()
                response.release_conn()

        return await run_in_threadpool(_get)

    def get_presigned_url(self, object_name: str, expires: timedelta = timedelta(hours=1)) -> str:
        """Get presigned download URL for a stored file.

        Uses the public-facing MinIO endpoint (``MINIO_PUBLIC_ENDPOINT``) so the
        returned URL is reachable from browsers even when the backend is running
        inside Docker with an internal service hostname.
        """
        return self._presign_client.presigned_get_object(self.bucket, object_name, expires=expires)

    @staticmethod
    async def validate_file(
        file: UploadFile,
        max_size: int = MAX_FILE_SIZE,
        allowed_types: set[str] = ALLOWED_MIME_TYPES,
    ) -> None:
        """Validate file size, declared MIME type, and magic-byte signature.

        The Content-Type header supplied by the client is checked against the
        allowlist first.  The file bytes are then inspected with the ``filetype``
        library to ensure the actual file signature matches the declared type,
        preventing spoofed Content-Type headers from bypassing the allowlist.

        Idempotent: safe to call multiple times — the file pointer is rewound
        before and after inspection.
        """
        content_type = file.content_type or "application/octet-stream"
        if content_type not in allowed_types:
            raise BadRequestException(f"File type '{content_type}' is not allowed")
        await file.seek(0)
        contents = await file.read()
        if len(contents) > max_size:
            raise BadRequestException(
                f"File size exceeds maximum of {max_size // (1024 * 1024)} MB"
            )
        _verify_magic_bytes(content_type, contents)
        await file.seek(0)

    async def upload_file_scoped(
        self,
        file: UploadFile,
        entity_type: str,
        entity_id: str,
        subfolder: str = "",
        *,
        max_size: int = MAX_FILE_SIZE,
        allowed_types: set[str] = ALLOWED_MIME_TYPES,
    ) -> tuple[str, int]:
        """Upload file scoped to an entity, return (object_path, file_size)."""
        self._validate_prefix(entity_type)
        self._validate_prefix(entity_id)
        if subfolder:
            self._validate_prefix(subfolder)
        prefix = f"{entity_type}s/{entity_id}"
        if subfolder:
            prefix = f"{prefix}/{subfolder}"
        return await self.upload_file(file, prefix, max_size=max_size, allowed_types=allowed_types)

    async def delete_file(self, object_name: str) -> None:
        """Delete a file from MinIO."""
        await run_in_threadpool(lambda: self.client.remove_object(self.bucket, object_name))

    # ── Phase 2.1 — client-side envelope encryption ─────────────────────────
    #
    # ``upload_encrypted_bytes`` encrypts plaintext with a per-file DEK derived
    # from the tenant/subject KEK, uploads the envelope blob, and returns the
    # metadata to persist on the document row.  Callers should validate +
    # ClamAV-scan plaintext *before* encrypting, never after.

    async def upload_encrypted_bytes(
        self,
        object_name: str,
        plaintext: bytes,
        *,
        file_uuid: uuid.UUID,
        subject_id: uuid.UUID,
        content_type: str | None = None,
        retention: DocumentRetention | None = None,
    ) -> EnvelopeMetadata:
        """Encrypt + upload plaintext; return the envelope metadata.

        The stored object's media type is ``application/octet-stream`` — the
        ciphertext is opaque.  Original content type lives on the document row.
        """
        await self._ensure_bucket()
        blob, meta = encrypt_bytes(plaintext, file_uuid=file_uuid, subject_id=subject_id)

        metadata: dict[str, str | list[str] | tuple[str]] = {
            "x-amz-meta-kek-version": str(meta.kek_version),
            "x-amz-meta-sha256": meta.sha256_plaintext,
            "x-amz-meta-envelope": "aes-256-gcm-chunked-v1",
        }
        if content_type:
            metadata["x-amz-meta-original-content-type"] = content_type
        lock: Retention | None = None
        if retention is not None:
            lock = Retention(mode=COMPLIANCE, retain_until_date=retention.retain_until_date)

        def _put() -> None:
            self.client.put_object(
                self.bucket,
                object_name,
                BytesIO(blob),
                len(blob),
                content_type="application/octet-stream",
                metadata=metadata,
                retention=lock,
            )

        await run_in_threadpool(_put)
        return meta

    async def download_encrypted_bytes(
        self,
        object_name: str,
        *,
        file_uuid: uuid.UUID,
        subject_id: uuid.UUID,
    ) -> bytes:
        """Fetch + decrypt the full blob into memory."""
        from app.core.file_crypto import decrypt_blob

        ciphertext = await self.download_file(object_name)
        return decrypt_blob(ciphertext, file_uuid=file_uuid, subject_id=subject_id)

    async def fetch_ciphertext(self, object_name: str) -> bytes:
        """Fetch the raw ciphertext blob from MinIO into memory."""

        def _load() -> bytes:
            resp = self.client.get_object(self.bucket, object_name)
            try:
                return bytes(resp.read())
            finally:
                resp.close()
                resp.release_conn()

        return await run_in_threadpool(_load)

    def iter_decrypted_chunks(
        self,
        ciphertext: bytes,
        *,
        file_uuid: uuid.UUID,
        subject_id: uuid.UUID,
    ) -> Iterator[bytes]:
        """Yield plaintext 1 MiB chunks from an envelope blob.

        Used by the proxy-through download route (Phase 2.4).  The ciphertext
        is expected to have been fetched up-front (``fetch_ciphertext``); a
        true streaming decrypt would need lock-step reads between MinIO and
        ``decrypt_stream`` across an async boundary — deferred to when files
        exceed memory headroom.
        """
        yield from decrypt_stream(BytesIO(ciphertext), file_uuid=file_uuid, subject_id=subject_id)


storage_service = StorageService()
