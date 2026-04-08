"""Service for document expiry tracking and notifications."""

import contextlib
import logging
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.enums import ExpiryStatus
from app.schemas.document import ExpiringDocumentResponse, ExpiringDocumentsResponse
from app.schemas.notification import CreateNotificationRequest
from app.services.notification_service import notification_service
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

# Days-before-expiry milestones at which we alert
ALERT_THRESHOLDS = [90, 30, 0]

# Document types that support expiry tracking
EXPIRY_DOCUMENT_TYPES = {"passport", "visa", "certification"}


def compute_expiry_status(expiry_date: date) -> ExpiryStatus:
    """Return the expiry urgency bucket for the given date."""
    today = datetime.now(UTC).date()
    days = (expiry_date - today).days
    if days < 0:
        return ExpiryStatus.expired
    if days <= 30:
        return ExpiryStatus.expiring_30
    if days <= 90:
        return ExpiryStatus.expiring_90
    return ExpiryStatus.valid


def _build_download_url(doc: Document) -> str | None:
    if not doc.file_path:
        return None
    with contextlib.suppress(Exception):
        return storage_service.get_presigned_url(str(doc.file_path))
    return None


def _build_expiring_response(doc: Document) -> ExpiringDocumentResponse:
    today = datetime.now(UTC).date()
    expiry_date: date = doc.expiry_date  # type: ignore[assignment]
    days_until = (expiry_date - today).days
    status = compute_expiry_status(expiry_date)
    data: dict[str, object] = {
        "id": doc.id,
        "file_name": doc.file_name,
        "file_size": doc.file_size,
        "entity_type": doc.entity_type,
        "entity_id": doc.entity_id,
        "category": doc.category,
        "description": doc.description,
        "document_type": doc.document_type,
        "expiry_date": expiry_date,
        "expiry_status": status.value,
        "days_until_expiry": days_until,
        "uploaded_by": doc.uploaded_by,
        "created_at": doc.created_at,
        "download_url": _build_download_url(doc),
    }
    return ExpiringDocumentResponse.model_validate(data)


