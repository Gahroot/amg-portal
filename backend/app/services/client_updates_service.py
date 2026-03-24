"""Service for client 'What's New' feed — aggregates recent updates across programs."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.client_profile import ClientProfile
from app.models.communication import Communication
from app.models.decision_request import DecisionRequest
from app.models.document_delivery import DocumentDelivery
from app.models.milestone import Milestone
from app.models.notification_preference import NotificationPreference
from app.models.program import Program

# ─── Types ────────────────────────────────────────────────────────────────────

# One of: program_status | milestone_completed | document_delivered
#       | message_received | decision_resolved
UpdateType = str

VALID_UPDATE_TYPES: set[str] = {
    "program_status",
    "milestone_completed",
    "document_delivered",
    "message_received",
    "decision_resolved",
}


class FeedItem:
    """A single item in the What's New feed."""

    __slots__ = (
        "id",
        "update_type",
        "title",
        "description",
        "program_id",
        "program_title",
        "timestamp",
        "link",
        "is_read",
        "extra",
    )

    def __init__(
        self,
        *,
        id: str,
        update_type: str,
        title: str,
        description: str,
        program_id: str | None,
        program_title: str | None,
        timestamp: datetime,
        link: str,
        is_read: bool,
        extra: dict[str, Any] | None = None,
    ) -> None:
        self.id = id
        self.update_type = update_type
        self.title = title
        self.description = description
        self.program_id = program_id
        self.program_title = program_title
        self.timestamp = timestamp
        self.link = link
        self.is_read = is_read
        self.extra = extra or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "update_type": self.update_type,
            "title": self.title,
            "description": self.description,
            "program_id": self.program_id,
            "program_title": self.program_title,
            "timestamp": self.timestamp.isoformat(),
            "link": self.link,
            "is_read": self.is_read,
        }


# ─── Internal helpers ─────────────────────────────────────────────────────────

_STATUS_LABELS: dict[str, str] = {
    "intake": "Intake",
    "design": "Design",
    "active": "Active",
    "on_hold": "On Hold",
    "completed": "Completed",
    "closed": "Closed",
    "archived": "Archived",
}


def _status_label(status: str) -> str:
    return _STATUS_LABELS.get(status, status.replace("_", " ").title())


async def _get_last_read_at(
    db: AsyncSession, user_id: uuid.UUID
) -> datetime | None:
    """Return the timestamp stored when the user last marked all updates as read."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
    )
    prefs = result.scalar_one_or_none()
    if not prefs or not prefs.notification_type_preferences:
        return None
    raw = prefs.notification_type_preferences.get("updates_last_read_at")
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
        return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    except ValueError:
        return None


async def _set_last_read_at(
    db: AsyncSession, user_id: uuid.UUID, ts: datetime
) -> None:
    """Persist the last-read timestamp in the user's notification preferences."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = NotificationPreference(user_id=user_id)
        db.add(prefs)
        await db.flush()

    existing: dict[str, Any] = dict(prefs.notification_type_preferences or {})
    existing["updates_last_read_at"] = ts.isoformat()
    prefs.notification_type_preferences = existing
    await db.commit()


async def _resolve_client(
    db: AsyncSession, user_id: uuid.UUID
) -> tuple[ClientProfile | None, Client | None]:
    """Resolve portal user → (ClientProfile, Client)."""
    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return None, None

    client_query = select(Client).where(Client.name == profile.legal_name)
    if profile.assigned_rm_id is not None:
        client_query = client_query.where(Client.rm_id == profile.assigned_rm_id)
    client_result = await db.execute(client_query.limit(1))
    client = client_result.scalar_one_or_none()
    return profile, client


# ─── Feed builders ────────────────────────────────────────────────────────────


