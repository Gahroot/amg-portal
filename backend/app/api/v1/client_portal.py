"""Client portal endpoints (client-facing, read-only)."""

import contextlib
import csv
import io
import uuid as _uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, RLSContext, require_client
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.client import Client
from app.models.client_profile import ClientProfile
from app.models.conversation import Conversation
from app.models.decision_request import DecisionRequest as DecisionRequestModel
from app.models.deliverable import Deliverable
from app.models.document import Document
from app.models.document_acknowledgment import DocumentAcknowledgment
from app.models.enums import DocumentRequestStatus
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.schemas.client_profile import (
    ClientCommunicationSummary,
    ClientMilestoneSummary,
    ClientPortalProfileResponse,
    ClientProgramDetail,
    ClientProgramSummary,
)
from app.schemas.deliverable import DeliverableListResponse, DeliverableResponse
from app.schemas.document import DocumentListResponse, DocumentResponse
from app.schemas.document_request import (
    AddClientNoteBody,
    DocumentRequestListResponse,
    DocumentRequestResponse,
)
from app.schemas.report import ProgramStatusReport
from app.services import document_request_service
from app.services.client_service import client_service
from app.services.report_service import report_service
from app.services.storage import storage_service
from app.utils.rag import compute_rag_status


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
    "/programs",
    response_model=list[ClientProgramSummary],
    dependencies=[Depends(require_client)],
)
async def get_my_programs(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> list[ClientProgramSummary]:
    """Return all programs for the authenticated client portal user.

    Resolves: portal user → ClientProfile (via user_id) → Client (via legal_name)
    → Programs (via client_id).
    """
    # Step 1: find the ClientProfile linked to this portal user
    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return []

    # Step 2: find the Client record that corresponds to this profile.
    # The Client entity (used for program management) is matched by legal name.
    client_query = select(Client).where(Client.name == profile.legal_name)
    if profile.assigned_rm_id is not None:
        client_query = client_query.where(Client.rm_id == profile.assigned_rm_id)
    client_result = await db.execute(client_query.limit(1))
    client = client_result.scalar_one_or_none()
    if not client:
        return []

    # Step 3: fetch all programs for this client, eagerly loading milestones
    programs_result = await db.execute(
        select(Program)
        .options(selectinload(Program.milestones))
        .where(Program.client_id == client.id)
        .order_by(Program.created_at.desc())
    )
    programs = list(programs_result.scalars().all())

    summaries: list[ClientProgramSummary] = []
    for program in programs:
        milestones = program.milestones or []
        milestone_count = len(milestones)
        completed_count = sum(1 for m in milestones if m.status == "completed")
        rag = compute_rag_status(milestones)
        summaries.append(
            ClientProgramSummary(
                id=program.id,
                title=program.title,
                status=program.status,
                start_date=program.start_date,
                end_date=program.end_date,
                milestone_count=milestone_count,
                completed_milestone_count=completed_count,
                rag_status=rag,
            )
        )

    return summaries


@router.get(
    "/communications",
    response_model=list[ClientCommunicationSummary],
    dependencies=[Depends(require_client)],
)
async def get_my_communications(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> list[ClientCommunicationSummary]:
    """Return all conversations for the authenticated client portal user."""
    # Find the ClientProfile linked to this portal user
    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return []

    # Fetch conversations where client_id matches the ClientProfile id
    convs_result = await db.execute(
        select(Conversation)
        .where(Conversation.client_id == profile.id)
        .order_by(Conversation.last_activity_at.desc().nullslast())
    )
    conversations = list(convs_result.scalars().all())
    return [
        ClientCommunicationSummary(
            id=conv.id,
            title=conv.title,
            conversation_type=conv.conversation_type,
            last_activity_at=conv.last_activity_at,
            created_at=conv.created_at,
        )
        for conv in conversations
    ]


@router.get(
    "/programs/{program_id}",
    response_model=ClientProgramDetail,
    dependencies=[Depends(require_client)],
)
async def get_my_program(
    program_id: str,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ClientProgramDetail:
    """Return detail for a specific program belonging to the authenticated client."""
    # Resolve the portal user → ClientProfile → Client
    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Profile not found")

    client_query = select(Client).where(Client.name == profile.legal_name)
    if profile.assigned_rm_id is not None:
        client_query = client_query.where(Client.rm_id == profile.assigned_rm_id)
    client_result = await db.execute(client_query.limit(1))
    client = client_result.scalar_one_or_none()
    if not client:
        raise NotFoundException("Client not found")

    # Fetch the specific program (must belong to this client)
    try:
        pid = _uuid.UUID(program_id)
    except ValueError as exc:
        raise BadRequestException("Invalid program ID") from exc

    prog_result = await db.execute(
        select(Program)
        .options(selectinload(Program.milestones))
        .where(Program.id == pid, Program.client_id == client.id)
    )
    program = prog_result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    milestones = sorted(program.milestones or [], key=lambda m: m.position)
    milestone_count = len(milestones)
    completed_count = sum(1 for m in milestones if m.status == "completed")
    rag = compute_rag_status(milestones)

    return ClientProgramDetail(
        id=program.id,
        title=program.title,
        objectives=program.objectives,
        scope=program.scope,
        status=program.status,
        start_date=program.start_date,
        end_date=program.end_date,
        milestone_count=milestone_count,
        completed_milestone_count=completed_count,
        rag_status=rag,
        milestones=[
            ClientMilestoneSummary(
                id=m.id,
                title=m.title,
                description=m.description,
                due_date=m.due_date,
                status=m.status,
                position=m.position,
            )
            for m in milestones
        ],
    )


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
        programs_result = await db.execute(
            select(Program.id).where(Program.client_id == client.id)
        )
        program_ids = list(programs_result.scalars().all())

    return profile.id, program_ids


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

    query = (
        select(Document)
        .where(or_(*conditions))
        .order_by(Document.created_at.desc())
    )
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

    result = await db.execute(
        select(Document).where(Document.id == doc_uuid, or_(*conditions))
    )
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

    doc_result = await db.execute(
        select(Document).where(Document.id == doc_uuid, or_(*conditions))
    )
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


def _build_portal_deliverable_response(d: Deliverable) -> DeliverableResponse:
    data: dict[str, object] = {
        "id": d.id,
        "assignment_id": d.assignment_id,
        "title": d.title,
        "deliverable_type": d.deliverable_type,
        "description": d.description,
        "due_date": d.due_date,
        "file_path": d.file_path,
        "file_name": d.file_name,
        "file_size": d.file_size,
        "submitted_at": d.submitted_at,
        "submitted_by": d.submitted_by,
        "status": d.status,
        "review_comments": d.review_comments,
        "reviewed_by": d.reviewed_by,
        "reviewed_at": d.reviewed_at,
        "client_visible": d.client_visible,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
        "download_url": None,
    }
    if d.file_path:
        with contextlib.suppress(Exception):
            data["download_url"] = storage_service.get_presigned_url(str(d.file_path))
    return DeliverableResponse.model_validate(data)


@router.get(
    "/deliverables",
    response_model=DeliverableListResponse,
    dependencies=[Depends(require_client)],
)
async def get_my_deliverables(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DeliverableListResponse:
    """Return approved deliverables visible to this client portal user.

    Only returns deliverables where client_visible=True, scoped to programs
    belonging to this client.
    """
    _, program_ids = await _resolve_client_program_ids(db, current_user)
    if not program_ids:
        return DeliverableListResponse(deliverables=[], total=0)

    # Get assignment IDs for the client's programs
    assignment_result = await db.execute(
        select(PartnerAssignment.id).where(PartnerAssignment.program_id.in_(program_ids))
    )
    assignment_ids = list(assignment_result.scalars().all())
    if not assignment_ids:
        return DeliverableListResponse(deliverables=[], total=0)

    result = await db.execute(
        select(Deliverable)
        .where(
            Deliverable.assignment_id.in_(assignment_ids),
            Deliverable.client_visible.is_(True),
        )
        .order_by(Deliverable.reviewed_at.desc())
    )
    deliverables = list(result.scalars().all())

    return DeliverableListResponse(
        deliverables=[_build_portal_deliverable_response(d) for d in deliverables],
        total=len(deliverables),
    )


async def _resolve_portal_client(
    db: DB,
    current_user: CurrentUser,
) -> Client | None:
    """Resolve the Client entity for the current portal user.

    Resolves: portal user → ClientProfile → Client (matched by legal name).
    """
    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return None

    client_query = select(Client).where(Client.name == profile.legal_name)
    if profile.assigned_rm_id is not None:
        client_query = client_query.where(Client.rm_id == profile.assigned_rm_id)
    client_result = await db.execute(client_query.limit(1))
    return client_result.scalar_one_or_none()


@router.get(
    "/program-status",
    response_model=list[ProgramStatusReport],
    dependencies=[Depends(require_client)],
)
async def get_my_program_statuses(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> list[ProgramStatusReport]:
    """Return status reports for all programs belonging to the authenticated client.

    Each report includes active milestones, completed deliverables, and pending decisions.
    Results are ordered by program creation date (newest first).
    """
    client = await _resolve_portal_client(db, current_user)
    if not client:
        return []

    programs_result = await db.execute(
        select(Program.id)
        .where(Program.client_id == client.id)
        .order_by(Program.created_at.desc())
    )
    program_ids = list(programs_result.scalars().all())

    reports: list[ProgramStatusReport] = []
    for pid in program_ids:
        report_data = await report_service.get_program_status_report(db, pid)
        if report_data is not None:
            reports.append(ProgramStatusReport.model_validate(report_data))
    return reports


@router.get(
    "/program-status/{program_id}",
    response_model=ProgramStatusReport,
    dependencies=[Depends(require_client)],
)
async def get_my_program_status(
    program_id: str,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ProgramStatusReport:
    """Return the status report for a single program belonging to the authenticated client.

    Includes active milestones, completed deliverables (client-visible), and pending decisions.
    """
    client = await _resolve_portal_client(db, current_user)
    if not client:
        raise NotFoundException("Client not found")

    try:
        pid = _uuid.UUID(program_id)
    except ValueError as exc:
        raise BadRequestException("Invalid program ID") from exc

    # Verify program belongs to this client
    prog_check = await db.execute(
        select(Program.id).where(Program.id == pid, Program.client_id == client.id)
    )
    if not prog_check.scalar_one_or_none():
        raise NotFoundException("Program not found")

    report_data = await report_service.get_program_status_report(db, pid)
    if report_data is None:
        raise NotFoundException("Program not found")
    return ProgramStatusReport.model_validate(report_data)


# ── Document Request Portal Endpoints ────────────────────────────────────────


@router.get(
    "/document-requests",
    response_model=DocumentRequestListResponse,
    dependencies=[Depends(require_client)],
)
async def get_my_document_requests(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    status: str | None = None,
) -> DocumentRequestListResponse:
    """Return all document requests visible to this client portal user."""
    requests = await document_request_service.list_requests_for_client_user(
        db, current_user.id, status=status
    )
    return DocumentRequestListResponse(
        requests=[DocumentRequestResponse.model_validate(r) for r in requests],
        total=len(requests),
    )


@router.post(
    "/document-requests/{request_id}/fulfill",
    response_model=DocumentRequestResponse,
    status_code=200,
    dependencies=[Depends(require_client)],
)
async def fulfill_my_document_request(
    request_id: str,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    file: UploadFile = File(...),
    category: str = Form("general"),
    description: str | None = Form(None),
) -> DocumentRequestResponse:
    """Upload a document and mark the given request as fulfilled.

    The file is uploaded against the client's profile entity, then the
    request is marked as received with a link to the new document.
    """
    try:
        req_uuid = _uuid.UUID(request_id)
    except ValueError as exc:
        raise BadRequestException("Invalid request ID") from exc

    # Verify this request belongs to the authenticated client
    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Document request not found")

    req = await document_request_service.get_document_request(db, req_uuid)
    if not req or req.client_id != profile.id:
        raise NotFoundException("Document request not found")

    if req.status not in (
        DocumentRequestStatus.pending,
        DocumentRequestStatus.overdue,
    ):
        raise BadRequestException("This request is already fulfilled or cancelled")

    # Upload the document
    from app.models.document import Document as DocumentModel
    from app.services.storage import storage_service as _storage

    await _storage.validate_file(file)
    file_name = file.filename or "untitled"

    existing_version_result = await db.execute(
        select(func.max(DocumentModel.version)).where(
            DocumentModel.entity_type == "client",
            DocumentModel.entity_id == profile.id,
            DocumentModel.file_name == file_name,
        )
    )
    max_version: int = existing_version_result.scalar() or 0
    object_path, file_size = await _storage.upload_file_scoped(file, "client", str(profile.id))

    doc = DocumentModel(
        file_path=object_path,
        file_name=file_name,
        file_size=file_size,
        content_type=file.content_type,
        entity_type="client",
        entity_id=profile.id,
        category=category,
        description=description or req.title,
        version=max_version + 1,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.flush()  # get doc.id without committing

    fulfilled = await document_request_service.fulfill_document_request(
        db, req_uuid, doc.id
    )
    if not fulfilled:
        raise NotFoundException("Document request not found")
    return DocumentRequestResponse.model_validate(fulfilled)


@router.get(
    "/document-requests/{request_id}",
    response_model=DocumentRequestResponse,
    dependencies=[Depends(require_client)],
)
async def get_my_document_request(
    request_id: str,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentRequestResponse:
    """Return a single document request belonging to this client."""
    try:
        req_uuid = _uuid.UUID(request_id)
    except ValueError as exc:
        raise BadRequestException("Invalid request ID") from exc

    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Document request not found")

    req = await document_request_service.get_document_request(db, req_uuid)
    if not req or req.client_id != profile.id:
        raise NotFoundException("Document request not found")

    return DocumentRequestResponse.model_validate(req)


@router.post(
    "/document-requests/{request_id}/cancel",
    response_model=DocumentRequestResponse,
    dependencies=[Depends(require_client)],
)
async def cancel_my_document_request(
    request_id: str,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentRequestResponse:
    """Cancel a pending document request (client action).

    Only requests in 'pending' or 'overdue' status can be cancelled by the client.
    """
    try:
        req_uuid = _uuid.UUID(request_id)
    except ValueError as exc:
        raise BadRequestException("Invalid request ID") from exc

    req = await document_request_service.cancel_document_request_by_client(
        db, req_uuid, current_user.id
    )
    if req is None:
        raise BadRequestException(
            "Request not found or cannot be cancelled (must be pending or overdue)"
        )
    return DocumentRequestResponse.model_validate(req)


@router.post(
    "/document-requests/{request_id}/add-note",
    response_model=DocumentRequestResponse,
    dependencies=[Depends(require_client)],
)
async def add_note_to_my_request(
    request_id: str,
    body: AddClientNoteBody,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DocumentRequestResponse:
    """Add or update the client's note on a document request."""
    try:
        req_uuid = _uuid.UUID(request_id)
    except ValueError as exc:
        raise BadRequestException("Invalid request ID") from exc

    req = await document_request_service.add_client_note(
        db, req_uuid, current_user.id, body.note
    )
    if req is None:
        raise NotFoundException("Document request not found")
    return DocumentRequestResponse.model_validate(req)


# ── Milestone Calendar Endpoint ───────────────────────────────────────────────


class CalendarMilestone(BaseModel):
    """Milestone enriched with program info for the calendar view."""

    id: _uuid.UUID
    title: str
    description: str | None = None
    due_date: str | None = None
    status: str
    position: int
    program_id: _uuid.UUID
    program_title: str
    program_status: str

    model_config = {"from_attributes": False}


@router.get(
    "/milestones",
    response_model=list[CalendarMilestone],
    dependencies=[Depends(require_client)],
)
async def get_my_milestones(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    program_id: str | None = None,
    upcoming_only: bool = False,
) -> list[CalendarMilestone]:
    """Return all milestones across the client's programs for the calendar view.

    Optional query params:
    - ``program_id``: filter to a single program
    - ``upcoming_only``: if true, exclude completed/cancelled milestones
    """
    _, program_ids = await _resolve_client_program_ids(db, current_user)
    if not program_ids:
        return []

    # Optionally narrow to a single program
    if program_id is not None:
        try:
            filter_pid = _uuid.UUID(program_id)
        except ValueError as exc:
            raise BadRequestException("Invalid program_id") from exc
        if filter_pid not in program_ids:
            raise NotFoundException("Program not found")
        program_ids = [filter_pid]

    # Fetch matching programs with their milestones
    prog_result = await db.execute(
        select(Program)
        .options(selectinload(Program.milestones))
        .where(Program.id.in_(program_ids))
        .order_by(Program.created_at.desc())
    )
    programs = list(prog_result.scalars().all())

    result: list[CalendarMilestone] = []
    for prog in programs:
        for m in prog.milestones or []:
            if upcoming_only and m.status in ("completed", "cancelled"):
                continue
            due_date_str: str | None = None
            if m.due_date is not None:
                due_date_str = m.due_date.isoformat()
            result.append(
                CalendarMilestone(
                    id=m.id,
                    title=m.title,
                    description=m.description,
                    due_date=due_date_str,
                    status=str(m.status),
                    position=m.position,
                    program_id=prog.id,
                    program_title=prog.title,
                    program_status=str(prog.status),
                )
            )

    # Sort by due_date (nulls last), then by position
    result.sort(
        key=lambda x: (
            x.due_date is None,
            x.due_date or "",
            x.position,
        )
    )
    return result


# ── Decision History Archive Endpoints ───────────────────────────────────────


class DecisionHistoryItem(BaseModel):
    """A resolved decision for the client history archive."""

    id: _uuid.UUID
    title: str
    prompt: str
    response_type: str
    options: list[dict[str, object]] | None = None
    deadline_date: date | None = None
    deadline_time: str | None = None
    consequence_text: str | None = None
    status: str
    response: dict[str, object] | None = None
    responded_at: datetime | None = None
    program_id: _uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DecisionHistoryResponse(BaseModel):
    decisions: list[DecisionHistoryItem]
    total: int


async def _get_client_profile_id(db: DB, current_user: CurrentUser) -> _uuid.UUID | None:
    """Return the ClientProfile.id for the current portal user."""
    result = await db.execute(
        select(ClientProfile.id).where(ClientProfile.user_id == current_user.id)
    )
    return result.scalar_one_or_none()


def _build_decision_history_query(
    profile_id: _uuid.UUID,
    status: str | None,
    program_id: _uuid.UUID | None,
    date_from: date | None,
    date_to: date | None,
    search: str | None,
    history_only: bool = True,
) -> Select[tuple[DecisionRequestModel]]:
    """Build a filtered select query for decision history."""
    q = select(DecisionRequestModel).where(
        DecisionRequestModel.client_id == profile_id
    )

    if history_only:
        q = q.where(DecisionRequestModel.status != "pending")

    if status:
        q = q.where(DecisionRequestModel.status == status)

    if program_id:
        q = q.where(DecisionRequestModel.program_id == program_id)

    if date_from:
        from_dt = datetime.combine(date_from, datetime.min.time())
        q = q.where(DecisionRequestModel.created_at >= from_dt)

    if date_to:
        to_dt = datetime.combine(date_to, datetime.max.time())
        q = q.where(DecisionRequestModel.created_at <= to_dt)

    if search:
        q = q.where(DecisionRequestModel.title.ilike(f"%{search}%"))

    return q


@router.get(
    "/decisions/history",
    response_model=DecisionHistoryResponse,
    dependencies=[Depends(require_client)],
)
async def get_my_decision_history(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    status: str | None = Query(None, description="responded | declined | expired | cancelled"),
    program_id: _uuid.UUID | None = Query(None, description="Filter by program"),
    date_from: date | None = Query(None, description="Inclusive start date"),
    date_to: date | None = Query(None, description="Inclusive end date"),
    search: str | None = Query(None, description="Search by title"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> DecisionHistoryResponse:
    """Return the client's resolved decision history with filtering and pagination.

    Returns all non-pending decisions (responded, declined, expired, cancelled)
    for the authenticated portal user.
    """
    profile_id = await _get_client_profile_id(db, current_user)
    if not profile_id:
        return DecisionHistoryResponse(decisions=[], total=0)

    base_q = _build_decision_history_query(
        profile_id=profile_id,
        status=status,
        program_id=program_id,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )

    count_q = select(func.count()).select_from(base_q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    data_q = base_q.order_by(
        DecisionRequestModel.responded_at.desc().nullslast(),
        DecisionRequestModel.created_at.desc(),
    )
    result = await db.execute(data_q.offset(skip).limit(limit))
    decisions = list(result.scalars().all())

    return DecisionHistoryResponse(
        decisions=[DecisionHistoryItem.model_validate(d) for d in decisions],
        total=total,
    )


@router.get(
    "/decisions/history/export",
    dependencies=[Depends(require_client)],
)
async def export_my_decision_history(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    status: str | None = Query(None),
    program_id: _uuid.UUID | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    search: str | None = Query(None),
    format: str = Query("csv", pattern="^(csv|xlsx)$"),  # noqa: A002
) -> StreamingResponse:
    """Export the client's decision history as CSV or XLSX.

    Supports the same filters as the list endpoint.
    """
    profile_id = await _get_client_profile_id(db, current_user)
    if not profile_id:
        data: list[DecisionRequestModel] = []
    else:
        base_q = _build_decision_history_query(
            profile_id=profile_id,
            status=status,
            program_id=program_id,
            date_from=date_from,
            date_to=date_to,
            search=search,
        )
        result = await db.execute(
            base_q.order_by(
                DecisionRequestModel.responded_at.desc().nullslast(),
                DecisionRequestModel.created_at.desc(),
            ).limit(5000)
        )
        data = list(result.scalars().all())

    headers = [
        "Title",
        "Status",
        "Response Type",
        "Your Response",
        "Responded At",
        "Deadline",
        "Program ID",
        "Created At",
    ]

    def _format_response(d: DecisionRequestModel) -> str:
        if not d.response:
            return ""
        r = d.response
        if r.get("option_id"):
            # Find label from options
            label = r["option_id"]
            if d.options:
                for opt in d.options:
                    if opt.get("id") == r["option_id"]:
                        label = opt.get("label", r["option_id"])
                        break
            return str(label)
        return str(r.get("text", ""))

    rows: list[list[object]] = [
        [
            d.title,
            str(d.status),
            str(d.response_type),
            _format_response(d),
            d.responded_at.isoformat() if d.responded_at else "",
            str(d.deadline_date) if d.deadline_date else "",
            str(d.program_id) if d.program_id else "",
            d.created_at.isoformat() if d.created_at else "",
        ]
        for d in data
    ]

    timestamp = datetime.now().strftime("%Y%m%d")
    filename = f"decision-history-{timestamp}"

    if format == "xlsx":
        return _decision_xlsx_response(headers, rows, filename)
    return _decision_csv_response(headers, rows, filename)


def _decision_csv_response(
    headers: list[str], rows: list[list[object]], filename: str
) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )


def _escape_xml(value: object) -> str:
    s = "" if value is None else str(value)
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _decision_xlsx_response(
    headers: list[str], rows: list[list[object]], filename: str
) -> StreamingResponse:
    def cell(v: object) -> str:
        return f'<Cell><Data ss:Type="String">{_escape_xml(v)}</Data></Cell>'

    def make_row(cells: list[str], style: str = "") -> str:
        attr = f' ss:StyleID="{style}"' if style else ""
        return f"<Row{attr}>{''.join(cells)}</Row>"

    header_row = make_row([cell(h) for h in headers], "header")
    data_rows = [make_row([cell(v) for v in r]) for r in rows]

    xlsx = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<?mso-application progid="Excel.Sheet"?>\n'
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n'
        '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n'
        "  <Styles>\n"
        '    <Style ss:ID="header"><Font ss:Bold="1"/></Style>\n'
        "  </Styles>\n"
        '  <Worksheet ss:Name="Decision History">\n'
        "    <Table>\n"
        f"      {header_row}\n"
        + "".join(f"      {r}\n" for r in data_rows)
        + "    </Table>\n"
        "  </Worksheet>\n"
        "</Workbook>"
    )

    return StreamingResponse(
        iter([xlsx]),
        media_type="application/vnd.ms-excel",
        headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
    )
