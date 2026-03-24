"""Tests for /api/v1/notifications endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User

BASE = "/api/v1/notifications"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_notifications(
    db_session: AsyncSession,
    rm_user: User,
) -> list[Notification]:
    """Three notifications for rm_user: 1 read, 2 unread."""
    notifications = [
        Notification(
            id=uuid.uuid4(),
            user_id=rm_user.id,
            notification_type="system",
            title="Read Notification",
            body="This has been read.",
            priority="normal",
            is_read=True,
            read_at=datetime.now(UTC),
        ),
        Notification(
            id=uuid.uuid4(),
            user_id=rm_user.id,
            notification_type="program_update",
            title="Unread Notification 1",
            body="First unread message.",
            priority="normal",
            is_read=False,
        ),
        Notification(
            id=uuid.uuid4(),
            user_id=rm_user.id,
            notification_type="deliverable",
            title="Unread Notification 2",
            body="Second unread message.",
            priority="high",
            is_read=False,
        ),
    ]
    for n in notifications:
        db_session.add(n)
    await db_session.commit()
    return notifications


# ---------------------------------------------------------------------------
# List notifications
# ---------------------------------------------------------------------------


class TestListNotifications:
    async def test_returns_all(
        self,
        rm_client: AsyncClient,
        test_notifications: list[Notification],
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 3

    async def test_filter_unread_only(
        self,
        rm_client: AsyncClient,
        test_notifications: list[Notification],
    ) -> None:
        resp = await rm_client.get(BASE + "/", params={"unread_only": True})
        assert resp.status_code == 200
        data = resp.json()
        # We created 2 unread notifications
        assert data["total"] >= 2
        for n in data["notifications"]:
            assert n["is_read"] is False

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
    ) -> None:
        resp = await anon_client.get(BASE + "/")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Mark read
# ---------------------------------------------------------------------------


class TestMarkRead:
    async def test_mark_single_read(
        self,
        rm_client: AsyncClient,
        test_notifications: list[Notification],
    ) -> None:
        # Pick the first unread notification
        unread_id = test_notifications[1].id
        resp = await rm_client.patch(f"{BASE}/{unread_id}/read")
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_read"] is True

    async def test_mark_all_read(
        self,
        rm_client: AsyncClient,
        test_notifications: list[Notification],
    ) -> None:
        resp = await rm_client.post(BASE + "/mark-all-read")
        assert resp.status_code == 204

    async def test_nonexistent_returns_404(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.patch(f"{BASE}/{uuid.uuid4()}/read")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Preferences
# ---------------------------------------------------------------------------


class TestPreferences:
    async def test_get_preferences(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(BASE + "/preferences")
        assert resp.status_code == 200
        data = resp.json()
        assert "digest_frequency" in data

    async def test_update_preferences(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.patch(
            BASE + "/preferences",
            json={"digest_frequency": "daily"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["digest_frequency"] == "daily"


# ---------------------------------------------------------------------------
# Create notification (admin/internal)
# ---------------------------------------------------------------------------


class TestCreateNotification:
    async def test_internal_can_create(
        self,
        rm_client: AsyncClient,
        rm_user: User,
    ) -> None:
        resp = await rm_client.post(
            BASE + "/",
            json={
                "user_id": str(rm_user.id),
                "notification_type": "system",
                "title": "Test Notification",
                "body": "Created via API.",
                "priority": "normal",
            },
        )
        # 201 when created, 204 when suppressed by preference
        assert resp.status_code in (201, 204)

    async def test_client_cannot_create(
        self,
        client_user_http: AsyncClient,
        client_user: User,
    ) -> None:
        resp = await client_user_http.post(
            BASE + "/",
            json={
                "user_id": str(client_user.id),
                "notification_type": "system",
                "title": "Should Fail",
                "body": "Blocked.",
                "priority": "normal",
            },
        )
        assert resp.status_code == 403
