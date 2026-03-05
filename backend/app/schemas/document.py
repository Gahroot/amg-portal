from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: UUID
    file_path: str
    file_name: str
    file_size: int
    content_type: str | None = None
    entity_type: str
    entity_id: UUID
    category: str
    description: str | None = None
    version: int
    uploaded_by: UUID
    created_at: datetime
    updated_at: datetime
    download_url: str | None = None

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int
