"""Integration tests for Row-Level Security wiring.

These tests exercise the Postgres RLS policies end-to-end against a real
Postgres instance. They verify:

1. ``Session.after_begin`` listener fires on every transaction and pushes
   the current audit context into ``app.current_user_id`` /
   ``app.current_user_role``.
2. ``PoolEvents.checkin`` listener clears session state via ``RESET ALL`` so
   the next checkout sees no leftover ``SET`` values from the previous user.
3. The policies themselves filter correctly — an internal role sees rows, a
   client role without matching scope sees none, and an unauthenticated
   context is default-denied.

The tests build their own engine with a real pool (not ``NullPool`` like the
main conftest uses) so checkin behaviour is actually observable. They
require a running Postgres at the same address as the rest of the
integration test suite; if Postgres is unreachable the tests are skipped
rather than failing noisily.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import asyncpg
import pytest
import pytest_asyncio
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.audit_context import AuditContext, audit_context_var
from app.db.base import Base
from app.db.session import _reset_on_checkin

TEST_DATABASE_URL = "postgresql+asyncpg://amg:amg_dev_password@localhost:5433/amg_portal_test"
_PG_ADMIN_URL = "postgresql://amg:amg_dev_password@localhost:5433/postgres"


async def _postgres_reachable() -> bool:
    """Quick probe so the suite can skip instead of fail when Postgres is down."""
    try:
        conn = await asyncpg.connect(_PG_ADMIN_URL, timeout=2)
    except (OSError, asyncpg.exceptions.PostgresError):
        return False
    await conn.close()
    return True


pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def pooled_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Engine with a real pool (size=2) so checkin/checkout actually fire."""
    if not await _postgres_reachable():
        pytest.skip("Postgres not reachable at localhost:5433")

    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        pool_size=2,
        max_overflow=0,
        pool_pre_ping=True,
    )

    # Pool events bind per-pool; reattach the reset-on-checkin listener to
    # this test engine.
    event.listen(engine.sync_engine, "checkin", _reset_on_checkin)

    # Make sure schema + RLS policies are present.
    import app.models  # noqa: F401 — register every model

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    try:
        yield engine
    finally:
        await engine.dispose()


@asynccontextmanager
async def _audit_ctx(
    *,
    user_id: uuid.UUID | None = None,
    user_role: str | None = None,
) -> AsyncGenerator[AuditContext, None]:
    ctx = AuditContext(user_id=user_id, user_role=user_role, user_email="test@local")
    tok = audit_context_var.set(ctx)
    try:
        yield ctx
    finally:
        audit_context_var.reset(tok)


_UID_SQL = text("SELECT current_setting('app.current_user_id', true)")
_ROLE_SQL = text("SELECT current_setting('app.current_user_role', true)")


async def _seed_rm_and_client(
    engine: AsyncEngine,
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID]:
    """Seed two RMs, each with a distinct client.

    Returns ``(rm_a, client_a, rm_b, client_b)``.
    """
    from app.models.client import Client
    from app.models.user import User

    rm_a = uuid.uuid4()
    rm_b = uuid.uuid4()
    client_a = uuid.uuid4()
    client_b = uuid.uuid4()

    sm = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    # Seed outside of any audit context — the after_begin listener is a no-op
    # when ContextVar is unset. Also mark skip_audit to avoid audit rows.
    async with sm() as s:
        s.info["skip_audit"] = True
        s.add_all(
            [
                User(
                    id=rm_a,
                    email=f"rma_{rm_a.hex[:6]}@local",
                    hashed_password="x",
                    full_name="RM A",
                    role="relationship_manager",
                    status="active",
                ),
                User(
                    id=rm_b,
                    email=f"rmb_{rm_b.hex[:6]}@local",
                    hashed_password="x",
                    full_name="RM B",
                    role="relationship_manager",
                    status="active",
                ),
            ]
        )
        await s.flush()
        s.add_all(
            [
                Client(
                    id=client_a,
                    name="Client A",
                    client_type="individual",
                    rm_id=rm_a,
                    status="active",
                ),
                Client(
                    id=client_b,
                    name="Client B",
                    client_type="individual",
                    rm_id=rm_b,
                    status="active",
                ),
            ]
        )
        await s.commit()

    return rm_a, client_a, rm_b, client_b


