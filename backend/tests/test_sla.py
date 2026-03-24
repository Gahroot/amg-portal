"""Tests for /api/v1/sla endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sla_tracker import SLATracker
from app.models.user import User

BASE = "/api/v1/sla"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def sla_trackers(
    db_session: AsyncSession,
    rm_user: User,
) -> list[SLATracker]:
    """Three SLA trackers with different breach statuses."""
    trackers = [
        SLATracker(
            id=uuid.uuid4(),
            entity_type="communication",
            entity_id=str(uuid.uuid4()),
            communication_type="client_inquiry",
            sla_hours=24,
            started_at=datetime.now(UTC),
            breach_status="within_sla",
            assigned_to=rm_user.id,
        ),
        SLATracker(
            id=uuid.uuid4(),
            entity_type="communication",
            entity_id=str(uuid.uuid4()),
            communication_type="email",
            sla_hours=8,
            started_at=datetime.now(UTC),
            breach_status="breached",
            assigned_to=rm_user.id,
        ),
        SLATracker(
            id=uuid.uuid4(),
            entity_type="communication",
            entity_id=str(uuid.uuid4()),
            communication_type="portal_message",
            sla_hours=4,
            started_at=datetime.now(UTC),
            responded_at=datetime.now(UTC),
            breach_status="responded",
            assigned_to=rm_user.id,
        ),
    ]
    for t in trackers:
        db_session.add(t)
    await db_session.commit()
    return trackers


# ---------------------------------------------------------------------------
# List SLA trackers
# ---------------------------------------------------------------------------


class TestListSLATrackers:
    async def test_internal_can_list(
        self,
        rm_client: AsyncClient,
        sla_trackers: list[SLATracker],
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 3

    async def test_filter_by_breach_status(
        self,
        rm_client: AsyncClient,
        sla_trackers: list[SLATracker],
    ) -> None:
        resp = await rm_client.get(
            BASE + "/", params={"breach_status": "breached"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        for tracker in data["trackers"]:
            assert tracker["breach_status"] == "breached"

    async def test_client_cannot_list(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
    ) -> None:
        resp = await anon_client.get(BASE + "/")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Get SLA tracker
# ---------------------------------------------------------------------------


class TestGetSLATracker:
    async def test_get_by_id(
        self,
        rm_client: AsyncClient,
        sla_trackers: list[SLATracker],
    ) -> None:
        tracker = sla_trackers[0]
        resp = await rm_client.get(f"{BASE}/{tracker.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(tracker.id)
        assert data["entity_type"] == "communication"
        assert data["sla_hours"] == 24

    async def test_nonexistent_returns_404(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Create SLA tracker
# ---------------------------------------------------------------------------


class TestCreateSLATracker:
    async def test_internal_can_create(
        self,
        rm_client: AsyncClient,
        rm_user: User,
    ) -> None:
        resp = await rm_client.post(
            BASE + "/",
            json={
                "entity_type": "communication",
                "entity_id": str(uuid.uuid4()),
                "communication_type": "client_inquiry",
                "assigned_to": str(rm_user.id),
                "sla_hours": 24,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["entity_type"] == "communication"
        assert data["breach_status"] == "within_sla"


# ---------------------------------------------------------------------------
# Respond to SLA
# ---------------------------------------------------------------------------


class TestRespondToSLA:
    async def test_respond_marks_responded(
        self,
        rm_client: AsyncClient,
        sla_trackers: list[SLATracker],
    ) -> None:
        # Use the first tracker (within_sla, not yet responded)
        tracker = sla_trackers[0]
        resp = await rm_client.post(f"{BASE}/{tracker.id}/respond")
        assert resp.status_code == 200
        data = resp.json()
        assert data["responded_at"] is not None
