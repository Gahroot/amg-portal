"""Shared fixtures for backend tests."""

import sqlite3
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import JSON, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.client import Client
from app.models.user import User

# In-memory SQLite for tests — map PostgreSQL-specific types to SQLite equivalents
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Replace JSONB with JSON for SQLite compatibility


@event.listens_for(Base.metadata, "column_reflect")
def _reflect_col(
    inspector: Any, table: Any, column_info: dict[str, Any]
) -> None:
    if isinstance(column_info["type"], JSONB):
        column_info["type"] = JSON()


# Patch PostgreSQL-specific column types in metadata before table creation
def _patch_pg_columns() -> None:
    from sqlalchemy import String
    from sqlalchemy.dialects.postgresql import ARRAY
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID_TYPE

    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, (JSONB, ARRAY)):
                column.type = JSON()
            elif isinstance(column.type, PG_UUID_TYPE):
                column.type = String(36)


_patch_pg_columns()

# Register UUID adapter for SQLite
sqlite3.register_adapter(uuid.UUID, lambda u: str(u))
sqlite3.register_converter("UUID", lambda b: uuid.UUID(b.decode()))


@pytest.fixture
async def engine() -> AsyncGenerator[AsyncEngine, None]:
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(
    engine: AsyncEngine,
) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


@pytest.fixture
async def client(
    engine: AsyncEngine,
) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client for API integration tests."""
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create an active internal user for testing."""
    user = User(
        id=uuid.uuid4(),
        email="test@amg-portal.com",
        hashed_password=hash_password("Test123!@#"),
        full_name="Test User",
        role="managing_director",
        status="active",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_client_user(db_session: AsyncSession) -> User:
    """Create an active client-role user for testing."""
    user = User(
        id=uuid.uuid4(),
        email="client@example.com",
        hashed_password=hash_password("Client123!@#"),
        full_name="Client User",
        role="client",
        status="active",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_partner_user(db_session: AsyncSession) -> User:
    """Create an active partner-role user for testing."""
    user = User(
        id=uuid.uuid4(),
        email="partner@example.com",
        hashed_password=hash_password("Partner123!@#"),
        full_name="Partner User",
        role="partner",
        status="active",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user: User) -> dict[str, str]:
    """JWT auth headers for the test_user."""
    token = create_access_token(
        {"sub": str(test_user.id), "email": test_user.email}
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def test_client_entity(
    db_session: AsyncSession, test_user: User
) -> Client:
    """Create a test client entity."""
    client_entity = Client(
        id=uuid.uuid4(),
        name="Test Client Corp",
        client_type="uhnw_individual",
        rm_id=test_user.id,
        status="active",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db_session.add(client_entity)
    await db_session.commit()
    await db_session.refresh(client_entity)
    return client_entity
