from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EnvelopeRecipientSchema(BaseModel):
    name: str
    email: str
    status: str = "pending"
    signed_at: datetime | None = None
    declined_reason: str | None = None


class EnvelopeCreateRequest(BaseModel):
    document_id: UUID | None = None
    subject: str
    recipients: list[EnvelopeRecipientSchema]


class EnvelopeResponse(BaseModel):
    id: UUID
    envelope_id: str
    subject: str
    status: str
    sender_name: str | None = None
    sender_email: str | None = None
    recipients: list[EnvelopeRecipientSchema]
    sent_at: datetime | None = None
    completed_at: datetime | None = None
    voided_reason: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EnvelopeListResponse(BaseModel):
    envelopes: list[EnvelopeResponse]
    total: int


class EnvelopeSigningSessionResponse(BaseModel):
    signing_url: str
    integration_key: str
    sandbox: bool