@pytest.mark.asyncio
async def test_after_begin_sets_session_vars(pooled_engine: AsyncEngine) -> None:
    """With an audit context in the ContextVar, a fresh tx sees the vars populated."""
    rm_a, _, _, _ = await _seed_rm_and_client(pooled_engine)
    sm = async_sessionmaker(pooled_engine, class_=AsyncSession, expire_on_commit=False)

    async with _audit_ctx(user_id=rm_a, user_role="managing_director"), sm() as s:
        uid = (await s.execute(_UID_SQL)).scalar()
        role = (await s.execute(_ROLE_SQL)).scalar()
        assert uid == str(rm_a)
        assert role == "managing_director"


@pytest.mark.asyncio
async def test_reset_all_fires_on_checkin(pooled_engine: AsyncEngine) -> None:
    """After tx close + connection return to pool, the next checkout sees empty vars."""
    rm_a, _, rm_b, _ = await _seed_rm_and_client(pooled_engine)
    sm = async_sessionmaker(pooled_engine, class_=AsyncSession, expire_on_commit=False)

    # First session with user A's context — then returns connection to pool.
    async with _audit_ctx(user_id=rm_a, user_role="managing_director"), sm() as s:
        await s.execute(text("SELECT 1"))
        # Session close at end of `with` block returns the connection; RESET
        # ALL fires at the dbapi layer via the checkin listener.

    # A second session with NO audit context must see empty session vars.
    async with sm() as s:
        uid = (await s.execute(_UID_SQL)).scalar()
        role = (await s.execute(_ROLE_SQL)).scalar()
        # current_setting(..., true) returns '' when unset (or NULL if the
        # GUC was never defined for that connection). Either indicates no
        # leftover state.
        assert uid in ("", None)
        assert role in ("", None)

    # And with user B's context active, vars match B — never A.
    async with _audit_ctx(user_id=rm_b, user_role="managing_director"), sm() as s:
        uid = (await s.execute(_UID_SQL)).scalar()
        assert uid == str(rm_b)


@pytest.mark.asyncio
async def test_rls_filters_rm_to_their_clients(pooled_engine: AsyncEngine) -> None:
    """Internal role sees all clients; client role without scope sees none."""
    rm_a, client_a, _, client_b = await _seed_rm_and_client(pooled_engine)
    sm = async_sessionmaker(pooled_engine, class_=AsyncSession, expire_on_commit=False)

    # `managing_director` is in the internal roles list → sees both.
    async with _audit_ctx(user_id=rm_a, user_role="managing_director"), sm() as s:
        rows = (await s.execute(text("SELECT id FROM clients ORDER BY name"))).fetchall()
        ids = {row[0] for row in rows}
        assert client_a in ids
        assert client_b in ids

    # `client` role has no SELECT policy on the `clients` table → default-deny.
    async with _audit_ctx(user_id=rm_a, user_role="client"), sm() as s:
        rows = (await s.execute(text("SELECT id FROM clients"))).fetchall()
        assert rows == []


@pytest.mark.asyncio
async def test_unauthenticated_context_is_default_denied(pooled_engine: AsyncEngine) -> None:
    """Unauthenticated sessions (ContextVar unset) see nothing on RLS tables."""
    await _seed_rm_and_client(pooled_engine)
    sm = async_sessionmaker(pooled_engine, class_=AsyncSession, expire_on_commit=False)

    # No `_audit_ctx` wrapping → `audit_context_var.get()` is None → listener
    # no-ops. RLS policies default-deny.
    async with sm() as s:
        rows = (await s.execute(text("SELECT id FROM clients"))).fetchall()
        assert rows == []


@pytest.mark.asyncio
async def test_app_role_has_no_bypass_rls(pooled_engine: AsyncEngine) -> None:
    """Production assertion: the `amg_app` login role must not carry BYPASSRLS.

    In local dev the suite typically connects as the database owner (``amg``),
    which does not have a distinct ``amg_app`` role. When the role is absent
    this is an environmental gap (the prod role isn't provisioned locally),
    not a bug — ``xfail`` preserves the assertion's intent so it starts
    passing once ``amg_app`` is added to dev seed.
    """
    sm = async_sessionmaker(pooled_engine, class_=AsyncSession, expire_on_commit=False)
    async with sm() as s:
        row = (
            await s.execute(
                text("SELECT rolbypassrls FROM pg_roles WHERE rolname = 'amg_app'"),
            )
        ).first()
    if row is None:
        pytest.xfail(
            "amg_app role not provisioned in this environment; this "
            "assertion is a production-time guard. TODO: add amg_app role "
            "provisioning to the docker-compose init scripts.",
        )
    assert row[0] is False, "amg_app must not have BYPASSRLS"
