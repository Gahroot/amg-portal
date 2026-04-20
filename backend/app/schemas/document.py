from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255, Str500, Str2000, TextStr


class DocumentResponse(BaseModel):
    id: UUID
    file_path: Str500
    file_name: Str255
    file_size: int
    content_type: Str255 | None = None
    entity_type: Str50
    entity_id: UUID
    category: Str100
    description: Str2000 | None = None
    version: int
    uploaded_by: UUID
    created_at: datetime
    updated_at: datetime
    vault_status: Str50 = "active"
    download_url: Str2000 | None = None
    # Expiry fields
    document_type: Str100 | None = None
    expiry_date: date | None = None
    expiry_status: Str50 | None = None  # computed: expired/expiring_30/expiring_90/valid
    # DocuSign
    envelope_id: Str255 | None = None
    docusign_status: Str50 | None = None

    model_config = ConfigDict(from_attributes=True)


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


class DocumentVersionResponse(BaseModel):
    id: UUID
    version: int
    uploaded_by: UUID
    created_at: datetime
    file_size: int
    download_url: Str2000 | None = None

    model_config = ConfigDict(from_attributes=True)


class DocumentVersionListResponse(BaseModel):
    versions: list[DocumentVersionResponse]
    total: int


class ExpiringDocumentResponse(BaseModel):
    id: UUID
    file_name: Str255
    file_size: int
    entity_type: Str50
    entity_id: UUID
    category: Str100
    description: Str2000 | None = None
    document_type: Str100 | None = None
    expiry_date: date
    expiry_status: Str50  # expired / expiring_30 / expiring_90
    days_until_expiry: int  # negative if already expired
    uploaded_by: UUID
    created_at: datetime
    download_url: Str2000 | None = None


class ExpiringDocumentsResponse(BaseModel):
    documents: list[ExpiringDocumentResponse]
    total: int
    expired_count: int
    expiring_30_count: int
    expiring_90_count: int


class DiffLine(BaseModel):
    line_number_a: int | None = None
    line_number_b: int | None = None
    content: TextStr
    change_type: Literal["added", "deleted", "context"]


class DocumentDiffHunk(BaseModel):
    a_start: int
    a_count: int
    b_start: int
    b_count: int
    lines: list[DiffLine]


class DocumentCompareResponse(BaseModel):
    version_a: DocumentVersionResponse
    version_b: DocumentVersionResponse
    is_text: bool
    diff_available: bool
    hunks: list[DocumentDiffHunk]
    total_additions: int
    total_deletions: int
    metadata: dict[str, object] | None = None
