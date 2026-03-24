"""Shared test fixtures for the AMG Portal backend test suite.

Database strategy
-----------------
- ``create_test_database`` is a **sync** session-scoped fixture that runs
  table creation/teardown in its own ``asyncio.run()`` call — completely
  independent of the per-test event loop.
- The test engine uses ``NullPool`` (no connection pooling) so every session
  opens a fresh TCP connection.  This avoids the asyncpg "Future attached to
  a different loop" error that occurs when pooled connections cross event-loop
  boundaries between tests.
- Each test gets its own event loop (pytest-asyncio function scope).
- After every test, all rows are wiped (TRUNCATE … CASCADE).
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncGenerator, Generator

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text as _text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.client import Client
from app.models.client_profile import ClientProfile
from app.models.enums import UserRole
from app.models.user import User

# ---------------------------------------------------------------------------
# Test database configuration
# ---------------------------------------------------------------------------

_PG_ADMIN_URL = "postgresql://amg:amg_dev_password@localhost:5433/postgres"
_TEST_DB = "amg_portal_test"
TEST_DATABASE_URL = f"postgresql+asyncpg://amg:amg_dev_password@localhost:5433/{_TEST_DB}"


def _make_engine() -> object:
    """Create a fresh async engine with NullPool (no connection reuse)."""
    return create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )


# ---------------------------------------------------------------------------
# Sync session-scoped fixture — creates/drops tables exactly once per run
# ---------------------------------------------------------------------------


async def _async_setup() -> None:
    """Create the test DB (if absent) and build all tables."""
    conn = await asyncpg.connect(_PG_ADMIN_URL)
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname=$1", _TEST_DB
        )
        if not exists:
            await conn.execute(f'CREATE DATABASE "{_TEST_DB}"')
    finally:
        await conn.close()

    import app.models  # noqa: F401 — register every ORM model

    engine = _make_engine()
    async with engine.begin() as c:
        await c.run_sync(Base.metadata.drop_all)
        await c.run_sync(Base.metadata.create_all)
    await engine.dispose()


async def _async_teardown() -> None:
    engine = _make_engine()
    async with engine.begin() as c:
        await c.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def create_test_database() -> Generator[None, None, None]:
    """(Sync) Create the test database schema once for the entire session."""
    asyncio.run(_async_setup())
    yield
    asyncio.run(_async_teardown())


# ---------------------------------------------------------------------------
# Function-scoped: fresh engine + session for every test
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db_session(
    create_test_database: None,  # noqa: ARG001
) -> AsyncGenerator[AsyncSession, None]:
    """Provide an AsyncSession for test setup and assertions.

    A fresh NullPool engine is created for every test, so there is no
    cross-event-loop state.  Route handlers get their own sessions via the
    overridden ``get_db`` dependency (same test DB, so changes committed by
    one session are visible to the other).  All rows are deleted at the end.
    """
    engine = _make_engine()
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    # Route handlers each get a fresh session from the same test engine
    async def _override() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as s:
            try:
                yield s
            finally:
                await s.close()

    app.dependency_overrides[get_db] = _override

    async with session_factory() as session:
        yield session

    app.dependency_overrides.pop(get_db, None)

    # Wipe every table so the next test starts clean
    async with engine.begin() as conn:
        table_names = ", ".join(
            f'"{t.name}"' for t in Base.metadata.sorted_tables
        )
        await conn.execute(
            _text(f"TRUNCATE TABLE {table_names} RESTART IDENTITY CASCADE")
        )

    await engine.dispose()


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def anon_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:  # noqa: ARG001
    """Unauthenticated async HTTP test client."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def auth_headers(user: User) -> dict[str, str]:
    """Build an Authorization header for the given user."""
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"Authorization": f"Bearer {token}"}


def make_user(role: str, suffix: str = "") -> User:
    """Build a transient User with a unique e-mail (not yet added to session)."""
    tag = suffix if suffix else role[:4]
    return User(
        id=uuid.uuid4(),
        email=f"{tag}_{uuid.uuid4().hex[:6]}@test.local",
        hashed_password=hash_password("TestPass1!"),
        full_name=f"Test {role.replace('_', ' ').title()}",
        role=role,
        status="active",
    )


