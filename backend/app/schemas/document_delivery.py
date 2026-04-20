from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255, Str500, Str2000


class DocumentDeliverRequest(BaseModel):
    recipient_ids: list[UUID]
    delivery_method: Str50 = "portal"
    notes: Str2000 | None = None


class DocumentDeliveryResponse(BaseModel):
    id: UUID
    document_id: UUID
    recipient_id: UUID
    delivery_method: Str50
    delivered_at: datetime
    viewed_at: datetime | None = None
    acknowledged_at: datetime | None = None
    secure_link_token: Str500 | None = None
    secure_link_expires_at: datetime | None = None
    notes: Str2000 | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentDeliveryListResponse(BaseModel):
    deliveries: list[DocumentDeliveryResponse]
    total: int


class SecureLinkRequest(BaseModel):
    recipient_id: UUID
    expires_hours: int = 24


class SecureLinkResponse(BaseModel):
    token: Str500
    download_url: Str2000
    expires_at: datetime


class SealDocumentRequest(BaseModel):
    retention_policy: Str255 | None = None


class CustodyEntry(BaseModel):
    action: Str50
    user_id: Str100
    timestamp: Str50
    details: Str2000 | None = None


class CustodyChainResponse(BaseModel):
    document_id: UUID
    file_name: Str255
    vault_status: Str50
    entries: list[CustodyEntry]
    total: int


class VaultDocumentResponse(BaseModel):
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
    vault_status: Str50
    sealed_at: datetime | None = None
    sealed_by: UUID | None = None
    retention_policy: Str255 | None = None
    created_at: datetime
    updated_at: datetime
    download_url: Str2000 | None = None

    model_config = ConfigDict(from_attributes=True)


class VaultDocumentListResponse(BaseModel):
    documents: list[VaultDocumentResponse]
    total: int
