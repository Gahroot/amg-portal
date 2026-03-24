from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.document import DocumentResponse


class KYCDocumentResponse(BaseModel):
    id: UUID
    client_id: UUID
    document_id: UUID
    document_type: str
    status: str
    expiry_date: date | None = None
    verified_by: UUID | None = None
    verified_at: datetime | None = None
    rejection_reason: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    document: DocumentResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class KYCDocumentListResponse(BaseModel):
    kyc_documents: list[KYCDocumentResponse]
    total: int


class KYCVerifyRequest(BaseModel):
    status: str
    rejection_reason: str | None = None
    notes: str | None = None
