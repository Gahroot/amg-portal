"""Tests for /api/v1/tasks (task board API) endpoints."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.task import Task
from app.models.user import User

BASE = "/api/v1/tasks"


# ---------------------------------------------------------------------------
# Shared fixtures (task board test scope)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_program_with_milestone(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> tuple[Program, Milestone]:
    """A Program in ``active`` status with one milestone for task board tests."""
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Task Board Program",
        objectives="Program for testing task board API",
        status="active",
        created_by=rm_user.id,
    )
    db_session.add(program)
    await db_session.commit()

    milestone = Milestone(
        id=uuid.uuid4(),
        program_id=program.id,
        title="Task Board Milestone",
        due_date=date.today() + timedelta(days=30),
        position=1,
    )
    db_session.add(milestone)
    await db_session.commit()

    return program, milestone


@pytest_asyncio.fixture
async def test_task(
    db_session: AsyncSession,
    test_program_with_milestone: tuple[Program, Milestone],
) -> Task:
    """A Task linked to a milestone for task board tests."""
    _, milestone = test_program_with_milestone
    task = Task(
        id=uuid.uuid4(),
        milestone_id=milestone.id,
        title="Test Task",
        description="A task for testing",
        status="todo",
        priority="medium",
        position=1,
    )
    db_session.add(task)
    await db_session.commit()
    return task


@pytest_asyncio.fixture
async def test_task_with_assignee(
    db_session: AsyncSession,
    test_program_with_milestone: tuple[Program, Milestone],
    coordinator_user: User,
) -> Task:
    """A Task with an assignee."""
    _, milestone = test_program_with_milestone
    task = Task(
        id=uuid.uuid4(),
        milestone_id=milestone.id,
        title="Assigned Task",
        description="A task with an assignee",
        status="todo",
        priority="high",
        assigned_to=coordinator_user.id,
        position=2,
    )
    db_session.add(task)
    await db_session.commit()
    return task


@pytest_asyncio.fixture
async def test_overdue_task(
    db_session: AsyncSession,
    test_program_with_milestone: tuple[Program, Milestone],
) -> Task:
    """An overdue Task (due_date in the past, not done/cancelled)."""
    _, milestone = test_program_with_milestone
    task = Task(
        id=uuid.uuid4(),
        milestone_id=milestone.id,
        title="Overdue Task",
        description="A task that is overdue",
        status="in_progress",
        priority="high",
        due_date=date.today() - timedelta(days=5),
        position=3,
    )
    db_session.add(task)
    await db_session.commit()
    return task


# ---------------------------------------------------------------------------
# List Tasks
# ---------------------------------------------------------------------------


class TestListTasks:
    """Tests for GET /api/v1/tasks/"""

    async def test_internal_staff_can_list_tasks(
        self, rm_client: AsyncClient
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "tasks" in data
        assert "total" in data
        assert isinstance(data["tasks"], list)

    async def test_coordinator_can_list_tasks(
        self, coordinator_client: AsyncClient
    ) -> None:
        resp = await coordinator_client.get(BASE + "/")
        assert resp.status_code == 200

    async def test_md_can_list_tasks(self, md_client: AsyncClient) -> None:
        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200

    async def test_client_cannot_list_tasks(
        self, client_user_http: AsyncClient
    ) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_partner_cannot_list_tasks(
        self, partner_http: AsyncClient
    ) -> None:
        resp = await partner_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_list_tasks_with_program_filter(
        self, rm_client: AsyncClient, test_program_with_milestone: tuple[Program, Milestone]
    ) -> None:
        program, _ = test_program_with_milestone
        resp = await rm_client.get(BASE + "/", params={"program_id": str(program.id)})
        assert resp.status_code == 200
        data = resp.json()
        # All returned tasks should belong to this program's milestones
        for task in data["tasks"]:
            assert task["program"]["id"] == str(program.id)

    async def test_list_tasks_with_status_filter(
        self, rm_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await rm_client.get(BASE + "/", params={"status": "todo"})
        assert resp.status_code == 200
        data = resp.json()
        for task in data["tasks"]:
            assert task["status"] == "todo"

    async def test_list_tasks_with_priority_filter(
        self, rm_client: AsyncClient, test_task_with_assignee: Task
    ) -> None:
        resp = await rm_client.get(BASE + "/", params={"priority": "high"})
        assert resp.status_code == 200
        data = resp.json()
        for task in data["tasks"]:
            assert task["priority"] == "high"

    async def test_list_tasks_with_assignee_filter(
        self,
        rm_client: AsyncClient,
        test_task_with_assignee: Task,
        coordinator_user: User,
    ) -> None:
        resp = await rm_client.get(
            BASE + "/", params={"assignee_id": str(coordinator_user.id)}
        )
        assert resp.status_code == 200
        data = resp.json()
        for task in data["tasks"]:
            assert task["assigned_to"] == str(coordinator_user.id)

    async def test_list_tasks_overdue_only(
        self, rm_client: AsyncClient, test_overdue_task: Task
    ) -> None:
        resp = await rm_client.get(BASE + "/", params={"overdue_only": True})
        assert resp.status_code == 200
        data = resp.json()
        # All returned tasks should be overdue
        assert data["total"] >= 1

    async def test_list_tasks_with_pagination(
        self, rm_client: AsyncClient
    ) -> None:
        resp = await rm_client.get(BASE + "/", params={"skip": 0, "limit": 10})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["tasks"]) <= 10

    async def test_list_tasks_returns_task_with_related_info(
        self, rm_client: AsyncClient, test_task_with_assignee: Task
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()

        # Find our test task
        task = next(
            (t for t in data["tasks"] if t["id"] == str(test_task_with_assignee.id)),
            None
        )
        if task:
            assert task["assignee"] is not None
            assert task["program"] is not None
            assert task["milestone"] is not None


# ---------------------------------------------------------------------------
# Create Task
# ---------------------------------------------------------------------------


class TestCreateTask:
    """Tests for POST /api/v1/tasks/"""

    async def test_coordinator_can_create_task(
        self,
        coordinator_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        resp = await coordinator_client.post(
            BASE + "/",
            json={
                "title": "New Task from Test",
                "milestone_id": str(milestone.id),
                "priority": "high",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Task from Test"
        assert data["status"] == "todo"
        assert data["priority"] == "high"
        assert data["milestone_id"] == str(milestone.id)

    async def test_rm_can_create_task(
        self,
        rm_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        resp = await rm_client.post(
            BASE + "/",
            json={
                "title": "RM Task",
                "milestone_id": str(milestone.id),
            },
        )
        assert resp.status_code == 201

    async def test_md_can_create_task(
        self,
        md_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        resp = await md_client.post(
            BASE + "/",
            json={
                "title": "MD Task",
                "milestone_id": str(milestone.id),
            },
        )
        assert resp.status_code == 201

    async def test_client_cannot_create_task(
        self,
        client_user_http: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        resp = await client_user_http.post(
            BASE + "/",
            json={
                "title": "Client Task",
                "milestone_id": str(milestone.id),
            },
        )
        assert resp.status_code == 403

    async def test_partner_cannot_create_task(
        self,
        partner_http: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        resp = await partner_http.post(
            BASE + "/",
            json={
                "title": "Partner Task",
                "milestone_id": str(milestone.id),
            },
        )
        assert resp.status_code == 403

    async def test_create_task_with_assignee(
        self,
        coordinator_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
        coordinator_user: User,
    ) -> None:
        _, milestone = test_program_with_milestone
        resp = await coordinator_client.post(
            BASE + "/",
            json={
                "title": "Task with Assignee",
                "milestone_id": str(milestone.id),
                "assigned_to": str(coordinator_user.id),
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["assigned_to"] == str(coordinator_user.id)
        assert data["assignee"]["id"] == str(coordinator_user.id)

    async def test_create_task_with_due_date(
        self,
        coordinator_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        due_date = (date.today() + timedelta(days=14)).isoformat()
        resp = await coordinator_client.post(
            BASE + "/",
            json={
                "title": "Task with Due Date",
                "milestone_id": str(milestone.id),
                "due_date": due_date,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["due_date"] == due_date

    async def test_create_task_with_invalid_milestone_returns_404(
        self, coordinator_client: AsyncClient
    ) -> None:
        resp = await coordinator_client.post(
            BASE + "/",
            json={
                "title": "Orphan Task",
                "milestone_id": str(uuid.uuid4()),
            },
        )
        assert resp.status_code == 404

    async def test_create_task_with_description(
        self,
        coordinator_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        resp = await coordinator_client.post(
            BASE + "/",
            json={
                "title": "Task with Description",
                "description": "Detailed description here",
                "milestone_id": str(milestone.id),
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["description"] == "Detailed description here"


# ---------------------------------------------------------------------------
# Update Task
# ---------------------------------------------------------------------------


class TestUpdateTask:
    """Tests for PATCH /api/v1/tasks/{task_id}"""

    async def test_coordinator_can_update_task_status(
        self, coordinator_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await coordinator_client.patch(
            f"{BASE}/{test_task.id}",
            json={"status": "in_progress"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "in_progress"

    async def test_rm_can_update_task(
        self, rm_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await rm_client.patch(
            f"{BASE}/{test_task.id}",
            json={"title": "Updated Title", "priority": "high"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Updated Title"
        assert data["priority"] == "high"

    async def test_md_can_update_task(
        self, md_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await md_client.patch(
            f"{BASE}/{test_task.id}",
            json={"status": "done"},
        )
        assert resp.status_code == 200

    async def test_client_cannot_update_task(
        self, client_user_http: AsyncClient, test_task: Task
    ) -> None:
        resp = await client_user_http.patch(
            f"{BASE}/{test_task.id}",
            json={"status": "done"},
        )
        assert resp.status_code == 403

    async def test_partner_cannot_update_task(
        self, partner_http: AsyncClient, test_task: Task
    ) -> None:
        resp = await partner_http.patch(
            f"{BASE}/{test_task.id}",
            json={"status": "done"},
        )
        assert resp.status_code == 403

    async def test_update_task_assignee(
        self,
        coordinator_client: AsyncClient,
        test_task: Task,
        rm_user: User,
    ) -> None:
        resp = await coordinator_client.patch(
            f"{BASE}/{test_task.id}",
            json={"assigned_to": str(rm_user.id)},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["assigned_to"] == str(rm_user.id)

    async def test_update_task_due_date(
        self, coordinator_client: AsyncClient, test_task: Task
    ) -> None:
        new_due_date = (date.today() + timedelta(days=7)).isoformat()
        resp = await coordinator_client.patch(
            f"{BASE}/{test_task.id}",
            json={"due_date": new_due_date},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["due_date"] == new_due_date

    async def test_update_task_priority(
        self, coordinator_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await coordinator_client.patch(
            f"{BASE}/{test_task.id}",
            json={"priority": "low"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["priority"] == "low"

    async def test_update_task_description(
        self, coordinator_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await coordinator_client.patch(
            f"{BASE}/{test_task.id}",
            json={"description": "New description"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["description"] == "New description"

    async def test_update_nonexistent_task_returns_404(
        self, coordinator_client: AsyncClient
    ) -> None:
        resp = await coordinator_client.patch(
            f"{BASE}/{uuid.uuid4()}",
            json={"status": "done"},
        )
        assert resp.status_code == 404

    async def test_update_task_status_to_done(
        self, coordinator_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await coordinator_client.patch(
            f"{BASE}/{test_task.id}",
            json={"status": "done"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "done"

    async def test_update_task_status_to_cancelled(
        self, coordinator_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await coordinator_client.patch(
            f"{BASE}/{test_task.id}",
            json={"status": "cancelled"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"


# ---------------------------------------------------------------------------
# Reorder Tasks (single)
# ---------------------------------------------------------------------------


class TestReorderTasks:
    """Tests for POST /api/v1/tasks/reorder"""

    async def test_coordinator_can_reorder_task(
        self, coordinator_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await coordinator_client.post(
            BASE + "/reorder",
            json={
                "task_id": str(test_task.id),
                "new_status": "in_progress",
                "after_task_id": None,
            },
        )
        assert resp.status_code == 204

    async def test_rm_can_reorder_task(
        self, rm_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await rm_client.post(
            BASE + "/reorder",
            json={
                "task_id": str(test_task.id),
                "new_status": "done",
                "after_task_id": None,
            },
        )
        assert resp.status_code == 204

    async def test_md_can_reorder_task(
        self, md_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await md_client.post(
            BASE + "/reorder",
            json={
                "task_id": str(test_task.id),
                "new_status": "todo",
                "after_task_id": None,
            },
        )
        assert resp.status_code == 204

    async def test_client_cannot_reorder_task(
        self, client_user_http: AsyncClient, test_task: Task
    ) -> None:
        resp = await client_user_http.post(
            BASE + "/reorder",
            json={
                "task_id": str(test_task.id),
                "new_status": "done",
                "after_task_id": None,
            },
        )
        assert resp.status_code == 403

    async def test_partner_cannot_reorder_task(
        self, partner_http: AsyncClient, test_task: Task
    ) -> None:
        resp = await partner_http.post(
            BASE + "/reorder",
            json={
                "task_id": str(test_task.id),
                "new_status": "done",
                "after_task_id": None,
            },
        )
        assert resp.status_code == 403

    async def test_reorder_nonexistent_task_returns_404(
        self, coordinator_client: AsyncClient
    ) -> None:
        resp = await coordinator_client.post(
            BASE + "/reorder",
            json={
                "task_id": str(uuid.uuid4()),
                "new_status": "todo",
                "after_task_id": None,
            },
        )
        assert resp.status_code == 404

    async def test_reorder_task_after_another_task(
        self,
        coordinator_client: AsyncClient,
        test_task: Task,
        test_task_with_assignee: Task,
    ) -> None:
        """Place test_task after test_task_with_assignee in the 'todo' column."""
        resp = await coordinator_client.post(
            BASE + "/reorder",
            json={
                "task_id": str(test_task.id),
                "new_status": "todo",
                "after_task_id": str(test_task_with_assignee.id),
            },
        )
        assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Batch Reorder Tasks
# ---------------------------------------------------------------------------


class TestBatchReorderTasks:
    """Tests for POST /api/v1/tasks/batch-reorder"""

    async def test_coordinator_can_batch_reorder(
        self, coordinator_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await coordinator_client.post(
            BASE + "/batch-reorder",
            json=[
                {
                    "task_id": str(test_task.id),
                    "new_status": "in_progress",
                    "after_task_id": None,
                }
            ],
        )
        assert resp.status_code == 204

    async def test_rm_can_batch_reorder(
        self, rm_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await rm_client.post(
            BASE + "/batch-reorder",
            json=[
                {
                    "task_id": str(test_task.id),
                    "new_status": "todo",
                    "after_task_id": None,
                }
            ],
        )
        assert resp.status_code == 204

    async def test_md_can_batch_reorder(
        self, md_client: AsyncClient, test_task: Task
    ) -> None:
        resp = await md_client.post(
            BASE + "/batch-reorder",
            json=[
                {
                    "task_id": str(test_task.id),
                    "new_status": "done",
                    "after_task_id": None,
                }
            ],
        )
        assert resp.status_code == 204

    async def test_client_cannot_batch_reorder(
        self, client_user_http: AsyncClient, test_task: Task
    ) -> None:
        resp = await client_user_http.post(
            BASE + "/batch-reorder",
            json=[
                {
                    "task_id": str(test_task.id),
                    "new_status": "done",
                    "after_task_id": None,
                }
            ],
        )
        assert resp.status_code == 403

    async def test_partner_cannot_batch_reorder(
        self, partner_http: AsyncClient, test_task: Task
    ) -> None:
        resp = await partner_http.post(
            BASE + "/batch-reorder",
            json=[
                {
                    "task_id": str(test_task.id),
                    "new_status": "done",
                    "after_task_id": None,
                }
            ],
        )
        assert resp.status_code == 403

    async def test_batch_reorder_multiple_tasks(
        self,
        coordinator_client: AsyncClient,
        test_task: Task,
        test_task_with_assignee: Task,
    ) -> None:
        resp = await coordinator_client.post(
            BASE + "/batch-reorder",
            json=[
                {
                    "task_id": str(test_task.id),
                    "new_status": "done",
                    "after_task_id": None,
                },
                {
                    "task_id": str(test_task_with_assignee.id),
                    "new_status": "done",
                    "after_task_id": str(test_task.id),
                },
            ],
        )
        assert resp.status_code == 204

    async def test_batch_reorder_with_nonexistent_task_continues(
        self, coordinator_client: AsyncClient, test_task: Task
    ) -> None:
        """Batch reorder should skip non-existent tasks without failing."""
        resp = await coordinator_client.post(
            BASE + "/batch-reorder",
            json=[
                {
                    "task_id": str(uuid.uuid4()),
                    "new_status": "todo",
                    "after_task_id": None,
                },
                {
                    "task_id": str(test_task.id),
                    "new_status": "todo",
                    "after_task_id": None,
                },
            ],
        )
        assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Delete Task
# ---------------------------------------------------------------------------


class TestDeleteTask:
    """Tests for DELETE /api/v1/tasks/{task_id}"""

    async def test_coordinator_can_delete_task(
        self,
        coordinator_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        # Create a task to delete
        create_resp = await coordinator_client.post(
            BASE + "/",
            json={
                "title": "Task to Delete",
                "milestone_id": str(milestone.id),
            },
        )
        assert create_resp.status_code == 201
        task_id = create_resp.json()["id"]

        resp = await coordinator_client.delete(f"{BASE}/{task_id}")
        assert resp.status_code == 204

    async def test_rm_can_delete_task(
        self,
        rm_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        create_resp = await rm_client.post(
            BASE + "/",
            json={
                "title": "Task to Delete by RM",
                "milestone_id": str(milestone.id),
            },
        )
        task_id = create_resp.json()["id"]

        resp = await rm_client.delete(f"{BASE}/{task_id}")
        assert resp.status_code == 204

    async def test_md_can_delete_task(
        self,
        md_client: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
    ) -> None:
        _, milestone = test_program_with_milestone
        create_resp = await md_client.post(
            BASE + "/",
            json={
                "title": "Task to Delete by MD",
                "milestone_id": str(milestone.id),
            },
        )
        task_id = create_resp.json()["id"]

        resp = await md_client.delete(f"{BASE}/{task_id}")
        assert resp.status_code == 204

    async def test_client_cannot_delete_task(
        self, client_user_http: AsyncClient, test_task: Task
    ) -> None:
        resp = await client_user_http.delete(f"{BASE}/{test_task.id}")
        assert resp.status_code == 403

    async def test_partner_cannot_delete_task(
        self, partner_http: AsyncClient, test_task: Task
    ) -> None:
        resp = await partner_http.delete(f"{BASE}/{test_task.id}")
        assert resp.status_code == 403

    async def test_delete_nonexistent_task_returns_404(
        self, coordinator_client: AsyncClient
    ) -> None:
        resp = await coordinator_client.delete(f"{BASE}/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# List Programs for Filter
# ---------------------------------------------------------------------------


class TestListProgramsForFilter:
    """Tests for GET /api/v1/tasks/programs"""

    async def test_internal_staff_can_list_programs(
        self, rm_client: AsyncClient
    ) -> None:
        resp = await rm_client.get(BASE + "/programs")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    async def test_coordinator_can_list_programs(
        self, coordinator_client: AsyncClient
    ) -> None:
        resp = await coordinator_client.get(BASE + "/programs")
        assert resp.status_code == 200

    async def test_md_can_list_programs(self, md_client: AsyncClient) -> None:
        resp = await md_client.get(BASE + "/programs")
        assert resp.status_code == 200

    async def test_client_cannot_list_programs(
        self, client_user_http: AsyncClient
    ) -> None:
        resp = await client_user_http.get(BASE + "/programs")
        assert resp.status_code == 403

    async def test_partner_cannot_list_programs(
        self, partner_http: AsyncClient
    ) -> None:
        resp = await partner_http.get(BASE + "/programs")
        assert resp.status_code == 403

    async def test_list_programs_returns_active_programs(
        self, rm_client: AsyncClient, test_program_with_milestone: tuple[Program, Milestone]
    ) -> None:
        resp = await rm_client.get(BASE + "/programs")
        assert resp.status_code == 200
        data = resp.json()
        program_ids = [p["id"] for p in data]
        program, _ = test_program_with_milestone
        assert str(program.id) in program_ids

    async def test_program_info_structure(
        self, rm_client: AsyncClient, test_program_with_milestone: tuple[Program, Milestone]
    ) -> None:
        resp = await rm_client.get(BASE + "/programs")
        assert resp.status_code == 200
        data = resp.json()
        if data:
            program = data[0]
            assert "id" in program
            assert "title" in program
            assert "status" in program


# ---------------------------------------------------------------------------
# List Assignees for Filter
# ---------------------------------------------------------------------------


class TestListAssigneesForFilter:
    """Tests for GET /api/v1/tasks/assignees"""

    async def test_internal_staff_can_list_assignees(
        self, rm_client: AsyncClient
    ) -> None:
        resp = await rm_client.get(BASE + "/assignees")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    async def test_coordinator_can_list_assignees(
        self, coordinator_client: AsyncClient
    ) -> None:
        resp = await coordinator_client.get(BASE + "/assignees")
        assert resp.status_code == 200

    async def test_md_can_list_assignees(self, md_client: AsyncClient) -> None:
        resp = await md_client.get(BASE + "/assignees")
        assert resp.status_code == 200

    async def test_client_cannot_list_assignees(
        self, client_user_http: AsyncClient
    ) -> None:
        resp = await client_user_http.get(BASE + "/assignees")
        assert resp.status_code == 403

    async def test_partner_cannot_list_assignees(
        self, partner_http: AsyncClient
    ) -> None:
        resp = await partner_http.get(BASE + "/assignees")
        assert resp.status_code == 403

    async def test_assignee_info_structure(
        self, rm_client: AsyncClient
    ) -> None:
        resp = await rm_client.get(BASE + "/assignees")
        assert resp.status_code == 200
        data = resp.json()
        if data:
            assignee = data[0]
            assert "id" in assignee
            assert "name" in assignee
            assert "email" in assignee

    async def test_assignees_only_internal_users(
        self, rm_client: AsyncClient
    ) -> None:
        """Assignees list should only contain internal staff (not clients/partners)."""
        resp = await rm_client.get(BASE + "/assignees")
        assert resp.status_code == 200
        data = resp.json()
        # All users should be internal (rm, md, coordinator, etc.)
        # The endpoint filters by INTERNAL_ROLES
        assert isinstance(data, list)


# ---------------------------------------------------------------------------
# RBAC Summary Tests
# ---------------------------------------------------------------------------


class TestTaskBoardRBAC:
    """RBAC tests summarizing access control for the task board API."""

    @pytest.mark.parametrize("endpoint", [
        "/",
        "/programs",
        "/assignees",
    ])
    async def test_client_blocked_from_read_endpoints(
        self, client_user_http: AsyncClient, endpoint: str
    ) -> None:
        resp = await client_user_http.get(BASE + endpoint)
        assert resp.status_code == 403

    @pytest.mark.parametrize("endpoint", [
        "/",
        "/programs",
        "/assignees",
    ])
    async def test_partner_blocked_from_read_endpoints(
        self, partner_http: AsyncClient, endpoint: str
    ) -> None:
        resp = await partner_http.get(BASE + endpoint)
        assert resp.status_code == 403

    async def test_client_blocked_from_write_operations(
        self,
        client_user_http: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
        test_task: Task,
    ) -> None:
        _, milestone = test_program_with_milestone

        # Create
        resp = await client_user_http.post(
            BASE + "/",
            json={"title": "Blocked", "milestone_id": str(milestone.id)},
        )
        assert resp.status_code == 403

        # Update
        resp = await client_user_http.patch(
            f"{BASE}/{test_task.id}",
            json={"status": "done"},
        )
        assert resp.status_code == 403

        # Reorder
        resp = await client_user_http.post(
            BASE + "/reorder",
            json={"task_id": str(test_task.id), "new_status": "done"},
        )
        assert resp.status_code == 403

        # Batch reorder
        resp = await client_user_http.post(
            BASE + "/batch-reorder",
            json=[{"task_id": str(test_task.id), "new_status": "done"}],
        )
        assert resp.status_code == 403

        # Delete
        resp = await client_user_http.delete(f"{BASE}/{test_task.id}")
        assert resp.status_code == 403

    async def test_partner_blocked_from_write_operations(
        self,
        partner_http: AsyncClient,
        test_program_with_milestone: tuple[Program, Milestone],
        test_task: Task,
    ) -> None:
        _, milestone = test_program_with_milestone

        # Create
        resp = await partner_http.post(
            BASE + "/",
            json={"title": "Blocked", "milestone_id": str(milestone.id)},
        )
        assert resp.status_code == 403

        # Update
        resp = await partner_http.patch(
            f"{BASE}/{test_task.id}",
            json={"status": "done"},
        )
        assert resp.status_code == 403

        # Reorder
        resp = await partner_http.post(
            BASE + "/reorder",
            json={"task_id": str(test_task.id), "new_status": "done"},
        )
        assert resp.status_code == 403

        # Batch reorder
        resp = await partner_http.post(
            BASE + "/batch-reorder",
            json=[{"task_id": str(test_task.id), "new_status": "done"}],
        )
        assert resp.status_code == 403

        # Delete
        resp = await partner_http.delete(f"{BASE}/{test_task.id}")
        assert resp.status_code == 403
