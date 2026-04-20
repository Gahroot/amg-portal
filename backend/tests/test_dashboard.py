"""Tests for /api/v1/dashboard endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.escalation import Escalation
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.sla_tracker import SLATracker
from app.models.task import Task
from app.models.user import User

BASE = "/api/v1/dashboard"


# ---------------------------------------------------------------------------
# Shared fixtures (dashboard-test scope)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def dashboard_program(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Program:
    """A Program in ``active`` status for dashboard testing."""
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Dashboard Test Program",
        objectives="Test dashboard metrics.",
        budget_envelope=100_000.0,
        status="active",
        created_by=rm_user.id,
    )
    db_session.add(program)
    await db_session.commit()
    return program


@pytest_asyncio.fixture
async def dashboard_program_with_milestones(
    db_session: AsyncSession,
    dashboard_program: Program,
) -> tuple[Program, list[Milestone]]:
    """Program with multiple milestones in different states for RAG testing."""
    milestones = [
        Milestone(
            id=uuid.uuid4(),
            program_id=dashboard_program.id,
            title="Completed Phase",
            status="completed",
            due_date=date.today() - timedelta(days=30),
            position=1,
        ),
        Milestone(
            id=uuid.uuid4(),
            program_id=dashboard_program.id,
            title="In Progress Phase",
            status="in_progress",
            due_date=date.today() + timedelta(days=14),
            position=2,
        ),
        Milestone(
            id=uuid.uuid4(),
            program_id=dashboard_program.id,
            title="Overdue Phase",
            status="pending",
            due_date=date.today() - timedelta(days=5),
            position=3,
        ),
    ]
    db_session.add_all(milestones)
    await db_session.commit()
    return dashboard_program, milestones


@pytest_asyncio.fixture
async def test_escalation(
    db_session: AsyncSession,
    dashboard_program: Program,
    db_client: Client,
    rm_user: User,
) -> Escalation:
    """An open escalation linked to a program."""
    escalation = Escalation(
        id=uuid.uuid4(),
        level="high",
        status="open",
        title="Critical Issue",
        description="Something needs attention",
        entity_type="program",
        entity_id=str(dashboard_program.id),
        owner_id=rm_user.id,
        program_id=dashboard_program.id,
        client_id=db_client.id,
        triggered_by=rm_user.id,
    )
    db_session.add(escalation)
    await db_session.commit()
    return escalation


@pytest_asyncio.fixture
async def test_sla_tracker(
    db_session: AsyncSession,
    dashboard_program: Program,
    rm_user: User,
) -> SLATracker:
    """A breached SLA tracker for testing."""
    sla = SLATracker(
        id=uuid.uuid4(),
        entity_type="program",
        entity_id=str(dashboard_program.id),
        communication_type="email",
        sla_hours=24,
        started_at=datetime.now(UTC) - timedelta(hours=30),
        breach_status="breached",
        assigned_to=rm_user.id,
    )
    db_session.add(sla)
    await db_session.commit()
    return sla


@pytest_asyncio.fixture
async def test_task_overdue(
    db_session: AsyncSession,
    dashboard_program: Program,
) -> Task:
    """An overdue task for alert testing."""
    milestone = Milestone(
        id=uuid.uuid4(),
        program_id=dashboard_program.id,
        title="Milestone for overdue task",
        status="pending",
        due_date=date.today() + timedelta(days=30),
        position=1,
    )
    db_session.add(milestone)
    await db_session.flush()
    task = Task(
        id=uuid.uuid4(),
        title="Overdue Task",
        status="todo",
        due_date=date.today() - timedelta(days=3),
        milestone_id=milestone.id,
    )
    db_session.add(task)
    await db_session.commit()
    return task


# ---------------------------------------------------------------------------
# TestProgramHealth - /program-health endpoint
# ---------------------------------------------------------------------------


class TestProgramHealth:
    async def test_rm_can_get_program_health(
        self,
        rm_client: AsyncClient,
        dashboard_program: Program,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/program-health")
        assert resp.status_code == 200
        data = resp.json()
        assert "programs" in data
        assert "total" in data
        assert data["total"] >= 1

    async def test_md_can_get_program_health(
        self,
        md_client: AsyncClient,
        dashboard_program: Program,
    ) -> None:
        resp = await md_client.get(f"{BASE}/program-health")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["programs"], list)

    async def test_program_health_includes_rag_status(
        self,
        rm_client: AsyncClient,
        dashboard_program_with_milestones: tuple[Program, list[Milestone]],
    ) -> None:
        program, _ = dashboard_program_with_milestones
        resp = await rm_client.get(f"{BASE}/program-health")
        assert resp.status_code == 200
        data = resp.json()
        found = next((p for p in data["programs"] if p["id"] == str(program.id)), None)
        assert found is not None
        assert found["rag_status"] in ("red", "amber", "green")
        assert found["milestone_count"] == 3
        assert found["completed_milestone_count"] == 1

    async def test_program_health_includes_escalation_count(
        self,
        rm_client: AsyncClient,
        dashboard_program: Program,
        test_escalation: Escalation,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/program-health")
        assert resp.status_code == 200
        data = resp.json()
        found = next((p for p in data["programs"] if p["id"] == str(dashboard_program.id)), None)
        assert found is not None
        assert found["active_escalation_count"] >= 1

    async def test_client_user_cannot_access_program_health(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/program-health")
        assert resp.status_code == 403

    async def test_partner_user_cannot_access_program_health(
        self,
        partner_http: AsyncClient,
    ) -> None:
        resp = await partner_http.get(f"{BASE}/program-health")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# TestPortfolioSummary - /portfolio-summary endpoint
# ---------------------------------------------------------------------------


class TestPortfolioSummary:
    async def test_rm_can_get_portfolio_summary(
        self,
        rm_client: AsyncClient,
        dashboard_program: Program,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/portfolio-summary")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_programs" in data
        assert "active_programs" in data
        assert "completed_programs" in data
        assert "total_clients" in data
        assert "rag_breakdown" in data
        assert "total_open_escalations" in data
        assert "total_sla_breaches" in data
        assert "total_pending_decisions" in data
        assert "probationary_partner_count" in data

    async def test_md_can_get_portfolio_summary(
        self,
        md_client: AsyncClient,
        dashboard_program: Program,
    ) -> None:
        resp = await md_client.get(f"{BASE}/portfolio-summary")
        assert resp.status_code == 200

    async def test_portfolio_summary_counts_active_programs(
        self,
        rm_client: AsyncClient,
        dashboard_program: Program,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/portfolio-summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_programs"] >= 1
        assert data["active_programs"] >= 1

    async def test_portfolio_summary_rag_breakdown(
        self,
        rm_client: AsyncClient,
        dashboard_program_with_milestones: tuple[Program, list[Milestone]],
    ) -> None:
        resp = await rm_client.get(f"{BASE}/portfolio-summary")
        assert resp.status_code == 200
        data = resp.json()
        rag = data["rag_breakdown"]
        assert "red" in rag
        assert "amber" in rag
        assert "green" in rag
        # Sum of all RAG counts should equal total programs
        assert rag["red"] + rag["amber"] + rag["green"] == data["total_programs"]

    async def test_portfolio_summary_includes_escalation_count(
        self,
        rm_client: AsyncClient,
        test_escalation: Escalation,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/portfolio-summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_open_escalations"] >= 1

    async def test_client_user_cannot_access_portfolio_summary(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/portfolio-summary")
        assert resp.status_code == 403

    async def test_partner_user_cannot_access_portfolio_summary(
        self,
        partner_http: AsyncClient,
    ) -> None:
        resp = await partner_http.get(f"{BASE}/portfolio-summary")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# TestAtRiskPrograms - /at-risk-programs endpoint
# ---------------------------------------------------------------------------


class TestAtRiskPrograms:
    async def test_rm_can_get_at_risk_programs(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/at-risk-programs")
        assert resp.status_code == 200
        data = resp.json()
        assert "programs" in data
        assert "total" in data

    async def test_at_risk_programs_includes_red_rag(
        self,
        rm_client: AsyncClient,
        db_session: AsyncSession,
        db_client: Client,
        rm_user: User,
    ) -> None:
        # Create a program that will have red RAG status (overdue milestone)
        program = Program(
            id=uuid.uuid4(),
            client_id=db_client.id,
            title="At Risk Program",
            status="active",
            created_by=rm_user.id,
        )
        db_session.add(program)
        await db_session.commit()

        # Overdue milestone makes it red
        milestone = Milestone(
            id=uuid.uuid4(),
            program_id=program.id,
            title="Overdue",
            status="pending",
            due_date=date.today() - timedelta(days=10),
            position=1,
        )
        db_session.add(milestone)
        await db_session.commit()

        resp = await rm_client.get(f"{BASE}/at-risk-programs")
        assert resp.status_code == 200
        data = resp.json()
        found = next((p for p in data["programs"] if p["id"] == str(program.id)), None)
        assert found is not None
        assert found["rag_status"] == "red"

    async def test_at_risk_programs_includes_with_escalation(
        self,
        rm_client: AsyncClient,
        dashboard_program: Program,
        test_escalation: Escalation,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/at-risk-programs")
        assert resp.status_code == 200
        data = resp.json()
        found = next((p for p in data["programs"] if p["id"] == str(dashboard_program.id)), None)
        assert found is not None
        assert found["active_escalation_count"] >= 1

    async def test_client_user_cannot_access_at_risk_programs(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/at-risk-programs")
        assert resp.status_code == 403

    async def test_partner_user_cannot_access_at_risk_programs(
        self,
        partner_http: AsyncClient,
    ) -> None:
        resp = await partner_http.get(f"{BASE}/at-risk-programs")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# TestRealTimeStats - /real-time-stats endpoint
# ---------------------------------------------------------------------------


class TestRealTimeStats:
    async def test_rm_can_get_real_time_stats(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/real-time-stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "active_programs" in data
        assert "pending_approvals" in data
        assert "open_escalations" in data
        assert "sla_breaches" in data
        assert "unread_notifications" in data
        assert "upcoming_deadlines" in data

    async def test_md_can_get_real_time_stats(
        self,
        md_client: AsyncClient,
    ) -> None:
        resp = await md_client.get(f"{BASE}/real-time-stats")
        assert resp.status_code == 200

    async def test_real_time_stats_counts_active_programs(
        self,
        rm_client: AsyncClient,
        dashboard_program: Program,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/real-time-stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["active_programs"] >= 1

    async def test_real_time_stats_counts_escalations(
        self,
        rm_client: AsyncClient,
        test_escalation: Escalation,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/real-time-stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["open_escalations"] >= 1

    async def test_real_time_stats_counts_sla_breaches(
        self,
        rm_client: AsyncClient,
        test_sla_tracker: SLATracker,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/real-time-stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["sla_breaches"] >= 1

    async def test_client_user_cannot_access_real_time_stats(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/real-time-stats")
        assert resp.status_code == 403

    async def test_partner_user_cannot_access_real_time_stats(
        self,
        partner_http: AsyncClient,
    ) -> None:
        resp = await partner_http.get(f"{BASE}/real-time-stats")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# TestActivityFeed - /activity-feed endpoint
# ---------------------------------------------------------------------------


class TestActivityFeed:
    async def test_rm_can_get_activity_feed(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/activity-feed")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    async def test_activity_feed_pagination(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/activity-feed?skip=0&limit=10")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) <= 10

    async def test_activity_feed_includes_escalation(
        self,
        rm_client: AsyncClient,
        test_escalation: Escalation,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/activity-feed?limit=50")
        assert resp.status_code == 200
        data = resp.json()
        # Activity feed should include the escalation
        escalation_activities = [i for i in data["items"] if i["activity_type"] == "escalation"]
        assert len(escalation_activities) >= 1

    async def test_activity_feed_item_structure(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/activity-feed")
        assert resp.status_code == 200
        data = resp.json()
        if data["items"]:
            item = data["items"][0]
            assert "id" in item
            assert "activity_type" in item
            assert "title" in item
            assert "description" in item
            assert "entity_type" in item
            assert "entity_id" in item
            assert "timestamp" in item

    async def test_client_user_cannot_access_activity_feed(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/activity-feed")
        assert resp.status_code == 403

    async def test_partner_user_cannot_access_activity_feed(
        self,
        partner_http: AsyncClient,
    ) -> None:
        resp = await partner_http.get(f"{BASE}/activity-feed")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# TestAlerts - /alerts endpoint
# ---------------------------------------------------------------------------


class TestAlerts:
    async def test_rm_can_get_alerts(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/alerts")
        assert resp.status_code == 200
        data = resp.json()
        assert "alerts" in data
        assert "total" in data
        assert isinstance(data["alerts"], list)

    async def test_alerts_include_sla_breach(
        self,
        rm_client: AsyncClient,
        test_sla_tracker: SLATracker,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/alerts")
        assert resp.status_code == 200
        data = resp.json()
        sla_alerts = [a for a in data["alerts"] if a["alert_type"] == "sla_breach"]
        assert len(sla_alerts) >= 1

    async def test_alerts_include_overdue_task(
        self,
        rm_client: AsyncClient,
        test_task_overdue: Task,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/alerts")
        assert resp.status_code == 200
        data = resp.json()
        task_alerts = [a for a in data["alerts"] if a["alert_type"] == "overdue_task"]
        assert len(task_alerts) >= 1

    async def test_alert_item_structure(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/alerts")
        assert resp.status_code == 200
        data = resp.json()
        if data["alerts"]:
            alert = data["alerts"][0]
            assert "id" in alert
            assert "severity" in alert
            assert "alert_type" in alert
            assert "title" in alert
            assert "description" in alert
            assert "entity_type" in alert
            assert "entity_id" in alert
            assert alert["severity"] in ("critical", "warning", "info")

    async def test_alerts_sorted_by_severity(
        self,
        rm_client: AsyncClient,
        test_sla_tracker: SLATracker,
        test_task_overdue: Task,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/alerts")
        assert resp.status_code == 200
        data = resp.json()
        alerts = data["alerts"]
        if len(alerts) >= 2:
            severity_order = {"critical": 0, "warning": 1, "info": 2}
            # Verify critical alerts come before warning/info
            for i in range(len(alerts) - 1):
                curr_sev = severity_order.get(alerts[i]["severity"], 3)
                next_sev = severity_order.get(alerts[i + 1]["severity"], 3)
                assert curr_sev <= next_sev

    async def test_client_user_cannot_access_alerts(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/alerts")
        assert resp.status_code == 403

    async def test_partner_user_cannot_access_alerts(
        self,
        partner_http: AsyncClient,
    ) -> None:
        resp = await partner_http.get(f"{BASE}/alerts")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# RBAC Tests - Client/Partner cannot access dashboard
# ---------------------------------------------------------------------------


class TestDashboardRBAC:
    """Additional RBAC tests for all dashboard endpoints."""

    async def test_client_blocked_from_all_dashboard_endpoints(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        endpoints = [
            "/program-health",
            "/portfolio-summary",
            "/at-risk-programs",
            "/real-time-stats",
            "/activity-feed",
            "/alerts",
        ]
        for endpoint in endpoints:
            resp = await client_user_http.get(f"{BASE}{endpoint}")
            assert resp.status_code == 403, f"Expected 403 for {endpoint}"

    async def test_partner_blocked_from_all_dashboard_endpoints(
        self,
        partner_http: AsyncClient,
    ) -> None:
        endpoints = [
            "/program-health",
            "/portfolio-summary",
            "/at-risk-programs",
            "/real-time-stats",
            "/activity-feed",
            "/alerts",
        ]
        for endpoint in endpoints:
            resp = await partner_http.get(f"{BASE}{endpoint}")
            assert resp.status_code == 403, f"Expected 403 for {endpoint}"

    async def test_coordinator_can_access_dashboard(
        self,
        coordinator_client: AsyncClient,
    ) -> None:
        """Coordinator is internal staff and should have access."""
        resp = await coordinator_client.get(f"{BASE}/program-health")
        assert resp.status_code == 200

    async def test_compliance_can_access_dashboard(
        self,
        compliance_client: AsyncClient,
    ) -> None:
        """Compliance is internal staff and should have access."""
        resp = await compliance_client.get(f"{BASE}/portfolio-summary")
        assert resp.status_code == 200

    async def test_unauthenticated_blocked_from_dashboard(
        self,
        anon_client: AsyncClient,
    ) -> None:
        """Unauthenticated requests should be rejected."""
        resp = await anon_client.get(f"{BASE}/program-health")
        assert resp.status_code == 401
