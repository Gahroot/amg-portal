"""Tests for /api/v1/portal (client portal) endpoints."""

from __future__ import annotations

import uuid
from datetime import date

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.client_profile import ClientProfile
from app.models.program import Program
from app.models.user import User

BASE = "/api/v1/portal"


# ---------------------------------------------------------------------------
# Local fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def portal_client(
    db_session: AsyncSession,
    rm_user: User,
) -> Client:
    record = Client(
        id=uuid.uuid4(),
        name="Portal Test Family Office",
        client_type="family_office",
        rm_id=rm_user.id,
        status="active",
    )
    db_session.add(record)
    await db_session.commit()
    return record


@pytest_asyncio.fixture
async def portal_profile(
    db_session: AsyncSession,
    rm_user: User,
    client_user: User,
    portal_client: Client,  # noqa: ARG001 — ensures client exists first
) -> ClientProfile:
    profile = ClientProfile(
        id=uuid.uuid4(),
        legal_name="Portal Test Family Office",
        primary_email="portal@test.local",
        compliance_status="cleared",
        approval_status="approved",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
        user_id=client_user.id,
        portal_access_enabled=True,
        welcome_email_sent=True,
    )
    db_session.add(profile)
    await db_session.commit()
    return profile


@pytest_asyncio.fixture
async def portal_program(
    db_session: AsyncSession,
    rm_user: User,
    portal_client: Client,
    portal_profile: ClientProfile,  # noqa: ARG001 — ensures profile exists
) -> Program:
    program = Program(
        id=uuid.uuid4(),
        client_id=portal_client.id,
        title="Portal Test Program",
        status="active",
        budget_envelope=100_000,
        created_by=rm_user.id,
        start_date=date(2026, 1, 1),
    )
    db_session.add(program)
    await db_session.commit()
    return program


# ---------------------------------------------------------------------------
# Client profile
# ---------------------------------------------------------------------------


class TestClientProfile:
    async def test_client_gets_profile(
        self,
        client_user_http: AsyncClient,
        portal_profile: ClientProfile,
    ) -> None:
        resp = await client_user_http.get(BASE + "/profile")
        assert resp.status_code == 200

    async def test_rm_cannot_access_portal(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(BASE + "/profile")
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
    ) -> None:
        resp = await anon_client.get(BASE + "/profile")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Client programs
# ---------------------------------------------------------------------------


class TestClientPrograms:
    async def test_client_sees_own_programs(
        self,
        client_user_http: AsyncClient,
        portal_program: Program,
    ) -> None:
        resp = await client_user_http.get(BASE + "/programs")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        titles = {p["title"] for p in data}
        assert "Portal Test Program" in titles

    async def test_client_gets_program_detail(
        self,
        client_user_http: AsyncClient,
        portal_program: Program,
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/programs/{portal_program.id}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Portal Test Program"


# ---------------------------------------------------------------------------
# Client documents
# ---------------------------------------------------------------------------


class TestClientDocuments:
    async def test_client_lists_documents(
        self,
        client_user_http: AsyncClient,
        portal_profile: ClientProfile,
    ) -> None:
        resp = await client_user_http.get(BASE + "/documents")
        assert resp.status_code == 200
        data = resp.json()
        assert "documents" in data


# ---------------------------------------------------------------------------
# Client deliverables
# ---------------------------------------------------------------------------


class TestClientDeliverables:
    async def test_client_lists_deliverables(
        self,
        client_user_http: AsyncClient,
        portal_program: Program,
    ) -> None:
        resp = await client_user_http.get(BASE + "/deliverables")
        assert resp.status_code == 200
        data = resp.json()
        assert "deliverables" in data


# ---------------------------------------------------------------------------
# Client communications
# ---------------------------------------------------------------------------


class TestClientCommunications:
    async def test_client_lists_conversations(
        self,
        client_user_http: AsyncClient,
        portal_profile: ClientProfile,
    ) -> None:
        resp = await client_user_http.get(BASE + "/communications")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


# ---------------------------------------------------------------------------
# Client program status
# ---------------------------------------------------------------------------


class TestClientProgramStatus:
    async def test_client_gets_status_reports(
        self,
        client_user_http: AsyncClient,
        portal_program: Program,
    ) -> None:
        resp = await client_user_http.get(BASE + "/program-status")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
