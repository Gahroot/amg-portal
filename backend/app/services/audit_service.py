"""Semantic audit logging helper.

Complements the generic SQLAlchemy ``after_flush`` listener in
``app.core.audit_listener`` by allowing route handlers to record
domain-level actions (e.g. ``approval_approved``) with the same
``AuditLog`` shape and request context.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit_context import audit_context_var
from app.models.audit_log import AuditLog
from app.models.enums import AuditAction
from app.models.user import User


async def log_action(
    db: AsyncSession,
    *,
    action: AuditAction,
    entity_type: str,
    entity_id: str,
    user: User | None = None,
    before_state: dict[str, object] | None = None,
    after_state: dict[str, object] | None = None,
) -> AuditLog:
    """Append a semantic audit entry within the current transaction."""
    ctx = audit_context_var.get()
    entry = AuditLog(
        user_id=user.id if user is not None else (ctx.user_id if ctx else None),
        user_email=user.email if user is not None else (ctx.user_email if ctx else None),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_state=before_state,
        after_state=after_state,
        ip_address=ctx.ip_address if ctx else None,
        user_agent=ctx.user_agent if ctx else None,
    )
    db.add(entry)
    await db.flush()
    return entry
