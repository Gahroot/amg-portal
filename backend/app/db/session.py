"""SQLAlchemy async engine + session factory with automatic RLS wiring.

The module wires two Postgres-level safety nets for Row Level Security:

1. ``Session.after_begin`` listener — on every new transaction, if an audit
   context is populated for the request (via middleware or
   ``get_current_user``), issues ``SET LOCAL app.current_user_id`` and
   ``SET LOCAL app.current_user_role`` so the RLS policies in
   ``add_rls_policies.py`` can see who the caller is. ``SET LOCAL`` is
   tx-scoped; it clears automatically at commit/rollback.

2. ``PoolEvents.checkin`` listener — when a connection is returned to the
   pool, runs ``RESET ALL`` on the raw dbapi connection. ``SET LOCAL``
   *should* clear on tx end, but ``RESET ALL`` is belt-and-braces against
   any leftover state (e.g. a ``SET SESSION`` someone snuck in via raw
   SQL).

See ``backend/tests/integration/test_rls_isolation.py`` for the cross-tenant
isolation assertions, and ``.gg/plans/phase1-encryption-audit.md`` §4.1.11
for the design rationale.
"""

from __future__ import annotations

import contextlib
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import event, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session as SyncSession
from sqlalchemy.orm import SessionTransaction

from app.core.audit_context import audit_context_var
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.SQL_ECHO,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=40,
    pool_timeout=30,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def _sanitize_user_id(raw: str) -> str:
    """Strip everything that isn't a hex digit or hyphen (UUID charset).

    Postgres's ``SET`` does NOT accept bind parameters, so the value is
    interpolated into the SQL string. The caller's user-id comes from a
    verified JWT/session context (a UUID), so the allowed charset is
    narrow enough to be safe; sanitising here means no injection path
    even if an upstream call site forgets to validate.
    """
    return "".join(c for c in raw if c in "0123456789abcdefABCDEF-")


def _sanitize_user_role(raw: str) -> str:
    """Strip everything that isn't alphanumeric or underscore (role enum charset)."""
    return "".join(c for c in raw if c.isalnum() or c == "_")


async def apply_rls_context(
    session: AsyncSession,
    user_id: str,
    user_role: str,
) -> None:
    """Set PostgreSQL session variables for row-level security.

    .. deprecated::
        The ``Session.after_begin`` event listener below applies RLS context
        automatically for every transaction, as long as the request
        populates :data:`audit_context_var`. This helper is retained only as
        a belt-and-braces override for routes that want to guarantee RLS is
        set *right now* — for example, when a route opens a new transaction
        after ``get_current_user`` ran and wants the ``SET LOCAL`` applied
        before the first query.

        New code should rely on the listener plus the ContextVar populated
        by auth middleware / ``get_current_user``. See the module docstring.

    Uses SET LOCAL so the settings are scoped to the current transaction
    and automatically reset when the transaction ends.

    Note: PostgreSQL's SET command does not support query parameters ($n /
    :name), so the values are interpolated directly.  Both inputs come from
    the verified JWT/session context (UUID and a known enum string) so
    there is no injection risk here.
    """
    safe_id = _sanitize_user_id(user_id)
    safe_role = _sanitize_user_role(user_role)
    await session.execute(text(f"SET LOCAL app.current_user_id = '{safe_id}'"))
    await session.execute(text(f"SET LOCAL app.current_user_role = '{safe_role}'"))


# ---------------------------------------------------------------------------
# Automatic RLS wiring via SQLAlchemy events
# ---------------------------------------------------------------------------


@event.listens_for(SyncSession, "after_begin")
def _apply_rls_on_begin(
    session: SyncSession,
    transaction: SessionTransaction,
    connection: Connection,
) -> None:
    """Push the current audit context onto every freshly-begun transaction.

    Fires for both plain ``Session`` usage and ``AsyncSession`` (which wraps
    a sync ``Session`` internally — ``AsyncSession.sync_session``). The
    listener runs *inside* the open tx, so ``SET LOCAL`` is bounded by that
    tx.

    If no audit context is populated (system paths, migrations, pre-auth
    requests), the listener is a no-op and the RLS policies default-deny
    non-internal callers — which is what we want.
    """
    ctx = audit_context_var.get()
    if ctx is None:
        return
    user_role = getattr(ctx, "user_role", None)
    if ctx.user_id is None or user_role is None:
        # Partial context (e.g. pre-auth middleware snapshot with no role
        # yet). Leave the session vars empty; RLS policies handle default-deny.
        return

    safe_id = _sanitize_user_id(str(ctx.user_id))
    safe_role = _sanitize_user_role(user_role)
    if not safe_id or not safe_role:
        return

    # Postgres SET does NOT accept bind params; values are sanitised above.
    connection.execute(text(f"SET LOCAL app.current_user_id = '{safe_id}'"))
    connection.execute(text(f"SET LOCAL app.current_user_role = '{safe_role}'"))


@event.listens_for(engine.sync_engine, "checkin")
def _reset_on_checkin(dbapi_connection: Any, connection_record: Any) -> None:  # noqa: ARG001
    """Run ``RESET ALL`` when a connection returns to the pool.

    ``SET LOCAL`` is tx-scoped and *should* clear on commit/rollback.
    ``RESET ALL`` is defence-in-depth: it clears any ``SET SESSION`` that
    raw SQL might have issued, guarantees the next checkout starts from a
    known clean slate, and prevents any cross-request/cross-tenant leakage
    of session-level state.

    Executed at the dbapi layer because pool events run outside the ORM /
    SQLAlchemy connection layer — we only have the raw driver connection.
    """
    try:
        cursor = dbapi_connection.cursor()
    except Exception:  # noqa: BLE001
        # Connection is invalid/closed — pool will discard it; nothing to do.
        return
    try:
        cursor.execute("RESET ALL")
    except Exception:  # noqa: BLE001
        # If the connection can't accept a RESET ALL (e.g. it's in a bad
        # state), the pool will invalidate it on the next attempt anyway.
        pass
    finally:
        with contextlib.suppress(Exception):
            cursor.close()