async def _collect_program_status_updates(
    db: AsyncSession,
    client_id: uuid.UUID,
    last_read_at: datetime | None,
    program_id_filter: uuid.UUID | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> list[FeedItem]:
    """Emit a feed item whenever a program's status changed (approximated by updated_at)."""
    query = (
        select(Program)
        .where(Program.client_id == client_id)
        .where(Program.status != "intake")  # skip raw-intake (not interesting to client yet)
        .order_by(Program.updated_at.desc())
    )
    if program_id_filter:
        query = query.where(Program.id == program_id_filter)
    if date_from:
        query = query.where(Program.updated_at >= date_from)
    if date_to:
        query = query.where(Program.updated_at <= date_to)

    result = await db.execute(query)
    programs = list(result.scalars().all())

    items: list[FeedItem] = []
    for prog in programs:
        ts = prog.updated_at or prog.created_at
        if not ts:
            continue
        ts = ts if ts.tzinfo else ts.replace(tzinfo=UTC)
        is_read = (last_read_at is not None) and (ts <= last_read_at)
        label = _status_label(prog.status)
        items.append(
            FeedItem(
                id=f"program_status:{prog.id}",
                update_type="program_status",
                title=f"{prog.title} — status updated",
                description=f"Program status is now {label}.",
                program_id=str(prog.id),
                program_title=prog.title,
                timestamp=ts,
                link=f"/portal/programs/{prog.id}",
                is_read=is_read,
            )
        )
    return items


async def _collect_milestone_completions(
    db: AsyncSession,
    client_id: uuid.UUID,
    last_read_at: datetime | None,
    program_id_filter: uuid.UUID | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> list[FeedItem]:
    """Emit a feed item for each completed milestone."""
    query = (
        select(Milestone)
        .options(selectinload(Milestone.program))
        .join(Program, Milestone.program_id == Program.id)
        .where(Program.client_id == client_id)
        .where(Milestone.status == "completed")
        .order_by(Milestone.updated_at.desc())
    )
    if program_id_filter:
        query = query.where(Milestone.program_id == program_id_filter)
    if date_from:
        query = query.where(Milestone.updated_at >= date_from)
    if date_to:
        query = query.where(Milestone.updated_at <= date_to)

    result = await db.execute(query)
    milestones = list(result.scalars().all())

    items: list[FeedItem] = []
    for ms in milestones:
        ts = ms.updated_at or ms.created_at
        if not ts:
            continue
        ts = ts if ts.tzinfo else ts.replace(tzinfo=UTC)
        is_read = (last_read_at is not None) and (ts <= last_read_at)
        prog_title = ms.program.title if ms.program else "Unknown Program"
        prog_id = str(ms.program_id)
        items.append(
            FeedItem(
                id=f"milestone_completed:{ms.id}",
                update_type="milestone_completed",
                title=f"Milestone completed: {ms.title}",
                description=f"A milestone in {prog_title} has been marked complete.",
                program_id=prog_id,
                program_title=prog_title,
                timestamp=ts,
                link=f"/portal/programs/{prog_id}",
                is_read=is_read,
            )
        )
    return items


async def _collect_document_deliveries(
    db: AsyncSession,
    user_id: uuid.UUID,
    last_read_at: datetime | None,
    program_id_filter: uuid.UUID | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> list[FeedItem]:
    """Emit a feed item for each document delivered to the client."""
    query = (
        select(DocumentDelivery)
        .options(selectinload(DocumentDelivery.document))
        .where(DocumentDelivery.recipient_id == user_id)
        .order_by(DocumentDelivery.delivered_at.desc())
    )
    if date_from:
        query = query.where(DocumentDelivery.delivered_at >= date_from)
    if date_to:
        query = query.where(DocumentDelivery.delivered_at <= date_to)

    result = await db.execute(query)
    deliveries = list(result.scalars().all())

    items: list[FeedItem] = []
    for delivery in deliveries:
        doc = delivery.document
        if not doc:
            continue
        ts: datetime | None = delivery.delivered_at  # type: ignore[assignment]
        if not ts:
            continue
        ts = ts if ts.tzinfo else ts.replace(tzinfo=UTC)

        # Skip if program_id filter is set but we can't match
        if program_id_filter and not (
            doc.entity_type == "program" and doc.entity_id == program_id_filter
        ):
            continue

        is_read = (last_read_at is not None) and (ts <= last_read_at)
        file_name = doc.file_name or "Document"
        items.append(
            FeedItem(
                id=f"document_delivered:{delivery.id}",
                update_type="document_delivered",
                title=f"Document delivered: {file_name}",
                description="A new document has been delivered to your portal.",
                program_id=str(doc.entity_id) if doc.entity_type == "program" else None,
                program_title=None,
                timestamp=ts,
                link=f"/portal/documents/{doc.id}",
                is_read=is_read,
            )
        )
    return items


async def _collect_messages_received(
    db: AsyncSession,
    profile_id: uuid.UUID,
    last_read_at: datetime | None,
    program_id_filter: uuid.UUID | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> list[FeedItem]:
    """Emit a feed item for each message sent to the client."""
    from app.models.enums import MessageStatus

    query = (
        select(Communication)
        .where(Communication.client_id == profile_id)
        .where(
            Communication.status.in_(
                [
                    MessageStatus.sent,
                    MessageStatus.delivered,
                    MessageStatus.read,
                ]
            )
        )
        .order_by(Communication.created_at.desc())
    )
    if program_id_filter:
        query = query.where(Communication.program_id == program_id_filter)
    if date_from:
        query = query.where(Communication.created_at >= date_from)
    if date_to:
        query = query.where(Communication.created_at <= date_to)

    result = await db.execute(query)
    comms = list(result.scalars().all())

    items: list[FeedItem] = []
    for comm in comms:
        ts = comm.sent_at or comm.created_at
        if not ts:
            continue
        ts = ts if ts.tzinfo else ts.replace(tzinfo=UTC)
        is_read = (last_read_at is not None) and (ts <= last_read_at)
        subject = comm.subject or "New message from your advisory team"
        items.append(
            FeedItem(
                id=f"message_received:{comm.id}",
                update_type="message_received",
                title=subject,
                description="You have received a new message from your relationship manager.",
                program_id=str(comm.program_id) if comm.program_id else None,
                program_title=None,
                timestamp=ts,
                link="/portal/messages",
                is_read=is_read,
            )
        )
    return items


async def _collect_decisions_resolved(
    db: AsyncSession,
    profile_id: uuid.UUID,
    last_read_at: datetime | None,
    program_id_filter: uuid.UUID | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> list[FeedItem]:
    """Emit a feed item for each decision that has been resolved (responded/declined)."""
    from app.models.enums import DecisionRequestStatus

    query = (
        select(DecisionRequest)
        .where(DecisionRequest.client_id == profile_id)
        .where(
            DecisionRequest.status.in_(
                [DecisionRequestStatus.responded, DecisionRequestStatus.declined]
            )
        )
        .order_by(DecisionRequest.responded_at.desc().nullslast())
    )
    if program_id_filter:
        query = query.where(DecisionRequest.program_id == program_id_filter)
    if date_from:
        query = query.where(DecisionRequest.responded_at >= date_from)
    if date_to:
        query = query.where(DecisionRequest.responded_at <= date_to)

    result = await db.execute(query)
    decisions = list(result.scalars().all())

    items: list[FeedItem] = []
    for decision in decisions:
        ts = decision.responded_at or decision.updated_at or decision.created_at
        if not ts:
            continue
        ts = ts if ts.tzinfo else ts.replace(tzinfo=UTC)
        is_read = (last_read_at is not None) and (ts <= last_read_at)
        action = (
            "responded to" if decision.status == "responded" else "declined"
        )
        items.append(
            FeedItem(
                id=f"decision_resolved:{decision.id}",
                update_type="decision_resolved",
                title=f"Decision {action}: {decision.title}",
                description=f'Your decision request "{decision.title}" has been {action}.',
                program_id=str(decision.program_id) if decision.program_id else None,
                program_title=None,
                timestamp=ts,
                link=f"/portal/decisions/{decision.id}",
                is_read=is_read,
            )
        )
    return items


# ─── Public API ───────────────────────────────────────────────────────────────


async def get_updates(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    update_type: str | None = None,
    program_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[dict[str, Any]], int, int]:
    """Return paginated What's New feed for a portal user.

    Returns (items, total, unread_count).
    """
    profile, client = await _resolve_client(db, user_id)
    if not profile or not client:
        return [], 0, 0

    last_read_at = await _get_last_read_at(db, user_id)

    type_filter = update_type if update_type in VALID_UPDATE_TYPES else None

    # Collect from all sources (only those requested)
    all_items: list[FeedItem] = []

    if not type_filter or type_filter == "program_status":
        all_items.extend(
            await _collect_program_status_updates(
                db, client.id, last_read_at, program_id, date_from, date_to
            )
        )

    if not type_filter or type_filter == "milestone_completed":
        all_items.extend(
            await _collect_milestone_completions(
                db, client.id, last_read_at, program_id, date_from, date_to
            )
        )

    if not type_filter or type_filter == "document_delivered":
        all_items.extend(
            await _collect_document_deliveries(
                db, user_id, last_read_at, program_id, date_from, date_to
            )
        )

    if not type_filter or type_filter == "message_received":
        all_items.extend(
            await _collect_messages_received(
                db, profile.id, last_read_at, program_id, date_from, date_to
            )
        )

    if not type_filter or type_filter == "decision_resolved":
        all_items.extend(
            await _collect_decisions_resolved(
                db, profile.id, last_read_at, program_id, date_from, date_to
            )
        )

    # Sort descending by timestamp
    all_items.sort(key=lambda x: x.timestamp, reverse=True)

    total = len(all_items)
    unread_count = sum(1 for item in all_items if not item.is_read)

    # Paginate
    page = all_items[skip : skip + limit]
    return [item.to_dict() for item in page], total, unread_count


async def get_unread_count(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> int:
    """Return the count of unread updates for a portal user."""
    _, total, unread = await get_updates(db, user_id=user_id, skip=0, limit=10_000)
    return unread


async def mark_all_read(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> None:
    """Mark all updates as read by recording the current timestamp."""
    await _set_last_read_at(db, user_id, datetime.now(UTC))
