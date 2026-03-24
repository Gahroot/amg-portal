"""Communication/message management endpoints."""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, File, Query, UploadFile

from app.api.deps import DB, CurrentUser, RLSContext
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    ValidationException,
)
from app.models.communication import Communication
from app.schemas.communication import (
    AudioUploadResponse,
    CommunicationCreate,
    CommunicationListResponse,
    CommunicationMarkReadRequest,
    CommunicationResponse,
    CommunicationReviewAction,
    SendFromTemplateRequest,
    SendMessageRequest,
    TemplatePreviewRequest,
    TemplatePreviewResponse,
    UnreadCountResponse,
)
from app.schemas.notification import CreateNotificationRequest
from app.services.audio_service import audio_service
from app.services.communication_service import communication_service
from app.services.notification_service import notification_service
from app.services.template_service import template_service

router = APIRouter()


@router.post("/send", response_model=CommunicationResponse)
async def send_communication(
    data: CommunicationCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
):
    """Send a new communication (message)."""
    # Convert to SendMessageRequest for internal handling
    send_data = SendMessageRequest(
        conversation_id=data.conversation_id,
        body=data.body,
        attachment_ids=data.attachment_ids,
    )

    try:
        message = await communication_service.send_message(
            db, sender_id=current_user.id, data=send_data
        )
    except ValueError as e:
        raise ForbiddenException(str(e)) from None

    return message


@router.get("/", response_model=CommunicationListResponse)
async def list_communications(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    conversation_id: uuid.UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List communications, optionally filtered by conversation."""
    if conversation_id:
        messages, total = await communication_service.get_messages_for_conversation(
            db, conversation_id, current_user.id, skip=skip, limit=limit
        )
    else:
        # If no conversation specified, return all user's communications
        # This would need a more complex query filtering by user's conversations
        messages, total = [], 0

    return CommunicationListResponse(communications=messages, total=total)


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
):
    """Get unread message count for current user."""
    counts = await communication_service.get_unread_count(db, current_user.id)
    return UnreadCountResponse(**counts)


@router.post("/mark-read", status_code=204)
async def mark_message_read(
    data: CommunicationMarkReadRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
):
    """Mark a specific message as read."""
    await communication_service.mark_read(db, data.communication_id, current_user.id)


@router.get("/conversations", response_model=CommunicationListResponse)
async def get_conversation_communications(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    conversation_id: uuid.UUID = Query(...),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Get all communications for a specific conversation."""
    messages, total = await communication_service.get_messages_for_conversation(
        db, conversation_id, current_user.id, skip=skip, limit=limit
    )

    return CommunicationListResponse(communications=messages, total=total)


@router.post("/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    data: TemplatePreviewRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> TemplatePreviewResponse:
    """Preview a rendered template with the given variables.

    Returns the rendered subject and body without creating a
    Communication record or sending any notifications.
    """
    try:
        rendered = await template_service.render_template(db, data.template_id, data.variables)
    except ValueError as e:
        raise ValidationException(str(e)) from None

    if rendered is None:
        raise NotFoundException("Template not found")

    return TemplatePreviewResponse(subject=rendered.get("subject"), body=rendered["body"])


@router.post("/send-from-template", response_model=CommunicationResponse)
async def send_from_template(
    data: SendFromTemplateRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> CommunicationResponse:
    """Render a template and send it to the specified recipients.

    Creates a Communication record, logs the template and variables
    used (template_context), and dispatches in-portal notifications
    to each recipient.
    """
    # Fetch and render the template
    template = await template_service.get(db, data.template_id)
    if not template:
        raise NotFoundException("Template not found")

    if not template.is_active:
        raise ValidationException("Template is not active")

    try:
        rendered = await template_service.render_template(db, data.template_id, data.variables)
    except ValueError as e:
        raise ValidationException(str(e)) from None

    if rendered is None:
        raise NotFoundException("Failed to render template")

    subject = rendered.get("subject", "")
    body = rendered["body"]

    # Build recipients map
    recipients_json: dict[str, Any] = {
        str(uid): {"role": "to"} for uid in data.recipient_user_ids
    }

    # Persist Communication record with template provenance
    comm = Communication(
        channel="in_portal",
        status="sent",
        sender_id=current_user.id,
        recipients=recipients_json,
        subject=subject,
        body=body,
        client_id=data.client_id,
        program_id=data.program_id,
        partner_id=data.partner_id,
        template_context={
            "template_id": str(data.template_id),
            "template_type": template.template_type,
            "template_name": template.name,
            "variables": {k: str(v) for k, v in data.variables.items()},
        },
        sent_at=datetime.now(UTC),
    )
    db.add(comm)
    await db.flush()

    # Dispatch in-portal notification to each recipient
    for uid in data.recipient_user_ids:
        notif_request = CreateNotificationRequest(
            user_id=uid,
            notification_type=template.template_type,
            title=subject or template.name,
            body=body,
            entity_type="communication",
            entity_id=comm.id,
            priority="normal",
        )
        await notification_service.create_notification(db, notif_request)

    await db.commit()
    await db.refresh(comm)
    return CommunicationResponse.model_validate(comm)


@router.get("/pending-reviews", response_model=CommunicationListResponse)
async def get_pending_reviews(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Get all communications pending review."""
    messages, total = await communication_service.get_pending_reviews(
        db, skip=skip, limit=limit
    )
    return CommunicationListResponse(communications=messages, total=total)


@router.get("/by-status/{approval_status}", response_model=CommunicationListResponse)
async def get_communications_by_status(
    approval_status: str,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Get communications filtered by approval status."""
    messages, total = await communication_service.get_communications_by_approval_status(
        db, approval_status, skip=skip, limit=limit
    )
    return CommunicationListResponse(communications=messages, total=total)


@router.post("/{communication_id}/submit-review", response_model=CommunicationResponse)
async def submit_for_review(
    communication_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
):
    """Submit a draft communication for review."""
    try:
        communication = await communication_service.submit_for_review(
            db, communication_id, current_user
        )
    except ValueError as e:
        raise BadRequestException(str(e)) from None
    return communication


@router.post("/{communication_id}/review", response_model=CommunicationResponse)
async def review_communication(
    communication_id: uuid.UUID,
    data: CommunicationReviewAction,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
):
    """Approve or reject a communication (requires internal role)."""
    try:
        communication = await communication_service.review_communication(
            db, communication_id, current_user, data.action, data.notes
        )
    except ValueError as e:
        raise BadRequestException(str(e)) from None
    return communication


@router.post("/upload-audio", response_model=AudioUploadResponse)
async def upload_voice_message(
    current_user: CurrentUser,
    _rls: RLSContext,
    file: UploadFile = File(...),
) -> AudioUploadResponse:
    """Upload a voice message audio file to MinIO.

    Returns the storage object path and a short-lived presigned download URL.
    The caller should include the object_path in the message's attachment_ids
    as ``voice:<object_path>`` when sending the message.
    """
    object_path, file_size = await audio_service.upload_voice_message(
        file, str(current_user.id)
    )
    url = audio_service.get_audio_url(object_path)
    return AudioUploadResponse(object_path=object_path, url=url, file_size=file_size)


@router.get("/audio-url")
async def get_audio_url(
    object_path: str,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> dict[str, str]:
    """Return a fresh presigned URL for an existing voice message.

    ``object_path`` must be a path previously returned by ``/upload-audio``.
    """
    url = audio_service.get_audio_url(object_path)
    return {"url": url}
