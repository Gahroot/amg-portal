"""SQLAlchemy event listener for audit logging.

Uses after_flush to ensure audit entries are properly created
within the same transaction as the changes being audited.
"""

import logging
import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.core.audit_chain import finalize_chain
from app.core.audit_context import AuditContext, audit_context_var
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)

SKIP_TABLES = {"audit_logs", "audit_checkpoints", "alembic_version"}
SENSITIVE_FIELDS = {"hashed_password", "mfa_secret", "mfa_backup_codes"}


_SCALAR_CONVERTERS: dict[type, object] = {
    uuid.UUID: str,
    datetime: datetime.isoformat,
    date: date.isoformat,
    Decimal: str,
}


def _serialize_value(value: object) -> object:  # noqa: PLR0911 — linear type dispatch
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
    # Encrypted ciphertext, blind-index HMAC, audit-chain hashes — emit a
    # length-only placeholder so we record "changed" without leaking bytes
    # into a JSONB column that would then live forever in audit_logs.
    if isinstance(value, (bytes, bytearray, memoryview)):
        return f"<bytes:{len(value)}>"
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


def _get_entity_id(instance: object, tablename: str) -> str:
    """Get entity ID from instance, with fallback for transient entities."""
    entity_id = getattr(instance, "id", None)
    if entity_id is None:
        logger.warning(
            "Audit: entity %s.%s has no id attribute, using transient id",
            tablename,
            id(instance),
        )
        entity_id = f"transient:{id(instance)}"
    return str(entity_id)


def _should_skip_entity(instance: object, action: str) -> tuple[bool, str]:
    """Check if an entity should be skipped during audit logging.

    Returns (should_skip, reason).
    """
    tablename = getattr(type(instance), "__tablename__", None)
    if not tablename:
        return True, f"no __tablename__ ({type(instance).__name__})"
    if tablename in SKIP_TABLES:
        return True, f"in SKIP_TABLES ({tablename})"
    return False, ""


def _audit_creates(
    session: Session,
    ctx: AuditContext | None,
    skipped: list[tuple[str, str, str]],
) -> list[AuditLog]:
    """Process new entities and create audit entries."""
    audit_entries: list[AuditLog] = []

    for instance in list(session.new):
        should_skip, reason = _should_skip_entity(instance, "create")
        if should_skip:
            skipped.append(("create", type(instance).__name__, reason))
            continue

        tablename = getattr(type(instance), "__tablename__", "")
        entity_id = _get_entity_id(instance, tablename)

        try:
            entry = AuditLog(
                user_id=ctx.user_id if ctx else None,
                user_email=ctx.user_email if ctx else None,
                action="create",
                entity_type=tablename,
                entity_id=entity_id,
                before_state=None,
                after_state=_instance_to_dict(instance),
                ip_address=ctx.ip_address if ctx else None,
                user_agent=ctx.user_agent if ctx else None,
            )
            audit_entries.append(entry)
        except Exception as e:
            logger.error("Audit: failed to create entry for %s: %s", tablename, e)

    return audit_entries


def _audit_updates(
    session: Session,
    ctx: AuditContext | None,
    skipped: list[tuple[str, str, str]],
) -> list[AuditLog]:
    """Process dirty entities and create audit entries."""
    audit_entries: list[AuditLog] = []

    for instance in list(session.dirty):
        should_skip, reason = _should_skip_entity(instance, "update")
        if should_skip:
            skipped.append(("update", type(instance).__name__, reason))
            continue

        tablename = getattr(type(instance), "__tablename__", "")
        entity_id = _get_entity_id(instance, tablename)

        before, after = _get_changes(instance)
        if not after:
            skipped.append(("update", tablename, "no changes detected"))
            continue

        try:
            entry = AuditLog(
                user_id=ctx.user_id if ctx else None,
                user_email=ctx.user_email if ctx else None,
                action="update",
                entity_type=tablename,
                entity_id=entity_id,
                before_state=before,
                after_state=after,
                ip_address=ctx.ip_address if ctx else None,
                user_agent=ctx.user_agent if ctx else None,
            )
            audit_entries.append(entry)
        except Exception as e:
            logger.error("Audit: failed to create entry for %s: %s", tablename, e)

    return audit_entries


