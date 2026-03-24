"""Tests for /api/v1/escalations endpoints."""

from __future__ import annotations

import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.escalation import Escalation
from app.models.user import User

BASE = "/api/v1/escalations"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def open_escalation(
    db_session: AsyncSession,
    md_user: User,
) -> Escalation:
    """A manually-inserted escalation in 'open' status owned by md_user."""
    esc = Escalation(
        id=uuid.uuid4(),
        level="program",
        status="open",
        title="Budget overrun detected",
        description="Program budget has exceeded threshold.",
        entity_type="program",
        entity_id=str(uuid.uuid4()),
        owner_id=md_user.id,
        triggered_by=md_user.id,
    )
    db_session.add(esc)
    await db_session.commit()
    return esc


@pytest_asyncio.fixture
async def acknowledged_escalation(
    db_session: AsyncSession,
    md_user: User,
) -> Escalation:
    """An escalation in 'acknowledged' status."""
    from datetime import UTC, datetime

    esc = Escalation(
        id=uuid.uuid4(),
        level="milestone",
        status="acknowledged",
        title="Milestone overdue",
        entity_type="milestone",
        entity_id=str(uuid.uuid4()),
        owner_id=md_user.id,
        triggered_by=md_user.id,
        acknowledged_at=datetime.now(UTC),
    )
    db_session.add(esc)
    await db_session.commit()
    return esc


# ---------------------------------------------------------------------------
# Create escalation
# ---------------------------------------------------------------------------


