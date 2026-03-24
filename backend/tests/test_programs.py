"""Tests for /api/v1/programs (program lifecycle) endpoints."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.user import User

BASE = "/api/v1/programs"


# ---------------------------------------------------------------------------
# Shared fixtures (program-test scope)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_program(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Program:
    """A Program in ``intake`` status with one milestone."""
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Estate Planning Initiative",
        objectives="Secure wealth transfer across generations.",
        budget_envelope=500_000.0,
        status="intake",
        created_by=rm_user.id,
    )
    db_session.add(program)
    await db_session.commit()
    return program


@pytest_asyncio.fixture
async def test_program_with_milestone(
    db_session: AsyncSession,
    test_program: Program,
) -> tuple[Program, Milestone]:
    """test_program plus one milestone."""
    milestone = Milestone(
        id=uuid.uuid4(),
        program_id=test_program.id,
        title="Initial Assessment",
        due_date=date.today() + timedelta(days=30),
        position=1,
    )
    db_session.add(milestone)
    await db_session.commit()
    return test_program, milestone


@pytest_asyncio.fixture
async def test_program_design(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Program:
    """A Program already in ``design`` state (with a milestone)."""
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Design Phase Program",
        status="design",
        created_by=rm_user.id,
    )
    db_session.add(program)
    await db_session.commit()

    milestone = Milestone(
        id=uuid.uuid4(),
        program_id=program.id,
        title="Design Milestone",
        due_date=date.today() + timedelta(days=60),
        position=1,
    )
    db_session.add(milestone)
    await db_session.commit()

    return program


# ---------------------------------------------------------------------------
# Create program
# ---------------------------------------------------------------------------


class TestCreateProgram:
    async def test_rm_can_create_program(
        self,
        rm_client: AsyncClient,
        db_client: Client,
    ) -> None:
        resp = await rm_client.post(
            BASE + "/",
            json={
                "client_id": str(db_client.id),
                "title": "Wealth Structuring Program",
                "budget_envelope": 250_000.0,
                "milestones": [],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Wealth Structuring Program"
        assert data["status"] == "intake"
        assert float(data["budget_envelope"]) == 250_000.0

    async def test_md_can_create_program(
        self, md_client: AsyncClient, db_client: Client
    ) -> None:
        resp = await md_client.post(
            BASE + "/",
            json={
                "client_id": str(db_client.id),
                "title": "MD Program",
                "milestones": [],
            },
        )
        assert resp.status_code == 201

    async def test_coordinator_cannot_create_program(
        self, coordinator_client: AsyncClient, db_client: Client
    ) -> None:
        resp = await coordinator_client.post(
            BASE + "/",
            json={
                "client_id": str(db_client.id),
                "title": "Blocked",
                "milestones": [],
            },
        )
        assert resp.status_code == 403

    async def test_create_with_milestones_inline(
        self, rm_client: AsyncClient, db_client: Client
    ) -> None:
        resp = await rm_client.post(
            BASE + "/",
            json={
                "client_id": str(db_client.id),
                "title": "Program With Milestones",
                "milestones": [
                    {"title": "Kickoff", "position": 1},
                    {"title": "Delivery", "position": 2},
                ],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["milestone_count"] == 2


# ---------------------------------------------------------------------------
# List programs
# ---------------------------------------------------------------------------


class TestListPrograms:
    async def test_internal_staff_can_list(
        self, rm_client: AsyncClient
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        assert "programs" in resp.json()

    async def test_client_user_cannot_list_internal_programs(
        self, client_user_http: AsyncClient
    ) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_rm_only_sees_own_programs(
        self,
        rm_client: AsyncClient,
        rm_user: User,
        rm_user_b: User,
        db_session: AsyncSession,
        db_client: Client,
    ) -> None:
        # Client owned by rm_user_b
        other_client = Client(
            id=uuid.uuid4(),
            name="Other Client",
            client_type="family_office",
            rm_id=rm_user_b.id,
            status="active",
        )
        db_session.add(other_client)
        await db_session.commit()

        own_prog = Program(
            id=uuid.uuid4(),
            client_id=db_client.id,
            title="My Program",
            status="intake",
            created_by=rm_user.id,
        )
        other_prog = Program(
            id=uuid.uuid4(),
            client_id=other_client.id,
            title="Their Program",
            status="intake",
            created_by=rm_user_b.id,
        )
        db_session.add_all([own_prog, other_prog])
        await db_session.commit()

        resp = await rm_client.get(BASE + "/")
        titles = {p["title"] for p in resp.json()["programs"]}
        assert "My Program" in titles
        assert "Their Program" not in titles


# ---------------------------------------------------------------------------
# Status transitions
# ---------------------------------------------------------------------------


class TestProgramStatusTransitions:
    async def test_valid_transition_intake_to_design(
        self,
        rm_client: AsyncClient,
        test_program: Program,
    ) -> None:
        resp = await rm_client.patch(
            f"{BASE}/{test_program.id}",
            json={"status": "design"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "design"

    async def test_invalid_transition_raises_422(
        self,
        rm_client: AsyncClient,
        test_program: Program,
    ) -> None:
        """intake → completed is not a valid transition."""
        resp = await rm_client.patch(
            f"{BASE}/{test_program.id}",
            json={"status": "completed"},
        )
        assert resp.status_code == 422

    async def test_activate_without_milestone_raises_422(
        self,
        rm_client: AsyncClient,
        test_program_design: Program,
        db_session: AsyncSession,
    ) -> None:
        """A program with no milestones cannot be activated."""
        # Remove all milestones to simulate the guard
        from sqlalchemy import delete

        from app.models.milestone import Milestone as Mil

        await db_session.execute(
            delete(Mil).where(Mil.program_id == test_program_design.id)
        )
        await db_session.commit()

        resp = await rm_client.patch(
            f"{BASE}/{test_program_design.id}",
            json={"status": "active"},
        )
        assert resp.status_code == 422

    async def test_design_to_active_with_milestone_succeeds(
        self,
        rm_client: AsyncClient,
        test_program_design: Program,
    ) -> None:
        """design → active is allowed when at least one milestone exists."""
        resp = await rm_client.patch(
            f"{BASE}/{test_program_design.id}",
            json={"status": "active"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"


# ---------------------------------------------------------------------------
# Milestone CRUD
# ---------------------------------------------------------------------------


class TestMilestoneCRUD:
    async def test_coordinator_can_add_milestone(
        self,
        coordinator_client: AsyncClient,
        test_program: Program,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/{test_program.id}/milestones",
            json={
                "title": "Due Diligence",
                "due_date": (date.today() + timedelta(days=14)).isoformat(),
                "position": 1,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Due Diligence"
        assert data["status"] == "pending"

    async def test_client_user_cannot_add_milestone(
        self,
        client_user_http: AsyncClient,
        test_program: Program,
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/{test_program.id}/milestones",
            json={"title": "Blocked", "position": 1},
        )
        assert resp.status_code == 403

    async def test_update_milestone_status(
        self,
        coordinator_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        resp = await coordinator_client.patch(
            f"{BASE}/milestones/{milestone.id}",
            json={"status": "in_progress"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    async def test_delete_milestone(
        self,
        rm_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        resp = await rm_client.delete(f"{BASE}/milestones/{milestone.id}")
        assert resp.status_code == 204

    async def test_update_nonexistent_milestone_returns_404(
        self, coordinator_client: AsyncClient
    ) -> None:
        resp = await coordinator_client.patch(
            f"{BASE}/milestones/{uuid.uuid4()}",
            json={"title": "Ghost"},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Task CRUD
# ---------------------------------------------------------------------------


class TestTaskCRUD:
    async def test_coordinator_can_add_task(
        self,
        coordinator_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        resp = await coordinator_client.post(
            f"{BASE}/milestones/{milestone.id}/tasks",
            json={
                "title": "Gather documents",
                "priority": "high",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Gather documents"
        assert data["priority"] == "high"
        assert data["status"] == "todo"

    async def test_update_task_status(
        self,
        coordinator_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone

        # Create task
        create_resp = await coordinator_client.post(
            f"{BASE}/milestones/{milestone.id}/tasks",
            json={"title": "Review files", "priority": "medium"},
        )
        assert create_resp.status_code == 201
        task_id = create_resp.json()["id"]

        # Update its status
        resp = await coordinator_client.patch(
            f"{BASE}/tasks/{task_id}",
            json={"status": "done"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "done"

    async def test_delete_task(
        self,
        coordinator_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone

        create_resp = await coordinator_client.post(
            f"{BASE}/milestones/{milestone.id}/tasks",
            json={"title": "Temp task", "priority": "low"},
        )
        task_id = create_resp.json()["id"]

        del_resp = await coordinator_client.delete(f"{BASE}/tasks/{task_id}")
        assert del_resp.status_code == 204

    async def test_client_user_cannot_add_task(
        self,
        client_user_http: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        resp = await client_user_http.post(
            f"{BASE}/milestones/{milestone.id}/tasks",
            json={"title": "Blocked", "priority": "low"},
        )
        assert resp.status_code == 403

    async def test_budget_envelope_stored_correctly(
        self, rm_client: AsyncClient, db_client: Client
    ) -> None:
        """Budget envelope (threshold) is persisted and returned on creation."""
        resp = await rm_client.post(
            BASE + "/",
            json={
                "client_id": str(db_client.id),
                "title": "Budget Program",
                "budget_envelope": 1_000_000.0,
                "milestones": [],
            },
        )
        assert resp.status_code == 201
        assert float(resp.json()["budget_envelope"]) == 1_000_000.0
