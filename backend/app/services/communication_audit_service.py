"""Service layer for communication audit trail operations."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client_profile import ClientProfile
from app.models.communication_audit import CommunicationAudit
from app.models.user import User


async def log_communication_event(
    db: AsyncSession,
    *,
    communication_id: uuid.UUID | None = None,
    conversation_id: uuid.UUID | None = None,
    action: str,
    actor_id: uuid.UUID,
    details: dict[str, Any] | None = None,
    request: Request | None = None,
) -> CommunicationAudit:
    """Create an audit trail entry for a communication event."""
    ip_address: str | None = None
    user_agent: str | None = None
    if request is not None:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    audit = CommunicationAudit(
        communication_id=communication_id,
        conversation_id=conversation_id,
        action=action,
        actor_id=actor_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(audit)
    return audit


async def get_communication_audit_trail(
    db: AsyncSession,
    communication_id: uuid.UUID,
    *,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    """Get full audit trail for a specific communication."""
    base = select(CommunicationAudit).where(
        CommunicationAudit.communication_id == communication_id,
    )
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        base.order_by(CommunicationAudit.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    audits = result.scalars().all()

    items: list[dict[str, Any]] = []
    for a in audits:
        actor_name: str | None = None
        actor_email: str | None = None
        if a.actor_id:
            actor_result = await db.execute(
                select(User.full_name, User.email).where(User.id == a.actor_id)
            )
            row = actor_result.first()
            if row:
                actor_name = row.full_name
                actor_email = row.email
        items.append(
            {
                "id": a.id,
                "communication_id": a.communication_id,
                "conversation_id": a.conversation_id,
                "action": a.action,
                "actor_id": a.actor_id,
                "actor_name": actor_name,
                "actor_email": actor_email,
                "details": a.details,
                "ip_address": a.ip_address,
                "user_agent": a.user_agent,
                "created_at": a.created_at,
            }
        )
    return items, int(total)


async def get_user_audit_trail(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    """Get audit trail for a specific user's actions."""
    base = select(CommunicationAudit).where(
        CommunicationAudit.actor_id == user_id,
    )
    if start:
        base = base.where(CommunicationAudit.created_at >= start)
    if end:
        base = base.where(CommunicationAudit.created_at <= end)

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        base.order_by(CommunicationAudit.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    audits = result.scalars().all()

    items: list[dict[str, Any]] = []
    for a in audits:
        items.append(
            {
                "id": a.id,
                "communication_id": a.communication_id,
                "conversation_id": a.conversation_id,
                "action": a.action,
                "actor_id": a.actor_id,
                "details": a.details,
                "ip_address": a.ip_address,
                "user_agent": a.user_agent,
                "created_at": a.created_at,
            }
        )
    return items, int(total)


async def search_communication_audits(
    db: AsyncSession,
    *,
    action: str | None = None,
    actor_id: uuid.UUID | None = None,
    communication_id: uuid.UUID | None = None,
    conversation_id: uuid.UUID | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    """Search/filter communication audit entries."""
    base = select(CommunicationAudit)
    if action:
        base = base.where(CommunicationAudit.action == action)
    if actor_id:
        base = base.where(CommunicationAudit.actor_id == actor_id)
    if communication_id:
        base = base.where(CommunicationAudit.communication_id == communication_id)
    if conversation_id:
        base = base.where(CommunicationAudit.conversation_id == conversation_id)
    if start_date:
        base = base.where(CommunicationAudit.created_at >= start_date)
    if end_date:
        base = base.where(CommunicationAudit.created_at <= end_date)

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        base.order_by(CommunicationAudit.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    audits = result.scalars().all()

    items: list[dict[str, Any]] = []
    for a in audits:
        actor_name: str | None = None
        actor_email: str | None = None
        if a.actor_id:
            actor_result = await db.execute(
                select(User.full_name, User.email).where(User.id == a.actor_id)
            )
            row = actor_result.first()
            if row:
                actor_name = row.full_name
                actor_email = row.email
        items.append(
            {
                "id": a.id,
                "communication_id": a.communication_id,
                "conversation_id": a.conversation_id,
                "action": a.action,
                "actor_id": a.actor_id,
                "actor_name": actor_name,
                "actor_email": actor_email,
                "details": a.details,
                "ip_address": a.ip_address,
                "user_agent": a.user_agent,
                "created_at": a.created_at,
            }
        )
    return items, int(total)


async def enforce_client_preferences(
    db: AsyncSession,
    client_id: uuid.UUID,
    channel: str,
) -> tuple[bool, str | None]:
    """Check if communication via the given channel is allowed per client preferences.

    Returns (allowed, reason_if_blocked).
    """
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == client_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return False, "Client profile not found"

    if profile.do_not_contact:
        return False, "Client has requested no contact (do_not_contact is enabled)"

    if profile.preferred_channels and channel not in profile.preferred_channels:
        allowed_str = ", ".join(profile.preferred_channels)
        return (
            False,
            f"Channel '{channel}' not in client preferred channels: {allowed_str}",
        )

    return True, None
