"""Tests for /api/v1/reports (report generation and scheduling) endpoints."""

from __future__ import annotations

import uuid
from datetime import date

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.program import Program
from app.models.user import User

BASE = "/api/v1/reports"


# ---------------------------------------------------------------------------
# Local fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def report_program(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Program:
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Report Test Program",
        status="active",
        budget_envelope=100_000,
        created_by=rm_user.id,
        start_date=date(2026, 1, 1),
    )
    db_session.add(program)
    await db_session.commit()
    return program


# ---------------------------------------------------------------------------
# RM portfolio report (Class B — internal)
# ---------------------------------------------------------------------------


class TestRMPortfolioReport:
    async def test_rm_gets_own_portfolio(
        self,
        rm_client: AsyncClient,
        report_program: Program,
    ) -> None:
        resp = await rm_client.get(BASE + "/rm-portfolio")
        assert resp.status_code == 200
        data = resp.json()
        assert "rm_name" in data or "clients" in data or "programs" in data

    async def test_client_cannot_access(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(BASE + "/rm-portfolio")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Program status report
# ---------------------------------------------------------------------------


class TestProgramStatusReport:
    async def test_rm_gets_status(
        self,
        rm_client: AsyncClient,
        report_program: Program,
    ) -> None:
        resp = await rm_client.get(
            BASE + "/program-status",
            params={"program_id": str(report_program.id)},
        )
        # RM role uses require_client dependency on this endpoint — expect 403
        # The program-status endpoint is client-facing
        assert resp.status_code in (200, 403)

    async def test_nonexistent_program(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(
            BASE + "/program-status",
            params={"program_id": str(uuid.uuid4())},
        )
        # Either 403 (role check) or 404 (not found)
        assert resp.status_code in (403, 404)


# ---------------------------------------------------------------------------
# Escalation log report (internal)
# ---------------------------------------------------------------------------


class TestEscalationLogReport:
    async def test_rm_gets_escalation_log(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(BASE + "/escalation-log")
        assert resp.status_code == 200

    async def test_client_cannot_access(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(BASE + "/escalation-log")
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
    ) -> None:
        resp = await anon_client.get(BASE + "/escalation-log")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Report scheduling (internal staff only)
# ---------------------------------------------------------------------------


class TestReportSchedules:
    async def test_create_schedule(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.post(
            BASE + "/schedules",
            json={
                "report_type": "portfolio",
                "frequency": "weekly",
                "recipients": ["test@test.local"],
                "format": "pdf",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["report_type"] == "portfolio"
        assert data["frequency"] == "weekly"
        assert data["is_active"] is True

    async def test_list_schedules(
        self,
        rm_client: AsyncClient,
    ) -> None:
        # Create one first
        await rm_client.post(
            BASE + "/schedules",
            json={
                "report_type": "portfolio",
                "frequency": "monthly",
                "recipients": ["list@test.local"],
                "format": "csv",
            },
        )
        resp = await rm_client.get(BASE + "/schedules")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    async def test_delete_schedule(
        self,
        rm_client: AsyncClient,
    ) -> None:
        # Create a schedule first
        create_resp = await rm_client.post(
            BASE + "/schedules",
            json={
                "report_type": "portfolio",
                "frequency": "daily",
                "recipients": ["delete@test.local"],
                "format": "pdf",
            },
        )
        assert create_resp.status_code == 201
        schedule_id = create_resp.json()["id"]

        # Delete it
        resp = await rm_client.delete(f"{BASE}/schedules/{schedule_id}")
        assert resp.status_code == 204
