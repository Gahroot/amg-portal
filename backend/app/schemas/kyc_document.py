from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str2000
from app.schemas.document import DocumentResponse


class KYCDocumentResponse(BaseModel):
    id: UUID
    client_id: UUID
    document_id: UUID
    document_type: Str100
    status: Str50
    expiry_date: date | None = None
    verified_by: UUID | None = None
    verified_at: datetime | None = None
    rejection_reason: Str2000 | None = None
    notes: Str2000 | None = None
    created_at: datetime
    updated_at: datetime
    document: DocumentResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class KYCDocumentListResponse(BaseModel):
    kyc_documents: list[KYCDocumentResponse]
    total: int


class KYCVerifyRequest(BaseModel):
    status: Str50
    rejection_reason: Str2000 | None = None
    notes: Str2000 | None = None
