"""Tests for /api/v1/documents endpoints."""

from __future__ import annotations

import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.document import Document
from app.models.user import User

BASE = "/api/v1/documents"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_document(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Document:
    """A Document record linked to db_client, uploaded by rm_user."""
    doc = Document(
        id=uuid.uuid4(),
        entity_type="client",
        entity_id=db_client.id,
        category="general",
        file_path="/test/doc.pdf",
        file_name="doc.pdf",
        file_size=1024,
        content_type="application/pdf",
        version=1,
        uploaded_by=rm_user.id,
    )
    db_session.add(doc)
    await db_session.commit()
    return doc


# ---------------------------------------------------------------------------
# List documents
# ---------------------------------------------------------------------------


class TestListDocuments:
    async def test_rm_can_list(
        self,
        rm_client: AsyncClient,
        test_document: Document,
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "documents" in data
        assert "total" in data
        assert data["total"] >= 1

    async def test_md_can_list(
        self,
        md_client: AsyncClient,
        test_document: Document,
    ) -> None:
        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "documents" in data

    async def test_filter_by_entity_type(
        self,
        rm_client: AsyncClient,
        test_document: Document,
    ) -> None:
        resp = await rm_client.get(BASE + "/", params={"entity_type": "client"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        for doc in data["documents"]:
            assert doc["entity_type"] == "client"

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
# Get document
# ---------------------------------------------------------------------------


class TestGetDocument:
    async def test_rm_can_get(
        self,
        rm_client: AsyncClient,
        test_document: Document,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/{test_document.id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == str(test_document.id)

    async def test_nonexistent_returns_404(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Delete document
# ---------------------------------------------------------------------------


class TestDeleteDocument:
    async def test_coordinator_can_delete(
        self,
        coordinator_client: AsyncClient,
        test_document: Document,
    ) -> None:
        resp = await coordinator_client.delete(f"{BASE}/{test_document.id}")
        assert resp.status_code == 204

    async def test_client_cannot_delete(
        self,
        client_user_http: AsyncClient,
        test_document: Document,
    ) -> None:
        resp = await client_user_http.delete(f"{BASE}/{test_document.id}")
        assert resp.status_code == 403

    async def test_partner_cannot_delete(
        self,
        partner_http: AsyncClient,
        test_document: Document,
    ) -> None:
        resp = await partner_http.delete(f"{BASE}/{test_document.id}")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Upload document
# ---------------------------------------------------------------------------


class TestUploadDocument:
    async def test_upload_requires_auth(
        self,
        anon_client: AsyncClient,
    ) -> None:
        resp = await anon_client.post(
            BASE + "/",
            data={"entity_type": "client", "entity_id": str(uuid.uuid4())},
            files={"file": ("test.pdf", b"fake content", "application/pdf")},
        )
        assert resp.status_code == 401

    async def test_client_cannot_upload(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.post(
            BASE + "/",
            data={"entity_type": "client", "entity_id": str(uuid.uuid4())},
            files={"file": ("test.pdf", b"fake content", "application/pdf")},
        )
        assert resp.status_code == 403
