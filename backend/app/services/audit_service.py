"""Centralized audit logging service — creates immutable AuditLog entries."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base
from app.models.audit_log import AuditLog


def _serialize_value(value: object) -> object:  # noqa: PLR0911
    """Convert a value to a JSON-serializable type."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        return "<binary>"
    if isinstance(value, (list, tuple)):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    return value


def model_to_dict(instance: Base) -> dict[str, Any]:
    """Serialize a SQLAlchemy model instance to a JSON-safe dict.

    Only includes columns (no relationships) and converts non-JSON types
    (UUID, datetime, Decimal) to their string/float representations.
    """
    result: dict[str, Any] = {}
    for col in instance.__table__.columns:
        val = getattr(instance, col.key, None)
        result[col.key] = _serialize_value(val)
    return result


async def log_action(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None,
    user_email: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
    request: Any | None = None,
) -> None:
    """Write an immutable audit-log row.

    Parameters
    ----------
    db:
        Current async DB session (the entry is flushed but the caller owns
        the commit so it participates in the same transaction).
    user_id / user_email:
        Who performed the action.
    action:
        Short verb — ``create``, ``update``, ``delete``, ``submit``, etc.
    entity_type:
        Logical entity name — ``program``, ``client_profile``, ``user``, …
    entity_id:
        Primary-key value (stringified UUID).
    before_state / after_state:
        Optional JSON snapshots.  Use :func:`model_to_dict` to build them.
    request:
        A FastAPI ``Request`` object.  When supplied, ``ip_address`` and
        ``user_agent`` are extracted automatically.
    """
    ip_address: str | None = None
    user_agent: str | None = None
    if request is not None:
        if hasattr(request, "client") and request.client:
            ip_address = request.client.host
        user_agent = request.headers.get("user-agent")

    entry = AuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        before_state=before_state,
        after_state=after_state,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(entry)
    await db.flush()
