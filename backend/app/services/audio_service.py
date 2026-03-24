"""Audio service for voice message upload and URL generation."""

from datetime import timedelta

from fastapi import UploadFile

from app.core.exceptions import BadRequestException
from app.services.storage import (
    ALLOWED_AUDIO_MIME_TYPES,
    MAX_AUDIO_FILE_SIZE,
    storage_service,
)

VOICE_MESSAGE_PREFIX = "voice_messages"


class AudioService:
    async def upload_voice_message(self, file: UploadFile, sender_id: str) -> tuple[str, int]:
        """Validate and upload a voice message audio file.

        Returns (object_path, file_size).
        """
        content_type = file.content_type or "application/octet-stream"
        if content_type not in ALLOWED_AUDIO_MIME_TYPES:
            raise BadRequestException(
                f"Audio type '{content_type}' is not supported. "
                "Accepted formats: webm, ogg, mp3, mp4, wav."
            )

        contents = await file.read()
        file_size = len(contents)
        if file_size > MAX_AUDIO_FILE_SIZE:
            raise BadRequestException(
                f"Audio file exceeds the {MAX_AUDIO_FILE_SIZE // (1024 * 1024)} MB limit."
            )
        await file.seek(0)

        object_path, stored_size = await storage_service.upload_file(
            file, f"{VOICE_MESSAGE_PREFIX}/{sender_id}"
        )
        return object_path, stored_size

    def get_audio_url(self, object_path: str, expires_hours: int = 4) -> str:
        """Return a fresh presigned URL for an existing voice message."""
        # Restrict to the voice_messages prefix so this endpoint cannot
        # be used to generate URLs for arbitrary MinIO objects.
        if not object_path.startswith(VOICE_MESSAGE_PREFIX + "/"):
            raise BadRequestException("Invalid audio object path.")
        return storage_service.get_presigned_url(object_path, timedelta(hours=expires_hours))


audio_service = AudioService()
