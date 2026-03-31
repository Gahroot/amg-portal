"""DocuSign eSignature request/response schemas."""

from uuid import UUID

from pydantic import BaseModel


class CreateEnvelopeRequest(BaseModel):
    document_id: UUID
    signer_email: str
    signer_name: str
    return_url: str


class EnvelopeResponse(BaseModel):
    envelope_id: str
    document_id: UUID
    docusign_status: str


class SigningUrlResponse(BaseModel):
    signing_url: str
    envelope_id: str