class TestCreateEscalation:
    async def test_internal_staff_can_create(
        self,
        md_client: AsyncClient,
        md_user: User,
    ) -> None:
        """An MD should be able to create a program-level escalation.
        Owner determination falls back to the first MD in the DB."""
        resp = await md_client.post(
            BASE + "/",
            json={
                "title": "Critical program risk",
                "description": "Client dissatisfied with delivery speed.",
                "entity_type": "program",
                "entity_id": str(uuid.uuid4()),
                "level": "program",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Critical program risk"
        assert data["status"] == "open"
        assert data["level"] == "program"
        assert data["owner_id"] is not None

    async def test_coordinator_can_create_task_escalation(
        self,
        coordinator_client: AsyncClient,
        coordinator_user: User,
        db_session: AsyncSession,
    ) -> None:
        """Task-level escalation owner is determined by the coordinator role."""
        resp = await coordinator_client.post(
            BASE + "/",
            json={
                "title": "Task blocked",
                "entity_type": "program",
                "entity_id": str(uuid.uuid4()),
                "level": "task",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "open"

    async def test_client_user_cannot_create_escalation(
        self, client_user_http: AsyncClient
    ) -> None:
        resp = await client_user_http.post(
            BASE + "/",
            json={
                "title": "Client complaint",
                "entity_type": "program",
                "entity_id": str(uuid.uuid4()),
                "level": "program",
            },
        )
        assert resp.status_code == 403

    async def test_partner_cannot_create_escalation(
        self, partner_http: AsyncClient
    ) -> None:
        resp = await partner_http.post(
            BASE + "/",
            json={
                "title": "Partner issue",
                "entity_type": "program",
                "entity_id": str(uuid.uuid4()),
                "level": "program",
            },
        )
        assert resp.status_code == 403

    async def test_unauthenticated_cannot_create(
        self, anon_client: AsyncClient
    ) -> None:
        resp = await anon_client.post(
            BASE + "/",
            json={
                "title": "Anon issue",
                "entity_type": "program",
                "entity_id": str(uuid.uuid4()),
                "level": "program",
            },
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List escalations
# ---------------------------------------------------------------------------


class TestListEscalations:
    async def test_internal_staff_can_list(
        self, md_client: AsyncClient, open_escalation: Escalation
    ) -> None:
        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "escalations" in data
        ids = [e["id"] for e in data["escalations"]]
        assert str(open_escalation.id) in ids

    async def test_filter_by_level(
        self, md_client: AsyncClient, open_escalation: Escalation
    ) -> None:
        resp = await md_client.get(BASE + "/", params={"level": "program"})
        assert resp.status_code == 200
        escalations = resp.json()["escalations"]
        for e in escalations:
            assert e["level"] == "program"

    async def test_filter_by_status(
        self, md_client: AsyncClient, open_escalation: Escalation
    ) -> None:
        resp = await md_client.get(BASE + "/", params={"status": "open"})
        assert resp.status_code == 200
        for e in resp.json()["escalations"]:
            assert e["status"] == "open"

    async def test_client_user_cannot_list(
        self, client_user_http: AsyncClient
    ) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_partner_cannot_list(self, partner_http: AsyncClient) -> None:
        resp = await partner_http.get(BASE + "/")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Get single escalation
# ---------------------------------------------------------------------------


class TestGetEscalation:
    async def test_internal_staff_can_get(
        self, rm_client: AsyncClient, open_escalation: Escalation
    ) -> None:
        resp = await rm_client.get(f"{BASE}/{open_escalation.id}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Budget overrun detected"

    async def test_nonexistent_returns_404(self, md_client: AsyncClient) -> None:
        resp = await md_client.get(f"{BASE}/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Acknowledge → Resolve → Close lifecycle
# ---------------------------------------------------------------------------


class TestEscalationStatusFlow:
    async def test_acknowledge_open_escalation(
        self, md_client: AsyncClient, open_escalation: Escalation
    ) -> None:
        resp = await md_client.post(f"{BASE}/{open_escalation.id}/acknowledge")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "acknowledged"
        assert data["acknowledged_at"] is not None

    async def test_resolve_acknowledged_escalation(
        self, md_client: AsyncClient, acknowledged_escalation: Escalation
    ) -> None:
        resp = await md_client.post(
            f"{BASE}/{acknowledged_escalation.id}/resolve",
            params={"notes": "Issue resolved after client meeting."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "resolved"
        assert data["resolved_at"] is not None

    async def test_update_escalation_notes(
        self, md_client: AsyncClient, open_escalation: Escalation
    ) -> None:
        resp = await md_client.put(
            f"{BASE}/{open_escalation.id}",
            json={"resolution_notes": "Under investigation."},
        )
        assert resp.status_code == 200
        assert resp.json()["resolution_notes"] == "Under investigation."

    async def test_update_status_via_put(
        self, md_client: AsyncClient, open_escalation: Escalation
    ) -> None:
        resp = await md_client.put(
            f"{BASE}/{open_escalation.id}",
            json={"status": "acknowledged"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "acknowledged"

    async def test_client_cannot_acknowledge(
        self, client_user_http: AsyncClient, open_escalation: Escalation
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/{open_escalation.id}/acknowledge"
        )
        assert resp.status_code == 403

    async def test_partner_cannot_resolve(
        self, partner_http: AsyncClient, acknowledged_escalation: Escalation
    ) -> None:
        resp = await partner_http.post(
            f"{BASE}/{acknowledged_escalation.id}/resolve"
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Owner determination
# ---------------------------------------------------------------------------


class TestEscalationOwnerDetermination:
    async def test_program_level_escalation_owned_by_md(
        self,
        rm_client: AsyncClient,
        md_user: User,
    ) -> None:
        """Program-level escalations should be assigned to an MD."""
        resp = await rm_client.post(
            BASE + "/",
            json={
                "title": "Program scope creep",
                "entity_type": "program",
                "entity_id": str(uuid.uuid4()),
                "level": "program",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["owner_id"] == str(md_user.id)

    async def test_task_level_fallback_to_coordinator(
        self,
        rm_client: AsyncClient,
        coordinator_user: User,
    ) -> None:
        """When no task-assigned coordinator is found, falls back to any coordinator."""
        resp = await rm_client.post(
            BASE + "/",
            json={
                "title": "Task blocked",
                "entity_type": "program",
                "entity_id": str(uuid.uuid4()),
                "level": "task",
            },
        )
        assert resp.status_code == 200
        # The owner should be the coordinator (fallback path)
        assert resp.json()["owner_id"] == str(coordinator_user.id)
