"""Tests for /api/v1/partner-portal (partner portal) endpoints."""

from __future__ import annotations

import uuid
from datetime import date

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.models.user import User

BASE = "/api/v1/partner-portal"


# ---------------------------------------------------------------------------
# Local fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def partner_profile(
    db_session: AsyncSession,
    partner_user: User,
    md_user: User,
) -> PartnerProfile:
    profile = PartnerProfile(
        id=uuid.uuid4(),
        user_id=partner_user.id,
        firm_name="Test Partners LLC",
        contact_name="Test Partner",
        contact_email="partner@test.local",
        capabilities=["investment_advisory"],
        geographies=["EMEA"],
        status="active",
        compliance_verified=True,
        created_by=md_user.id,
    )
    db_session.add(profile)
    await db_session.commit()
    return profile


@pytest_asyncio.fixture
async def partner_program(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Program:
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Partner Test Program",
        status="active",
        budget_envelope=100_000,
        created_by=rm_user.id,
    )
    db_session.add(program)
    await db_session.commit()
    return program


@pytest_asyncio.fixture
async def partner_assignment(
    db_session: AsyncSession,
    partner_profile: PartnerProfile,
    partner_program: Program,
    rm_user: User,
) -> PartnerAssignment:
    assignment = PartnerAssignment(
        id=uuid.uuid4(),
        partner_id=partner_profile.id,
        program_id=partner_program.id,
        assigned_by=rm_user.id,
        title="Test Assignment",
        brief="Test assignment brief for partner portal tests.",
        status="dispatched",
        due_date=date(2026, 6, 1),
    )
    db_session.add(assignment)
    await db_session.commit()
    return assignment


# ---------------------------------------------------------------------------
# Partner profile
# ---------------------------------------------------------------------------


class TestPartnerProfile:
    async def test_partner_gets_profile(
        self,
        partner_http: AsyncClient,
        partner_profile: PartnerProfile,
    ) -> None:
        resp = await partner_http.get(BASE + "/profile")
        assert resp.status_code == 200
        data = resp.json()
        assert data["firm_name"] == "Test Partners LLC"

    async def test_rm_cannot_access_partner_portal(
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
# Partner assignments
# ---------------------------------------------------------------------------


class TestPartnerAssignments:
    async def test_partner_lists_assignments(
        self,
        partner_http: AsyncClient,
        partner_assignment: PartnerAssignment,
    ) -> None:
        resp = await partner_http.get(BASE + "/assignments")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        titles = {a["title"] for a in data["assignments"]}
        assert "Test Assignment" in titles

    async def test_partner_gets_assignment(
        self,
        partner_http: AsyncClient,
        partner_assignment: PartnerAssignment,
    ) -> None:
        resp = await partner_http.get(f"{BASE}/assignments/{partner_assignment.id}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Test Assignment"

    async def test_partner_accepts_assignment(
        self,
        partner_http: AsyncClient,
        partner_assignment: PartnerAssignment,
    ) -> None:
        resp = await partner_http.post(f"{BASE}/assignments/{partner_assignment.id}/accept")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "accepted"


# ---------------------------------------------------------------------------
# Partner deliverables
# ---------------------------------------------------------------------------


class TestPartnerDeliverables:
    async def test_partner_lists_deliverables(
        self,
        partner_http: AsyncClient,
        partner_profile: PartnerProfile,
    ) -> None:
        resp = await partner_http.get(BASE + "/deliverables")
        assert resp.status_code == 200
        data = resp.json()
        assert "deliverables" in data


# ---------------------------------------------------------------------------
# Partner reports
# ---------------------------------------------------------------------------


class TestPartnerReports:
    async def test_brief_summary(
        self,
        partner_http: AsyncClient,
        partner_profile: PartnerProfile,
    ) -> None:
        resp = await partner_http.get(BASE + "/reports/brief-summary")
        assert resp.status_code == 200

    async def test_engagement_history(
        self,
        partner_http: AsyncClient,
        partner_profile: PartnerProfile,
    ) -> None:
        resp = await partner_http.get(BASE + "/reports/engagement-history")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Capability refresh
# ---------------------------------------------------------------------------


class TestCapabilityRefresh:
    async def test_refresh_status(
        self,
        partner_http: AsyncClient,
        partner_profile: PartnerProfile,
    ) -> None:
        resp = await partner_http.get(BASE + "/capability-refresh/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "is_overdue" in data
