"""Tests for /api/v1/workload endpoints."""

from __future__ import annotations

import uuid
from typing import Any

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.enums import EscalationLevel, EscalationStatus
from app.models.escalation import Escalation
from app.models.program import Program
from app.models.user import User

BASE = "/api/v1/workload"


# ---------------------------------------------------------------------------
# Shared fixtures (workload-test scope)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_workload_data(
    db_session: AsyncSession,
    rm_user: User,
    rm_user_b: User,
    coordinator_user: User,
    md_user: User,
) -> dict[str, User | list[Program] | list[Escalation]]:
    """Create test data for workload tests: multiple users, programs, and escalations."""
    # Create clients for each RM
    client_a = Client(
        id=uuid.uuid4(),
        name="Client Alpha",
        client_type="family_office",
        rm_id=rm_user.id,
        status="active",
    )
    client_b = Client(
        id=uuid.uuid4(),
        name="Client Beta",
        client_type="uhnw_individual",
        rm_id=rm_user_b.id,
        status="active",
    )
    db_session.add_all([client_a, client_b])
    await db_session.flush()

    # Create programs for rm_user (3 active programs)
    programs_rm: list[Program] = []
    for i in range(3):
        prog = Program(
            id=uuid.uuid4(),
            client_id=client_a.id,
            title=f"RM Program {i + 1}",
            status="active",
            created_by=rm_user.id,
        )
        programs_rm.append(prog)
    db_session.add_all(programs_rm)

    # Create programs for rm_user_b (2 active programs)
    programs_rmb: list[Program] = []
    for i in range(2):
        prog = Program(
            id=uuid.uuid4(),
            client_id=client_b.id,
            title=f"RMB Program {i + 1}",
            status="active",
            created_by=rm_user_b.id,
        )
        programs_rmb.append(prog)
    db_session.add_all(programs_rmb)

    # Create one program for coordinator
    prog_coord = Program(
        id=uuid.uuid4(),
        client_id=client_a.id,
        title="Coordinator Program",
        status="design",
        created_by=coordinator_user.id,
    )
    db_session.add(prog_coord)

    await db_session.commit()

    # Create escalations for rm_user
    escalations_rm: list[Escalation] = []
    for i in range(2):
        esc = Escalation(
            id=uuid.uuid4(),
            level=EscalationLevel.task,
            status=EscalationStatus.open,
            title=f"Escalation {i + 1}",
            entity_type="program",
            entity_id=str(programs_rm[i].id),
            owner_id=rm_user.id,
            program_id=programs_rm[i].id,
            triggered_by=md_user.id,
        )
        escalations_rm.append(esc)
    db_session.add_all(escalations_rm)

    await db_session.commit()

    return {
        "rm_user": rm_user,
        "rm_user_b": rm_user_b,
        "coordinator_user": coordinator_user,
        "md_user": md_user,
        "programs_rm": programs_rm,
        "programs_rmb": programs_rmb,
        "escalations_rm": escalations_rm,
    }


@pytest_asyncio.fixture
async def test_program_for_assignments(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Program:
    """A program for testing staff assignments endpoint."""
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Assignment Test Program",
        status="active",
        created_by=rm_user.id,
    )
    db_session.add(program)
    await db_session.commit()
    return program


# ---------------------------------------------------------------------------
# TestListWorkload - List workload across users
# ---------------------------------------------------------------------------


