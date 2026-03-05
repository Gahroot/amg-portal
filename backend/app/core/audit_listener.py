"""SQLAlchemy after_flush listener that auto-creates audit log entries."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.core.audit_context import audit_context_var
from app.models.audit_log import AuditLog

SKIP_TABLES = {"audit_logs"}
SENSITIVE_FIELDS = {"hashed_password"}


_SCALAR_CONVERTERS: dict[type, object] = {
    uuid.UUID: str,
    datetime: datetime.isoformat,
    Decimal: str,
}


def _serialize_value(value: object) -> object:
    """Convert a value to a JSON-safe representation."""
    if value is None:
        return None
    if isinstance(value, Enum):
        return value.value
    for typ, converter in _SCALAR_CONVERTERS.items():
        if isinstance(value, typ):
            return converter(value)  # type: ignore[operator]
    if isinstance(value, (list, tuple)):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    return value


def _instance_to_dict(instance: object) -> dict[str, object]:
    """Serialize an ORM instance's column values to a JSON-safe dict."""
    mapper = inspect(type(instance))
    result: dict[str, object] = {}
    for col in mapper.columns:  # type: ignore[union-attr]
        if col.key in SENSITIVE_FIELDS:
            continue
        result[col.key] = _serialize_value(getattr(instance, col.key, None))
    return result


def _get_changes(instance: object) -> tuple[dict[str, object], dict[str, object]]:
    """For a dirty instance, return (before, after) dicts with only changed columns."""
    inst_state = inspect(instance)
    before: dict[str, object] = {}
    after: dict[str, object] = {}
    for attr in inst_state.attrs:  # type: ignore[union-attr]
        if attr.key in SENSITIVE_FIELDS:
            continue
        hist = attr.history
        if hist.has_changes():
            old_val = hist.deleted[0] if hist.deleted else None
            new_val = hist.added[0] if hist.added else None
            before[attr.key] = _serialize_value(old_val)
            after[attr.key] = _serialize_value(new_val)
    return before, after


@event.listens_for(Session, "after_flush")
def after_flush(session: Session, flush_context: object) -> None:
    ctx = audit_context_var.get()

    audit_entries: list[AuditLog] = []

    # Creates
    for instance in list(session.new):
        tablename = getattr(type(instance), "__tablename__", None)
        if tablename in SKIP_TABLES or tablename is None:
            continue
        entity_id = getattr(instance, "id", None)
        if entity_id is None:
            continue
        audit_entries.append(
            AuditLog(
                user_id=ctx.user_id if ctx else None,
                user_email=ctx.user_email if ctx else None,
                action="create",
                entity_type=tablename,
                entity_id=str(entity_id),
                before_state=None,
                after_state=_instance_to_dict(instance),
                ip_address=ctx.ip_address if ctx else None,
                user_agent=ctx.user_agent if ctx else None,
            )
        )

    # Updates
    for instance in list(session.dirty):
        tablename = getattr(type(instance), "__tablename__", None)
        if tablename in SKIP_TABLES or tablename is None:
            continue
        entity_id = getattr(instance, "id", None)
        if entity_id is None:
            continue
        before, after = _get_changes(instance)
        if not after:
            continue
        audit_entries.append(
            AuditLog(
                user_id=ctx.user_id if ctx else None,
                user_email=ctx.user_email if ctx else None,
                action="update",
                entity_type=tablename,
                entity_id=str(entity_id),
                before_state=before,
                after_state=after,
                ip_address=ctx.ip_address if ctx else None,
                user_agent=ctx.user_agent if ctx else None,
            )
        )

    # Deletes
    for instance in list(session.deleted):
        tablename = getattr(type(instance), "__tablename__", None)
        if tablename in SKIP_TABLES or tablename is None:
            continue
        entity_id = getattr(instance, "id", None)
        if entity_id is None:
            continue
        audit_entries.append(
            AuditLog(
                user_id=ctx.user_id if ctx else None,
                user_email=ctx.user_email if ctx else None,
                action="delete",
                entity_type=tablename,
                entity_id=str(entity_id),
                before_state=_instance_to_dict(instance),
                after_state=None,
                ip_address=ctx.ip_address if ctx else None,
                user_agent=ctx.user_agent if ctx else None,
            )
        )

    for entry in audit_entries:
        session.add(entry)