# ---------------------------------------------------------------------------
# Role-specific user fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def md_user(db_session: AsyncSession) -> User:
    user = make_user(UserRole.managing_director)
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def rm_user(db_session: AsyncSession) -> User:
    user = make_user(UserRole.relationship_manager)
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def rm_user_b(db_session: AsyncSession) -> User:
    """Second RM — used in scoping / RBAC tests."""
    user = make_user(UserRole.relationship_manager, "rmb")
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def coordinator_user(db_session: AsyncSession) -> User:
    user = make_user(UserRole.coordinator)
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def compliance_user(db_session: AsyncSession) -> User:
    user = make_user(UserRole.finance_compliance)
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def client_user(db_session: AsyncSession) -> User:
    user = make_user(UserRole.client)
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def partner_user(db_session: AsyncSession) -> User:
    user = make_user(UserRole.partner)
    db_session.add(user)
    await db_session.commit()
    return user


# ---------------------------------------------------------------------------
# Authenticated HTTP clients (one per role)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def md_client(anon_client: AsyncClient, md_user: User) -> AsyncClient:
    anon_client.headers.update(auth_headers(md_user))
    return anon_client


@pytest_asyncio.fixture
async def rm_client(anon_client: AsyncClient, rm_user: User) -> AsyncClient:
    anon_client.headers.update(auth_headers(rm_user))
    return anon_client


@pytest_asyncio.fixture
async def coordinator_client(
    anon_client: AsyncClient, coordinator_user: User
) -> AsyncClient:
    anon_client.headers.update(auth_headers(coordinator_user))
    return anon_client


@pytest_asyncio.fixture
async def compliance_client(
    anon_client: AsyncClient, compliance_user: User
) -> AsyncClient:
    anon_client.headers.update(auth_headers(compliance_user))
    return anon_client


@pytest_asyncio.fixture
async def client_user_http(
    anon_client: AsyncClient, client_user: User
) -> AsyncClient:
    """HTTP client authenticated as a ``client`` role user."""
    anon_client.headers.update(auth_headers(client_user))
    return anon_client


@pytest_asyncio.fixture
async def partner_http(
    anon_client: AsyncClient, partner_user: User
) -> AsyncClient:
    """HTTP client authenticated as a ``partner`` role user."""
    anon_client.headers.update(auth_headers(partner_user))
    return anon_client


# ---------------------------------------------------------------------------
# Shared domain fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db_client(db_session: AsyncSession, rm_user: User) -> Client:
    """A Client entity (not a portal user account) assigned to ``rm_user``."""
    record = Client(
        id=uuid.uuid4(),
        name="ACME Family Office",
        client_type="family_office",
        rm_id=rm_user.id,
        status="active",
    )
    db_session.add(record)
    await db_session.commit()
    return record


@pytest_asyncio.fixture
async def db_client_profile(
    db_session: AsyncSession, rm_user: User
) -> ClientProfile:
    """A ClientProfile in draft/pending state assigned to ``rm_user``."""
    profile = ClientProfile(
        id=uuid.uuid4(),
        legal_name="ACME Holdings Ltd",
        primary_email="acme@example.com",
        compliance_status="pending_review",
        approval_status="draft",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
    )
    db_session.add(profile)
    await db_session.commit()
    return profile


@pytest_asyncio.fixture
async def db_client_profile_pending_md(
    db_session: AsyncSession, rm_user: User
) -> ClientProfile:
    """A ClientProfile that has passed compliance and is awaiting MD approval."""
    profile = ClientProfile(
        id=uuid.uuid4(),
        legal_name="Pending MD Holdings",
        primary_email="pendingmd@example.com",
        compliance_status="cleared",
        approval_status="pending_md_approval",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
    )
    db_session.add(profile)
    await db_session.commit()
    return profile