def _audit_deletes(
    session: Session,
    ctx: AuditContext | None,
    skipped: list[tuple[str, str, str]],
) -> list[AuditLog]:
    """Process deleted entities and create audit entries."""
    audit_entries: list[AuditLog] = []

    for instance in list(session.deleted):
        should_skip, reason = _should_skip_entity(instance, "delete")
        if should_skip:
            skipped.append(("delete", type(instance).__name__, reason))
            continue

        tablename = getattr(type(instance), "__tablename__", "")
        entity_id = getattr(instance, "id", None)
        if entity_id is None:
            logger.warning(
                "Audit: deleted entity %s.%s has no id attribute",
                tablename,
                id(instance),
            )
            entity_id = f"deleted:{id(instance)}"

        try:
            entry = AuditLog(
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
            audit_entries.append(entry)
        except Exception as e:
            logger.error("Audit: failed to create entry for %s: %s", tablename, e)

    return audit_entries


def _log_summary(
    audit_entries: list[AuditLog],
    skipped: list[tuple[str, str, str]],
    ctx: AuditContext | None,
) -> None:
    """Log audit summary for debugging."""
    if audit_entries:
        logger.info(
            "Audit: created %d entries (user=%s, skipped=%d)",
            len(audit_entries),
            ctx.user_email if ctx else None,
            len(skipped),
        )
    if skipped and logger.isEnabledFor(logging.DEBUG):
        for action, table, reason in skipped:
            logger.debug("Audit: skipped %s on %s: %s", action, table, reason)


@event.listens_for(Session, "before_flush")
def before_flush(
    session: Session,
    flush_context: object,
    instances: object,
) -> None:
    """Finalise chain cols on AuditLog rows added directly to the session.

    Some legacy services (e.g. ``program_state_machine._write_audit_log``)
    construct ``AuditLog(...)`` + ``db.add(log)`` manually instead of relying
    on the ``after_flush`` listener.  Those rows skip the hash-chain path
    and would violate the NOT NULL constraint on ``row_hash``.

    This hook fires BEFORE the INSERT happens, picks up any such
    unfinalised AuditLog entries from ``session.new``, and runs
    ``finalize_chain`` on them.  Rows already chained by ``after_flush``
    (row_hash != None) are untouched.
    """
    if session.info.get("skip_audit"):
        return
    direct_audits = [
        obj for obj in list(session.new) if isinstance(obj, AuditLog) and obj.row_hash is None
    ]
    if not direct_audits:
        return
    try:
        finalize_chain(session, direct_audits)
    except Exception:
        # Same policy as the after_flush path: chain break never fails a
        # write; the daily verify cron catches it.
        logger.exception(
            "Audit: chain finalisation failed for direct-added rows; inserting without chain hashes"
        )


@event.listens_for(Session, "after_flush")
def after_flush(session: Session, flush_context: object) -> None:
    """Create audit log entries after flush completes.

    This event fires after the flush is complete, ensuring:
    1. All pending changes have been persisted (including ID generation)
    2. The transaction is still open, so audit entries are part of the same transaction
    3. Any audit entries added will be flushed in a subsequent flush cycle (SQLAlchemy handles this)

    Set ``session.info["skip_audit"] = True`` before flushing to suppress audit
    logging for bulk operations (e.g. imports, seed scripts) and avoid the
    write amplification of one audit entry per inserted row.
    """
    if session.info.get("skip_audit"):
        return

    ctx = audit_context_var.get()
    skipped: list[tuple[str, str, str]] = []

    audit_entries = _audit_creates(session, ctx, skipped)
    audit_entries.extend(_audit_updates(session, ctx, skipped))
    audit_entries.extend(_audit_deletes(session, ctx, skipped))

    if audit_entries:
        try:
            finalize_chain(session, audit_entries)
        except Exception:
            # Chain finalisation must never make a write fail — the daily
            # verify cron will flag any gap/corruption out-of-band.
            logger.exception("Audit: chain finalisation failed; inserting without chain hashes")

    for entry in audit_entries:
        session.add(entry)

    _log_summary(audit_entries, skipped, ctx)
