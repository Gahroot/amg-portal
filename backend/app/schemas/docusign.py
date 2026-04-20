"""DocuSign eSignature request/response schemas."""

from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import Str50, Str255, Str2000


class CreateEnvelopeRequest(BaseModel):
    document_id: UUID
    signer_email: Str255
    signer_name: Str255
    return_url: Str2000


class EnvelopeResponse(BaseModel):
    envelope_id: Str255
    document_id: UUID
    docusign_status: Str50


class SigningUrlResponse(BaseModel):
    signing_url: Str2000
    envelope_id: Str255