async def list_expiring_documents(
    db: AsyncSession,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> ExpiringDocumentsResponse:
    """Return all documents with expiry dates within the next 90 days or already expired."""
    today = datetime.now(UTC).date()
    cutoff = today + timedelta(days=90)

    filters = [
        Document.expiry_date.isnot(None),
        Document.expiry_date <= cutoff,
    ]
    if entity_type:
        filters.append(Document.entity_type == entity_type)
    if entity_id:
        filters.append(Document.entity_id == entity_id)

    base_query = select(Document).where(and_(*filters))

    # Apply optional status filter as an additional SQL predicate when possible.
    # ExpiryStatus is computed from expiry_date, so we translate the filter back to SQL.
    if status_filter:
        today = datetime.now(UTC).date()
        if status_filter == ExpiryStatus.expired.value:
            base_query = base_query.where(Document.expiry_date < today)
        elif status_filter == ExpiryStatus.expiring_30.value:
            base_query = base_query.where(
                Document.expiry_date >= today,
                Document.expiry_date <= today + timedelta(days=30),
            )
        elif status_filter == ExpiryStatus.expiring_90.value:
            base_query = base_query.where(
                Document.expiry_date > today + timedelta(days=30),
                Document.expiry_date <= cutoff,
            )
        # ExpiryStatus.valid would be > cutoff, but our top-level filter already caps at cutoff,
        # so "valid" returns nothing — leave as-is.

    # Total count before pagination
    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    # Fetch only the requested page
    result = await db.execute(
        base_query.order_by(Document.expiry_date.asc()).offset(skip).limit(limit)
    )
    page_docs = list(result.scalars().all())

    # Build responses for the page
    paginated = [_build_expiring_response(d) for d in page_docs]

    # Counts over the full (unfiltered-by-status) result set using SQL aggregates
    expired_count_result = await db.execute(
        select(func.count()).where(
            and_(*filters),
            Document.expiry_date < today,
        )
    )
    expired_count = expired_count_result.scalar_one()

    expiring_30_count_result = await db.execute(
        select(func.count()).where(
            and_(*filters),
            Document.expiry_date >= today,
            Document.expiry_date <= today + timedelta(days=30),
        )
    )
    expiring_30_count = expiring_30_count_result.scalar_one()

    expiring_90_count_result = await db.execute(
        select(func.count()).where(
            and_(*filters),
            Document.expiry_date > today + timedelta(days=30),
            Document.expiry_date <= cutoff,
        )
    )
    expiring_90_count = expiring_90_count_result.scalar_one()

    return ExpiringDocumentsResponse(
        documents=paginated,
        total=total,
        expired_count=expired_count,
        expiring_30_count=expiring_30_count,
        expiring_90_count=expiring_90_count,
    )


async def check_and_send_expiry_alerts(db: AsyncSession) -> int:
    """Daily job: send alerts for documents approaching expiry.

    Sends notifications at 90-day, 30-day, and 0-day (expiry day) thresholds.
    Tracks which alerts have already been sent in `expiry_alert_sent` JSON list.

    Returns the number of notifications dispatched.
    """
    today = datetime.now(UTC).date()
    cutoff = today + timedelta(days=90)

    result = await db.execute(
        select(Document).where(
            Document.expiry_date.isnot(None),
            Document.expiry_date <= cutoff,
        )
    )
    docs = list(result.scalars().all())

    # Batch-load RM IDs for all client-type documents in one query
    from app.models.client import Client

    client_entity_ids = [doc.entity_id for doc in docs if doc.entity_type == "client"]
    rm_map: dict[object, UUID] = {}
    if client_entity_ids:
        rm_result = await db.execute(
            select(Client.id, Client.rm_id).where(Client.id.in_(client_entity_ids))
        )
        rm_map = {row.id: row.rm_id for row in rm_result.all() if row.rm_id is not None}

    notifications_sent = 0

    for doc in docs:
        expiry_date: date = doc.expiry_date  # type: ignore[assignment]
        days_until = (expiry_date - today).days
        sent_thresholds: list[int] = list(doc.expiry_alert_sent or [])

        # Determine which threshold we're at or past
        for threshold in ALERT_THRESHOLDS:
            if days_until <= threshold and threshold not in sent_thresholds:
                # Resolve RM from pre-loaded map
                rm_id = rm_map.get(doc.entity_id) if doc.entity_type == "client" else None
                if rm_id is None:
                    logger.debug(
                        "No RM found for document %s (entity_type=%s, entity_id=%s) — skipping",
                        doc.id,
                        doc.entity_type,
                        doc.entity_id,
                    )
                    # Still mark as sent to avoid repeated lookups
                    sent_thresholds.append(threshold)
                    continue

                title, body = _build_alert_message(doc, days_until, threshold)
                priority = "urgent" if threshold == 0 or days_until < 0 else "high"

                doc_id: UUID = doc.id  # type: ignore[assignment]
                await notification_service.create_notification(
                    db,
                    CreateNotificationRequest(
                        user_id=rm_id,
                        notification_type="system",
                        title=title,
                        body=body,
                        priority=priority,
                        entity_type="document",
                        entity_id=doc_id,
                    ),
                )
                sent_thresholds.append(threshold)
                notifications_sent += 1
                logger.info(
                    "Sent %d-day expiry alert for document %s (%s) to RM %s",
                    threshold,
                    doc.id,
                    doc.file_name,
                    rm_id,
                )

        if sent_thresholds != list(doc.expiry_alert_sent or []):
            doc.expiry_alert_sent = sent_thresholds  # type: ignore[assignment]

    await db.commit()
    return notifications_sent


def _build_alert_message(
    doc: Document,
    days_until: int,
    threshold: int,
) -> tuple[str, str]:
    """Build notification title and body for an expiry alert."""
    doc_type_label = (doc.document_type or "document").replace("_", " ").title()
    file_label = doc.file_name

    if days_until < 0:
        days_ago = abs(days_until)
        day_s = "s" if days_ago != 1 else ""
        title = f"Expired: {doc_type_label} — {file_label}"
        body = (
            f"The {doc_type_label} '{file_label}' expired "
            f"{days_ago} day{day_s} ago "
            f"(expiry date: {doc.expiry_date}). "
            "Please arrange renewal immediately."
        )
    elif days_until == 0:
        title = f"Expires Today: {doc_type_label} — {file_label}"
        body = (
            f"The {doc_type_label} '{file_label}' expires "
            f"today ({doc.expiry_date}). "
            "Please arrange renewal urgently."
        )
    elif threshold == 30:
        day_s = "s" if days_until != 1 else ""
        title = f"Expiring in 30 days: {doc_type_label} — {file_label}"
        body = (
            f"The {doc_type_label} '{file_label}' will expire "
            f"in {days_until} day{day_s} "
            f"(expiry date: {doc.expiry_date}). "
            "Please arrange renewal soon."
        )
    else:
        day_s = "s" if days_until != 1 else ""
        title = f"Expiring in 90 days: {doc_type_label} — {file_label}"
        body = (
            f"The {doc_type_label} '{file_label}' will expire "
            f"in {days_until} day{day_s} "
            f"(expiry date: {doc.expiry_date}). "
            "Please plan for renewal."
        )

    return title, body
