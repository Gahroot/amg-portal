"""Service for document request operations."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_request import DocumentRequest
from app.models.enums import DocumentRequestStatus
from app.schemas.document_request import (
    DocumentRequestCreate,
    DocumentRequestTransition,
    DocumentRequestUpdate,
)

logger = logging.getLogger(__name__)


async def create_document_request(
    db: AsyncSession,
    data: DocumentRequestCreate,
    requested_by: UUID,
) -> DocumentRequest:
    """Create a new document request and notify the client."""
    now = datetime.now(UTC)
    req = DocumentRequest(
        client_id=data.client_id,
        requested_by=requested_by,
        document_type=data.document_type,
        title=data.title,
        description=data.description,
        message=data.message,
        deadline=data.deadline,
        status=DocumentRequestStatus.pending,
        requested_at=now,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    # Notify the client (best-effort)
    await _notify_client_new_request(db, req)

    return req


async def _notify_client_new_request(
    db: AsyncSession,
    req: DocumentRequest,
) -> None:
    """Send in-portal notification + email to the client for a new request."""
    try:
        from app.models.client_profile import ClientProfile
        from app.models.user import User
        from app.schemas.notification import CreateNotificationRequest
        from app.services.notification_service import notification_service

        # Resolve the client's user account
        profile_result = await db.execute(
            select(ClientProfile).where(ClientProfile.id == req.client_id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            return

        user_result = await db.execute(
            select(User).where(User.id == profile.user_id)
        )
        client_user = user_result.scalar_one_or_none()
        if not client_user:
            return

        deadline_str = (
            req.deadline.strftime("%d %B %Y") if req.deadline else "as soon as possible"
        )
        body = (
            f"Please upload your {req.title}."
            + (f" Deadline: {deadline_str}." if req.deadline else "")
            + (f" {req.message}" if req.message else "")
        )

        notif = CreateNotificationRequest(
            user_id=client_user.id,
            notification_type="system",
            title=f"Document requested: {req.title}",
            body=body,
            entity_type="document_request",
            entity_id=req.id,
            priority="normal",
            action_url="/portal/documents/requests",
            action_label="View Request",
        )
        await notification_service.create_notification(db, notif)
    except Exception:
        logger.exception("Failed to notify client for document request %s", req.id)


async def get_document_request(
    db: AsyncSession,
    request_id: UUID,
) -> DocumentRequest | None:
    """Fetch a single document request by ID."""
    result = await db.execute(
        select(DocumentRequest).where(DocumentRequest.id == request_id)
    )
    return result.scalar_one_or_none()


async def list_document_requests(
    db: AsyncSession,
    client_id: UUID | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[DocumentRequest], int]:
    """List document requests with optional filters."""
    filters = []
    if client_id:
        filters.append(DocumentRequest.client_id == client_id)
    if status:
        filters.append(DocumentRequest.status == status)

    count_q = select(func.count()).select_from(DocumentRequest).where(*filters)
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        select(DocumentRequest)
        .where(*filters)
        .order_by(DocumentRequest.requested_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def list_requests_for_client_user(
    db: AsyncSession,
    user_id: UUID,
    status: str | None = None,
) -> list[DocumentRequest]:
    """Return document requests visible to a client portal user."""
    from app.models.client_profile import ClientProfile

    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return []

    filters = [DocumentRequest.client_id == profile.id]
    if status:
        filters.append(DocumentRequest.status == status)

    query = (
        select(DocumentRequest)
        .where(*filters)
        .order_by(DocumentRequest.requested_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_document_request(
    db: AsyncSession,
    request_id: UUID,
    data: DocumentRequestUpdate,
) -> DocumentRequest | None:
    """Update a document request."""
    req = await get_document_request(db, request_id)
    if not req:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(req, field, value)

    await db.commit()
    await db.refresh(req)
    return req


async def cancel_document_request(
    db: AsyncSession,
    request_id: UUID,
) -> DocumentRequest | None:
    """Cancel a pending document request."""
    req = await get_document_request(db, request_id)
    if not req:
        return None

    if req.status not in (DocumentRequestStatus.pending, DocumentRequestStatus.overdue):
        return req  # Already in a terminal state

    req.status = DocumentRequestStatus.cancelled
    await db.commit()
    await db.refresh(req)
    return req


async def fulfill_document_request(
    db: AsyncSession,
    request_id: UUID,
    document_id: UUID,
) -> DocumentRequest | None:
    """Mark a request as fulfilled with the uploaded document."""
    req = await get_document_request(db, request_id)
    if not req:
        return None

    now = datetime.now(UTC)
    req.status = DocumentRequestStatus.received
    req.received_at = now
    req.fulfilled_document_id = document_id
    await db.commit()
    await db.refresh(req)

    # Notify the requester
    await _notify_requester_fulfilled(db, req)

    return req


async def _notify_requester_fulfilled(
    db: AsyncSession,
    req: DocumentRequest,
) -> None:
    """Notify the internal requester that the client fulfilled the request."""
    try:
        from app.schemas.notification import CreateNotificationRequest
        from app.services.notification_service import notification_service

        notif = CreateNotificationRequest(
            user_id=req.requested_by,
            notification_type="system",
            title=f"Document received: {req.title}",
            body=f"The client has uploaded the requested document '{req.title}'.",
            entity_type="document_request",
            entity_id=req.id,
            priority="normal",
            action_url="/clients",
            action_label="View Documents",
        )
        await notification_service.create_notification(db, notif)
    except Exception:
        logger.exception("Failed to notify requester for document request %s", req.id)


async def send_reminder(
    db: AsyncSession,
    request_id: UUID,
) -> DocumentRequest | None:
    """Send a reminder notification for an overdue or pending request."""
    req = await get_document_request(db, request_id)
    if not req:
        return None

    if req.status not in (DocumentRequestStatus.pending, DocumentRequestStatus.overdue):
        return req

    # Mark as overdue if past deadline
    if req.deadline and req.deadline < datetime.now(UTC):
        req.status = DocumentRequestStatus.overdue
        await db.commit()
        await db.refresh(req)

    await _notify_client_new_request(db, req)
    return req


async def mark_overdue_requests(db: AsyncSession) -> int:
    """Scan pending requests past their deadline and mark them overdue. Returns count updated."""
    now = datetime.now(UTC)
    result = await db.execute(
        select(DocumentRequest).where(
            DocumentRequest.status == DocumentRequestStatus.pending,
            DocumentRequest.deadline < now,
        )
    )
    overdue = result.scalars().all()
    for req in overdue:
        req.status = DocumentRequestStatus.overdue

    if overdue:
        await db.commit()

    return len(overdue)


# ── Status transition map ─────────────────────────────────────────────────────

_VALID_TRANSITIONS: dict[DocumentRequestStatus, set[DocumentRequestStatus]] = {
    DocumentRequestStatus.pending: {
        DocumentRequestStatus.in_progress,
        DocumentRequestStatus.cancelled,
        DocumentRequestStatus.overdue,
    },
    DocumentRequestStatus.overdue: {
        DocumentRequestStatus.in_progress,
        DocumentRequestStatus.cancelled,
    },
    DocumentRequestStatus.in_progress: {
        DocumentRequestStatus.received,
        DocumentRequestStatus.cancelled,
    },
    DocumentRequestStatus.received: {
        DocumentRequestStatus.processing,
        DocumentRequestStatus.cancelled,
    },
    DocumentRequestStatus.processing: {
        DocumentRequestStatus.complete,
        DocumentRequestStatus.cancelled,
    },
    DocumentRequestStatus.complete: set(),
    DocumentRequestStatus.cancelled: set(),
}

_STATUS_TIMESTAMP_FIELD: dict[DocumentRequestStatus, str] = {
    DocumentRequestStatus.in_progress: "in_progress_at",
    DocumentRequestStatus.received: "received_at",
    DocumentRequestStatus.processing: "processing_at",
    DocumentRequestStatus.complete: "completed_at",
    DocumentRequestStatus.cancelled: "cancelled_at",
}


async def transition_document_request(
    db: AsyncSession,
    request_id: UUID,
    data: DocumentRequestTransition,
    notify_client: bool = True,
) -> DocumentRequest | None:
    """Transition a document request to a new status (staff action).

    Validates the transition is permitted, sets the appropriate timestamp,
    and optionally sends a notification to the client.
    """
    req = await get_document_request(db, request_id)
    if not req:
        return None

    try:
        current = DocumentRequestStatus(req.status)
        target = DocumentRequestStatus(data.status)
    except ValueError:
        return None

    if target not in _VALID_TRANSITIONS.get(current, set()):
        return None

    now = datetime.now(UTC)
    req.status = target

    ts_field = _STATUS_TIMESTAMP_FIELD.get(target)
    if ts_field:
        setattr(req, ts_field, now)

    if data.rm_notes is not None:
        req.rm_notes = data.rm_notes

    if data.estimated_completion is not None:
        req.estimated_completion = data.estimated_completion

    await db.commit()
    await db.refresh(req)

    if notify_client:
        await _notify_client_status_change(db, req, target)

    return req


async def _notify_client_status_change(
    db: AsyncSession,
    req: DocumentRequest,
    new_status: DocumentRequestStatus,
) -> None:
    """Notify the client when a request status changes."""
    try:
        from app.models.client_profile import ClientProfile
        from app.models.user import User
        from app.schemas.notification import CreateNotificationRequest
        from app.services.notification_service import notification_service

        profile_result = await db.execute(
            select(ClientProfile).where(ClientProfile.id == req.client_id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            return

        user_result = await db.execute(
            select(User).where(User.id == profile.user_id)
        )
        client_user = user_result.scalar_one_or_none()
        if not client_user:
            return

        status_messages: dict[DocumentRequestStatus, tuple[str, str]] = {
            DocumentRequestStatus.in_progress: (
                f"Request in progress: {req.title}",
                "Your document request is now being processed by our team.",
            ),
            DocumentRequestStatus.processing: (
                f"Document under review: {req.title}",
                "We have received your document and are reviewing it.",
            ),
            DocumentRequestStatus.complete: (
                f"Request complete: {req.title}",
                "Your document request has been completed successfully.",
            ),
            DocumentRequestStatus.cancelled: (
                f"Request cancelled: {req.title}",
                "Your document request has been cancelled.",
            ),
        }

        msg = status_messages.get(new_status)
        if not msg:
            return

        title, body = msg
        if req.rm_notes:
            body += f" Note: {req.rm_notes}"

        notif = CreateNotificationRequest(
            user_id=client_user.id,
            notification_type="system",
            title=title,
            body=body,
            entity_type="document_request",
            entity_id=req.id,
            priority="normal",
            action_url="/portal/documents/requests",
            action_label="View Request",
        )
        await notification_service.create_notification(db, notif)
    except Exception:
        logger.exception("Failed to notify client for status change on request %s", req.id)


async def cancel_document_request_by_client(
    db: AsyncSession,
    request_id: UUID,
    client_user_id: UUID,
) -> DocumentRequest | None:
    """Allow a client to cancel their own pending document request."""
    from app.models.client_profile import ClientProfile

    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == client_user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return None

    req = await get_document_request(db, request_id)
    if not req or req.client_id != profile.id:
        return None

    if req.status not in (DocumentRequestStatus.pending, DocumentRequestStatus.overdue):
        return None

    now = datetime.now(UTC)
    req.status = DocumentRequestStatus.cancelled
    req.cancelled_at = now
    await db.commit()
    await db.refresh(req)
    return req


async def add_client_note(
    db: AsyncSession,
    request_id: UUID,
    client_user_id: UUID,
    note: str,
) -> DocumentRequest | None:
    """Allow a client to add a note to their document request."""
    from app.models.client_profile import ClientProfile

    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == client_user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return None

    req = await get_document_request(db, request_id)
    if not req or req.client_id != profile.id:
        return None

    req.client_notes = note
    await db.commit()
    await db.refresh(req)
    return req
