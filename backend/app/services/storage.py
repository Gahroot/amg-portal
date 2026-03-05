import uuid
from datetime import timedelta

from fastapi import UploadFile
from minio import Minio

from app.core.config import settings


class StorageService:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self.bucket = settings.MINIO_BUCKET

    def _ensure_bucket(self):
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

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


storage_service = StorageService()
