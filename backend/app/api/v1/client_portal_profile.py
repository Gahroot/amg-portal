"""Client portal profile and document endpoints."""

import contextlib
import uuid as _uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import or_, select

from app.api.deps import DB, CurrentUser, RLSContext, require_client
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.client import Client
from app.models.client_profile import ClientProfile
from app.models.document import Document
from app.models.document_acknowledgment import DocumentAcknowledgment
from app.models.program import Program
from app.schemas.client_profile import ClientPortalProfileResponse
from app.schemas.document import DocumentListResponse, DocumentResponse
from app.services.client_service import client_service
from app.services.storage import storage_service


class AcknowledgeDocumentRequest(BaseModel):
    signer_name: str


class AcknowledgmentResponse(BaseModel):
    id: _uuid.UUID
    document_id: _uuid.UUID
    user_id: _uuid.UUID
    signer_name: str
    acknowledged_at: datetime

    model_config = {"from_attributes": True}


def _build_portal_document_response(doc: Document) -> DocumentResponse:
    data: dict[str, object] = {
        "id": doc.id,
        "file_path": doc.file_path,
        "file_name": doc.file_name,
        "file_size": doc.file_size,
        "content_type": doc.content_type,
        "entity_type": doc.entity_type,
        "entity_id": doc.entity_id,
        "category": doc.category,
        "description": doc.description,
        "version": doc.version,
        "uploaded_by": doc.uploaded_by,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
        "download_url": None,
    }
    if doc.file_path:
        with contextlib.suppress(Exception):
            data["download_url"] = storage_service.get_presigned_url(str(doc.file_path))
    return DocumentResponse.model_validate(data)


async def _resolve_client_program_ids(
    db: DB,
    current_user: CurrentUser,
) -> tuple[_uuid.UUID | None, list[_uuid.UUID]]:
    """Return (client_profile_id, [program_ids]) for the current portal user."""
    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return None, []

    client_query = select(Client).where(Client.name == profile.legal_name)
    if profile.assigned_rm_id is not None:
        client_query = client_query.where(Client.rm_id == profile.assigned_rm_id)
    client_result = await db.execute(client_query.limit(1))
    client = client_result.scalar_one_or_none()

    program_ids: list[_uuid.UUID] = []
    if client:
        programs_result = await db.execute(select(Program.id).where(Program.client_id == client.id))
        program_ids = list(programs_result.scalars().all())

    return profile.id, program_ids


router = APIRouter()


@router.get(
    "/profile", response_model=ClientPortalProfileResponse, dependencies=[Depends(require_client)]
)
async def get_my_profile(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ClientPortalProfileResponse:
    profile = await client_service.get_client_dashboard_data(db, current_user.id)
    if not profile:
        raise NotFoundException("No profile found")
    return ClientPortalProfileResponse.model_validate(profile)


@router.get(
    "/documents",
    response_model=DocumentListResponse,
    dependencies=[Depends(require_client)],
)
async def get_my_documents(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentListResponse:
    """Return all documents accessible to this client portal user.

    Includes:
    - Documents where entity_type='client' and entity_id=client_profile_id
    - Documents where entity_type='program' and entity_id in client's program IDs
    """
    profile_id, program_ids = await _resolve_client_program_ids(db, current_user)
    if not profile_id:
        return DocumentListResponse(documents=[], total=0)

    conditions = [
        (Document.entity_type == "client") & (Document.entity_id == profile_id),
    ]
    if program_ids:
        conditions.append(
            (Document.entity_type == "program") & (Document.entity_id.in_(program_ids))
        )

    query = select(Document).where(or_(*conditions)).order_by(Document.created_at.desc())
    result = await db.execute(query)
    documents = list(result.scalars().all())

    return DocumentListResponse(
        documents=[_build_portal_document_response(d) for d in documents],
        total=len(documents),
    )


@router.get(
    "/documents/{document_id}",
    response_model=DocumentResponse,
    dependencies=[Depends(require_client)],
)
async def get_my_document(
    document_id: str,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentResponse:
    """Return a single document accessible to this client, with a fresh presigned download URL."""
    try:
        doc_uuid = _uuid.UUID(document_id)
    except ValueError as exc:
        raise BadRequestException("Invalid document ID") from exc

    profile_id, program_ids = await _resolve_client_program_ids(db, current_user)
    if not profile_id:
        raise NotFoundException("Document not found")

    conditions = [
        (Document.entity_type == "client") & (Document.entity_id == profile_id),
    ]
    if program_ids:
        conditions.append(
            (Document.entity_type == "program") & (Document.entity_id.in_(program_ids))
        )

    result = await db.execute(select(Document).where(Document.id == doc_uuid, or_(*conditions)))
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Document not found")

    return _build_portal_document_response(doc)


@router.post(
    "/documents/{document_id}/acknowledge",
    response_model=AcknowledgmentResponse,
    status_code=201,
    dependencies=[Depends(require_client)],
)
async def acknowledge_document(
    document_id: str,
    body: AcknowledgeDocumentRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> AcknowledgmentResponse:
    """Record the client's acknowledgment (typed-name signature) for a document."""
    try:
        doc_uuid = _uuid.UUID(document_id)
    except ValueError as exc:
        raise BadRequestException("Invalid document ID") from exc

    profile_id, program_ids = await _resolve_client_program_ids(db, current_user)
    if not profile_id:
        raise NotFoundException("Document not found")

    conditions = [
        (Document.entity_type == "client") & (Document.entity_id == profile_id),
    ]
    if program_ids:
        conditions.append(
            (Document.entity_type == "program") & (Document.entity_id.in_(program_ids))
        )

    doc_result = await db.execute(select(Document).where(Document.id == doc_uuid, or_(*conditions)))
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise NotFoundException("Document not found")

    ack = DocumentAcknowledgment(
        document_id=doc_uuid,
        user_id=current_user.id,
        signer_name=body.signer_name.strip(),
        acknowledged_at=datetime.now(UTC),
    )
    db.add(ack)
    await db.commit()
    await db.refresh(ack)

    return AcknowledgmentResponse.model_validate(ack)
