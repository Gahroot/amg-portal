"""Tests for /api/v1/communications endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.communication import Communication
from app.models.conversation import Conversation
from app.models.user import User

BASE = "/api/v1/communications"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_conversation(
    db_session: AsyncSession,
    rm_user: User,
    client_user: User,
) -> Conversation:
    """A conversation between rm_user and client_user."""
    conv = Conversation(
        id=uuid.uuid4(),
        conversation_type="rm_client",
        title="Client Discussion",
        participant_ids=[rm_user.id, client_user.id],
        last_activity_at=datetime.now(UTC),
    )
    db_session.add(conv)
    await db_session.commit()
    return conv


@pytest_asyncio.fixture
async def test_message(
    db_session: AsyncSession,
    test_conversation: Conversation,
    rm_user: User,
) -> Communication:
    """A sent message in the test conversation."""
    msg = Communication(
        id=uuid.uuid4(),
        conversation_id=test_conversation.id,
        channel="in_portal",
        status="sent",
        sender_id=rm_user.id,
        recipients={str(rm_user.id): {"role": "to"}},
        subject="Test",
        body="Hello",
        sent_at=datetime.now(UTC),
    )
    db_session.add(msg)
    await db_session.commit()
    return msg


# ---------------------------------------------------------------------------
# Send message
# ---------------------------------------------------------------------------


class TestSendMessage:
    async def test_rm_can_send(
        self,
        rm_client: AsyncClient,
        test_conversation: Conversation,
    ) -> None:
        resp = await rm_client.post(
            BASE + "/send",
            json={
                "conversation_id": str(test_conversation.id),
                "body": "Test message from RM",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["body"] == "Test message from RM"

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
    ) -> None:
        resp = await anon_client.post(
            BASE + "/send",
            json={
                "conversation_id": str(uuid.uuid4()),
                "body": "Should fail",
            },
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List communications
# ---------------------------------------------------------------------------


class TestListCommunications:
    async def test_rm_can_list(
        self,
        rm_client: AsyncClient,
        test_message: Communication,
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "communications" in data
        assert "total" in data

    async def test_filter_by_conversation(
        self,
        rm_client: AsyncClient,
        test_conversation: Conversation,
        test_message: Communication,
    ) -> None:
        resp = await rm_client.get(
            BASE + "/",
            params={"conversation_id": str(test_conversation.id)},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
    ) -> None:
        resp = await anon_client.get(BASE + "/")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Unread count
# ---------------------------------------------------------------------------


class TestUnreadCount:
    async def test_returns_count(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(BASE + "/unread-count")
        assert resp.status_code == 200
        data = resp.json()
        assert "unread_count" in data or "total" in data


# ---------------------------------------------------------------------------
# Mark read
# ---------------------------------------------------------------------------


class TestMarkRead:
    async def test_mark_read(
        self,
        rm_client: AsyncClient,
        test_message: Communication,
    ) -> None:
        resp = await rm_client.post(
            BASE + "/mark-read",
            json={"communication_id": str(test_message.id)},
        )
        assert resp.status_code in (200, 204)

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
    ) -> None:
        resp = await anon_client.post(
            BASE + "/mark-read",
            json={"communication_id": str(uuid.uuid4())},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Template preview
# ---------------------------------------------------------------------------


class TestTemplatePreview:
    async def test_preview_requires_auth(
        self,
        anon_client: AsyncClient,
    ) -> None:
        resp = await anon_client.post(
            BASE + "/preview",
            json={
                "template_id": str(uuid.uuid4()),
                "variables": {"name": "Test"},
            },
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Send from template
# ---------------------------------------------------------------------------


class TestSendFromTemplate:
    async def test_requires_auth(
        self,
        anon_client: AsyncClient,
    ) -> None:
        resp = await anon_client.post(
            BASE + "/send-from-template",
            json={
                "template_id": str(uuid.uuid4()),
                "recipient_user_ids": [str(uuid.uuid4())],
                "variables": {"name": "Test"},
            },
        )
        assert resp.status_code == 401
