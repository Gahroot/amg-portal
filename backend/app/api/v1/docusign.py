"""DocuSign eSignature endpoints."""

from uuid import UUID

from docusign_esign import ApiException
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, require_internal
from app.models.document import Document
from app.schemas.docusign import (
    CreateEnvelopeRequest,
    EnvelopeResponse,
    SigningUrlResponse,
)
from app.services import docusign_service
from app.services.storage import storage_service

router = APIRouter()


def _file_extension_from_content_type(content_type: str | None) -> str:
    """Derive file extension from MIME content type."""
    mapping = {
        "application/pdf": "pdf",
        "application/msword": "doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "text/plain": "txt",
    }
    return mapping.get(content_type or "", "pdf")


@router.post(
    "/envelopes",
    response_model=EnvelopeResponse,
    dependencies=[Depends(require_internal)],
)
async def create_envelope(
    body: CreateEnvelopeRequest,
    db: DB,
    user: CurrentUser,
) -> EnvelopeResponse:
    """Create a DocuSign envelope for a document."""
    result = await db.execute(
        select(Document).where(Document.id == body.document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Download file bytes from MinIO
    try:
        response = storage_service.client.get_object(
            storage_service.bucket, doc.file_path
        )
        file_bytes = response.read()
        response.close()
        response.release_conn()
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to download document: {exc}"
        ) from exc

    file_ext = _file_extension_from_content_type(doc.content_type)

    try:
        envelope_id = await docusign_service.create_envelope(
            file_bytes=file_bytes,
            file_name=doc.file_name,
            file_extension=file_ext,
            signer_email=body.signer_email,
            signer_name=body.signer_name,
        )
    except HTTPException:
        raise
    except ApiException as exc:
        raise HTTPException(
            status_code=503, detail=f"DocuSign API error: {exc.reason}"
        ) from exc

    doc.envelope_id = envelope_id
    doc.docusign_status = "sent"
    await db.commit()
    await db.refresh(doc)

    return EnvelopeResponse(
        envelope_id=envelope_id,
        document_id=doc.id,
        docusign_status="sent",
    )


@router.get(
    "/signing-url",
    response_model=SigningUrlResponse,
    dependencies=[Depends(require_internal)],
)
async def get_signing_url(
    db: DB,
    user: CurrentUser,
    document_id: UUID = Query(...),
    signer_email: str = Query(...),
    signer_name: str = Query(...),
    return_url: str = Query(...),
) -> SigningUrlResponse:
    """Get an embedded DocuSign signing URL."""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.envelope_id:
        raise HTTPException(
            status_code=400, detail="Document has no DocuSign envelope"
        )

    try:
        signing_url = await docusign_service.get_signing_url(
            envelope_id=doc.envelope_id,
            signer_email=signer_email,
            signer_name=signer_name,
            return_url=return_url,
        )
    except HTTPException:
        raise
    except ApiException as exc:
        raise HTTPException(
            status_code=503, detail=f"DocuSign API error: {exc.reason}"
        ) from exc

    return SigningUrlResponse(
        signing_url=signing_url,
        envelope_id=doc.envelope_id,
    )
