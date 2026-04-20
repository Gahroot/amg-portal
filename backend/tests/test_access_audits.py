"""Tests for /api/v1/access-audits (quarterly access audit) endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.access_audit import AccessAudit, AccessAuditFinding
from app.models.user import User

BASE = "/api/v1/access-audits"


# ---------------------------------------------------------------------------
# Local fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def access_audit(
    db_session: AsyncSession,
    compliance_user: User,
) -> AccessAudit:
    """A draft access audit."""
    audit = AccessAudit(
        id=uuid.uuid4(),
        quarter=1,
        year=2026,
        status="draft",
        auditor_id=compliance_user.id,
        audit_period="Q1 2026",
        started_at=datetime.now(UTC),
    )
    db_session.add(audit)
    await db_session.commit()
    return audit


@pytest_asyncio.fixture
async def audit_finding(
    db_session: AsyncSession,
    access_audit: AccessAudit,
    rm_user: User,
) -> AccessAuditFinding:
    """A finding associated with the access audit."""
    finding = AccessAuditFinding(
        id=uuid.uuid4(),
        audit_id=access_audit.id,
        user_id=rm_user.id,
        finding_type="inactive_user",
        severity="medium",
        description="User inactive for 90+ days",
        status="open",
    )
    db_session.add(finding)
    await db_session.commit()
    return finding


# ---------------------------------------------------------------------------
# Create Audit
# ---------------------------------------------------------------------------


class TestCreateAudit:
    async def test_compliance_creates_audit(
        self, compliance_client: AsyncClient, compliance_user: User
    ) -> None:
        resp = await compliance_client.post(
            BASE + "/",
            json={
                "quarter": 2,
                "year": 2026,
                "auditor_id": str(compliance_user.id),
            },
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["quarter"] == 2
        assert data["year"] == 2026

    async def test_rm_cannot_create(self, rm_client: AsyncClient, rm_user: User) -> None:
        resp = await rm_client.post(
            BASE + "/",
            json={
                "quarter": 3,
                "year": 2026,
                "auditor_id": str(rm_user.id),
            },
        )
        assert resp.status_code == 403

    async def test_client_cannot_create(
        self, client_user_http: AsyncClient, client_user: User
    ) -> None:
        resp = await client_user_http.post(
            BASE + "/",
            json={
                "quarter": 3,
                "year": 2026,
                "auditor_id": str(client_user.id),
            },
        )
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(
            BASE + "/",
            json={
                "quarter": 3,
                "year": 2026,
            },
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List Audits
# ---------------------------------------------------------------------------


class TestListAudits:
    async def test_internal_can_list(
        self,
        rm_client: AsyncClient,
        access_audit: AccessAudit,
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "audits" in data
        assert data["total"] >= 1

    async def test_client_cannot_list(self, client_user_http: AsyncClient) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Get Audit
# ---------------------------------------------------------------------------


class TestGetAudit:
    async def test_get_audit_detail(
        self,
        rm_client: AsyncClient,
        access_audit: AccessAudit,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/{access_audit.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(access_audit.id)
        assert data["audit_period"] == "Q1 2026"

    async def test_nonexistent_returns_404(self, rm_client: AsyncClient) -> None:
        fake_id = str(uuid.uuid4())
        resp = await rm_client.get(f"{BASE}/{fake_id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Audit Statistics
# ---------------------------------------------------------------------------


class TestAuditStatistics:
    async def test_get_statistics(
        self,
        rm_client: AsyncClient,
        access_audit: AccessAudit,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/statistics")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Findings
# ---------------------------------------------------------------------------


class TestFindings:
    async def test_add_finding(
        self,
        compliance_client: AsyncClient,
        access_audit: AccessAudit,
        rm_user: User,
    ) -> None:
        resp = await compliance_client.post(
            f"{BASE}/{access_audit.id}/findings",
            json={
                "user_id": str(rm_user.id),
                "finding_type": "excessive_access",
                "severity": "high",
                "description": "Too many permissions",
            },
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["finding_type"] == "excessive_access"
        assert data["severity"] == "high"

    async def test_acknowledge_finding(
        self,
        compliance_client: AsyncClient,
        audit_finding: AccessAuditFinding,
    ) -> None:
        resp = await compliance_client.post(
            f"{BASE}/findings/{audit_finding.id}/acknowledge",
            json={"notes": "Acknowledged and reviewing"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "acknowledged"
