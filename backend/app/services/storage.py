import uuid
from datetime import timedelta

from fastapi import UploadFile
from minio import Minio
from minio.sseconfig import Rule, SSEConfig
from minio.versioningconfig import VersioningConfig

from app.core.config import settings
from app.core.exceptions import BadRequestException

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


class StorageService:
    def __init__(self) -> None:
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self.bucket = settings.MINIO_BUCKET

    def _ensure_bucket(self) -> None:
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)
        self.client.set_bucket_versioning(self.bucket, VersioningConfig("Enabled"))
        self.client.set_bucket_encryption(
            self.bucket,
            SSEConfig(Rule.new_sse_s3_rule()),
        )

    async def upload_file(self, file: UploadFile, prefix: str) -> tuple[str, int]:
        """Upload file to MinIO, return (object_path, file_size)."""
        self._ensure_bucket()

        ext = ""
        if file.filename and "." in file.filename:
            ext = "." + file.filename.rsplit(".", 1)[1]
        object_name = f"{prefix}/{uuid.uuid4()}{ext}"

        contents = await file.read()
        file_size = len(contents)

        from io import BytesIO

        self.client.put_object(
            self.bucket,
            object_name,
            BytesIO(contents),
            file_size,
            content_type=file.content_type or "application/octet-stream",
        )

        return object_name, file_size

    def get_presigned_url(self, object_name: str, expires: timedelta = timedelta(hours=1)) -> str:
        """Get presigned download URL for a stored file."""
        return self.client.presigned_get_object(self.bucket, object_name, expires=expires)

    @staticmethod
    async def validate_file(
        file: UploadFile,
        max_size: int = MAX_FILE_SIZE,
        allowed_types: set[str] = ALLOWED_MIME_TYPES,
    ) -> None:
        """Validate file size and MIME type."""
        content_type = file.content_type or "application/octet-stream"
        if content_type not in allowed_types:
            raise BadRequestException(f"File type '{content_type}' is not allowed")
        contents = await file.read()
        if len(contents) > max_size:
            raise BadRequestException(
                f"File size exceeds maximum of {max_size // (1024 * 1024)} MB"
            )
        await file.seek(0)

    async def upload_file_scoped(
        self,
        file: UploadFile,
        entity_type: str,
        entity_id: str,
        subfolder: str = "",
    ) -> tuple[str, int]:
        """Upload file scoped to an entity, return (object_path, file_size)."""
        prefix = f"{entity_type}s/{entity_id}"
        if subfolder:
            prefix = f"{prefix}/{subfolder}"
        return await self.upload_file(file, prefix)

    def delete_file(self, object_name: str) -> None:
        """Delete a file from MinIO."""
        self.client.remove_object(self.bucket, object_name)


storage_service = StorageService()