class TestListWorkload:
    async def test_md_can_list_workload(
        self,
        md_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "staff" in data
        assert "summary" in data

    async def test_rm_can_list_workload(
        self,
        rm_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "staff" in data
        assert "summary" in data

    async def test_coordinator_can_list_workload(
        self,
        coordinator_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        resp = await coordinator_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "staff" in data
        assert "summary" in data

    async def test_workload_response_structure(
        self,
        rm_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()

        # Verify staff items structure
        if data["staff"]:
            staff_item = data["staff"][0]
            assert "user_id" in staff_item
            assert "user_name" in staff_item
            assert "user_email" in staff_item
            assert "role" in staff_item
            assert "active_programs" in staff_item
            assert "pending_tasks" in staff_item
            assert "open_escalations" in staff_item
            assert "workload_score" in staff_item
            assert "capacity_status" in staff_item

    async def test_workload_includes_all_internal_roles(
        self,
        md_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()

        roles = {item["role"] for item in data["staff"]}
        # Should include internal roles present in test data
        assert roles.issubset(
            {"managing_director", "relationship_manager", "coordinator", "finance_compliance"}
        )


# ---------------------------------------------------------------------------
# TestGetUserWorkload - Get workload for specific user (assignments)
# ---------------------------------------------------------------------------


class TestGetUserWorkload:
    async def test_get_user_assignments(
        self,
        rm_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        rm_user = test_workload_data["rm_user"]
        resp = await rm_client.get(f"{BASE}/{rm_user.id}/assignments")
        assert resp.status_code == 200
        data = resp.json()
        assert "assignments" in data
        assert "total" in data

    async def test_assignments_shows_programs(
        self,
        rm_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        rm_user = test_workload_data["rm_user"]
        programs_rm = test_workload_data["programs_rm"]

        resp = await rm_client.get(f"{BASE}/{rm_user.id}/assignments")
        assert resp.status_code == 200
        data = resp.json()

        # Should have assignments for the programs created by rm_user
        assert data["total"] >= len(programs_rm)
        program_titles = {a["program_title"] for a in data["assignments"]}
        for prog in programs_rm:
            assert prog.title in program_titles

    async def test_assignment_item_structure(
        self,
        rm_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        rm_user = test_workload_data["rm_user"]

        resp = await rm_client.get(f"{BASE}/{rm_user.id}/assignments")
        assert resp.status_code == 200
        data = resp.json()

        if data["assignments"]:
            assignment = data["assignments"][0]
            assert "id" in assignment
            assert "program_id" in assignment
            assert "program_title" in assignment
            assert "client_name" in assignment
            assert "role" in assignment
            assert "assigned_at" in assignment
            assert "program_status" in assignment
            assert "active_escalations" in assignment

    async def test_nonexistent_user_returns_404(
        self,
        rm_client: AsyncClient,
    ) -> None:
        fake_id = uuid.uuid4()
        resp = await rm_client.get(f"{BASE}/{fake_id}/assignments")
        assert resp.status_code == 404

    async def test_coordinator_can_view_assignments(
        self,
        coordinator_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        coordinator_user = test_workload_data["coordinator_user"]
        resp = await coordinator_client.get(f"{BASE}/{coordinator_user.id}/assignments")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# TestWorkloadSummary - Workload summary/statistics
# ---------------------------------------------------------------------------


class TestWorkloadSummary:
    async def test_summary_structure(
        self,
        md_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        summary = data["summary"]

        assert "total_staff" in summary
        assert "available_staff" in summary
        assert "at_capacity_staff" in summary
        assert "overloaded_staff" in summary
        assert "total_open_escalations" in summary
        assert "total_pending_approvals" in summary

    async def test_summary_counts_internal_staff(
        self,
        md_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()

        # Should count all internal staff (rm_user, rm_user_b, coordinator, md)
        assert data["summary"]["total_staff"] >= 4

    async def test_summary_counts_escalations(
        self,
        md_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        escalations_rm = test_workload_data["escalations_rm"]

        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()

        # Should count open escalations
        assert data["summary"]["total_open_escalations"] >= len(escalations_rm)

    async def test_capacity_status_available(
        self,
        md_client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """User with no programs or escalations should be 'available'."""
        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()

        # Find the MD user in the workload list
        md_item = next((s for s in data["staff"] if s["role"] == "managing_director"), None)
        if md_item:
            # MD with minimal assignments should have low workload
            assert md_item["workload_score"] < 50
            assert md_item["capacity_status"] == "available"


# ---------------------------------------------------------------------------
# TestWorkloadByRole - Workload breakdown by role
# ---------------------------------------------------------------------------


class TestWorkloadByRole:
    async def test_workload_by_role_includes_rm(
        self,
        md_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()

        roles = {item["role"] for item in data["staff"]}
        assert "relationship_manager" in roles

    async def test_rm_workload_shows_programs(
        self,
        md_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        rm_user = test_workload_data["rm_user"]
        programs_rm = test_workload_data["programs_rm"]

        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()

        rm_item = next((s for s in data["staff"] if s["user_id"] == str(rm_user.id)), None)
        assert rm_item is not None
        assert rm_item["active_programs"] >= len(programs_rm)

    async def test_rm_workload_shows_escalations(
        self,
        md_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        rm_user = test_workload_data["rm_user"]
        escalations_rm = test_workload_data["escalations_rm"]

        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()

        rm_item = next((s for s in data["staff"] if s["user_id"] == str(rm_user.id)), None)
        assert rm_item is not None
        assert rm_item["open_escalations"] >= len(escalations_rm)

    async def test_different_rms_have_different_workloads(
        self,
        md_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        """RM with more programs should have higher workload score."""
        rm_user = test_workload_data["rm_user"]  # 3 programs, 2 escalations
        rm_user_b = test_workload_data["rm_user_b"]  # 2 programs, 0 escalations

        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()

        rm_a_item = next((s for s in data["staff"] if s["user_id"] == str(rm_user.id)), None)
        rm_b_item = next((s for s in data["staff"] if s["user_id"] == str(rm_user_b.id)), None)

        if rm_a_item and rm_b_item:
            # rm_user has more programs and escalations, so should have higher score
            assert rm_a_item["workload_score"] >= rm_b_item["workload_score"]


# ---------------------------------------------------------------------------
# RBAC tests - Role restrictions
# ---------------------------------------------------------------------------


class TestWorkloadRBAC:
    async def test_client_user_cannot_access_workload(
        self,
        client_user_http: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_partner_user_cannot_access_workload(
        self,
        partner_http: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        resp = await partner_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_unauthenticated_user_cannot_access_workload(
        self,
        anon_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        resp = await anon_client.get(BASE + "/")
        assert resp.status_code == 401

    async def test_client_user_cannot_access_user_assignments(
        self,
        client_user_http: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        rm_user = test_workload_data["rm_user"]
        resp = await client_user_http.get(f"{BASE}/{rm_user.id}/assignments")
        assert resp.status_code == 403

    async def test_partner_user_cannot_access_user_assignments(
        self,
        partner_http: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        rm_user = test_workload_data["rm_user"]
        resp = await partner_http.get(f"{BASE}/{rm_user.id}/assignments")
        assert resp.status_code == 403

    async def test_compliance_can_access_workload(
        self,
        compliance_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        """Finance/compliance staff are internal and can view workload."""
        resp = await compliance_client.get(BASE + "/")
        assert resp.status_code == 200

    async def test_compliance_can_access_user_assignments(
        self,
        compliance_client: AsyncClient,
        test_workload_data: dict[str, Any],
    ) -> None:
        rm_user = test_workload_data["rm_user"]
        resp = await compliance_client.get(f"{BASE}/{rm_user.id}/assignments")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Capacity Forecast endpoint tests
# ---------------------------------------------------------------------------


class TestCapacityForecast:
    async def test_md_can_get_capacity_forecast(
        self,
        md_client: AsyncClient,
    ) -> None:
        resp = await md_client.get(BASE + "/capacity-forecast")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    async def test_rm_can_get_capacity_forecast(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(BASE + "/capacity-forecast")
        assert resp.status_code == 200

    async def test_client_cannot_access_capacity_forecast(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(BASE + "/capacity-forecast")
        assert resp.status_code == 403
