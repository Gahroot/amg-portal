from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentDeliverRequest(BaseModel):
    recipient_ids: list[UUID]
    delivery_method: str = "portal"
    notes: str | None = None


class DocumentDeliveryResponse(BaseModel):
    id: UUID
    document_id: UUID
    recipient_id: UUID
    delivery_method: str
    delivered_at: datetime
    viewed_at: datetime | None = None
    acknowledged_at: datetime | None = None
    secure_link_token: str | None = None
    secure_link_expires_at: datetime | None = None
    notes: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentDeliveryListResponse(BaseModel):
    deliveries: list[DocumentDeliveryResponse]
    total: int


class SecureLinkRequest(BaseModel):
    recipient_id: UUID
    expires_hours: int = 24


class SecureLinkResponse(BaseModel):
    token: str
    download_url: str
    expires_at: datetime


class SealDocumentRequest(BaseModel):
    retention_policy: str | None = None


class CustodyEntry(BaseModel):
    action: str
    user_id: str
    timestamp: str
    details: str | None = None


class CustodyChainResponse(BaseModel):
    document_id: UUID
    file_name: str
    vault_status: str
    entries: list[CustodyEntry]
    total: int


class VaultDocumentResponse(BaseModel):
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
    vault_status: str
    sealed_at: datetime | None = None
    sealed_by: UUID | None = None
    retention_policy: str | None = None
    created_at: datetime
    updated_at: datetime
    download_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class VaultDocumentListResponse(BaseModel):
    documents: list[VaultDocumentResponse]
    total: int
