"""Tests for /api/v1/clients (client profile management) endpoints."""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client_profile import ClientProfile
from app.models.user import User

BASE = "/api/v1/clients"

_PROFILE_PAYLOAD = {
    "legal_name": "Doe Family Trust",
    "primary_email": "doe@example.com",
}


# ---------------------------------------------------------------------------
# Create client profile
# ---------------------------------------------------------------------------


class TestCreateClientProfile:
    async def test_rm_can_create(self, rm_client: AsyncClient) -> None:
        resp = await rm_client.post(BASE + "/", json=_PROFILE_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["legal_name"] == "Doe Family Trust"
        # Service sets compliance status on intake
        assert data["compliance_status"] == "pending_review"

    async def test_md_can_create(self, md_client: AsyncClient) -> None:
        resp = await md_client.post(
            BASE + "/",
            json={
                "legal_name": "MD Created Client",
                "primary_email": "mdcreated@example.com",
            },
        )
        assert resp.status_code == 201

    async def test_coordinator_cannot_create(
        self, coordinator_client: AsyncClient
    ) -> None:
        resp = await coordinator_client.post(
            BASE + "/",
            json={"legal_name": "Blocked", "primary_email": "blocked@example.com"},
        )
        assert resp.status_code == 403

    async def test_client_user_cannot_create(
        self, client_user_http: AsyncClient
    ) -> None:
        resp = await client_user_http.post(
            BASE + "/",
            json={"legal_name": "Blocked", "primary_email": "blocked2@example.com"},
        )
        assert resp.status_code == 403

    async def test_partner_cannot_create(self, partner_http: AsyncClient) -> None:
        resp = await partner_http.post(
            BASE + "/",
            json={"legal_name": "Blocked", "primary_email": "blocked3@example.com"},
        )
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(
        self, anon_client: AsyncClient
    ) -> None:
        resp = await anon_client.post(
            BASE + "/",
            json={"legal_name": "Blocked", "primary_email": "blocked4@example.com"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List client profiles — RM scoping
# ---------------------------------------------------------------------------


class TestListClientProfiles:
    async def test_rm_only_sees_own_clients(
        self,
        rm_client: AsyncClient,
        rm_user: User,
        rm_user_b: User,
        db_session: AsyncSession,
    ) -> None:
        mine = ClientProfile(
            id=uuid.uuid4(),
            legal_name="Mine Client",
            primary_email="mine@example.com",
            compliance_status="pending_review",
            approval_status="draft",
            created_by=rm_user.id,
            assigned_rm_id=rm_user.id,
        )
        theirs = ClientProfile(
            id=uuid.uuid4(),
            legal_name="Other Client",
            primary_email="other@example.com",
            compliance_status="pending_review",
            approval_status="draft",
            created_by=rm_user_b.id,
            assigned_rm_id=rm_user_b.id,
        )
        db_session.add_all([mine, theirs])
        await db_session.commit()

        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        emails = {p["primary_email"] for p in resp.json()["profiles"]}
        assert "mine@example.com" in emails
        assert "other@example.com" not in emails

    async def test_md_sees_all_clients(
        self,
        md_client: AsyncClient,
        rm_user: User,
        rm_user_b: User,
        db_session: AsyncSession,
    ) -> None:
        p1 = ClientProfile(
            id=uuid.uuid4(),
            legal_name="Client Alpha",
            primary_email="alpha@example.com",
            compliance_status="pending_review",
            approval_status="draft",
            created_by=rm_user.id,
            assigned_rm_id=rm_user.id,
        )
        p2 = ClientProfile(
            id=uuid.uuid4(),
            legal_name="Client Beta",
            primary_email="beta@example.com",
            compliance_status="pending_review",
            approval_status="draft",
            created_by=rm_user_b.id,
            assigned_rm_id=rm_user_b.id,
        )
        db_session.add_all([p1, p2])
        await db_session.commit()

        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        emails = {p["primary_email"] for p in resp.json()["profiles"]}
        assert "alpha@example.com" in emails
        assert "beta@example.com" in emails

    async def test_client_user_cannot_list(
        self, client_user_http: AsyncClient
    ) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_partner_cannot_list(self, partner_http: AsyncClient) -> None:
        resp = await partner_http.get(BASE + "/")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Get single client profile
# ---------------------------------------------------------------------------


class TestGetClientProfile:
    async def test_rm_accesses_own_portfolio_ok(
        self,
        rm_client: AsyncClient,
        db_client_profile: ClientProfile,
    ) -> None:
        # db_client_profile is assigned to rm_user who is behind rm_client
        resp = await rm_client.get(f"{BASE}/{db_client_profile.id}")
        assert resp.status_code == 200

    async def test_rm_denied_for_another_rms_client(
        self,
        rm_client: AsyncClient,
        rm_user_b: User,
        db_session: AsyncSession,
    ) -> None:
        profile = ClientProfile(
            id=uuid.uuid4(),
            legal_name="Not My Client",
            primary_email="notmy@example.com",
            compliance_status="pending_review",
            approval_status="draft",
            created_by=rm_user_b.id,
            assigned_rm_id=rm_user_b.id,
        )
        db_session.add(profile)
        await db_session.commit()

        resp = await rm_client.get(f"{BASE}/{profile.id}")
        assert resp.status_code == 403

    async def test_md_can_access_any_profile(
        self,
        md_client: AsyncClient,
        db_client_profile: ClientProfile,
    ) -> None:
        resp = await md_client.get(f"{BASE}/{db_client_profile.id}")
        assert resp.status_code == 200

    async def test_nonexistent_profile_returns_404(
        self, md_client: AsyncClient
    ) -> None:
        resp = await md_client.get(f"{BASE}/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Compliance review
# ---------------------------------------------------------------------------


class TestComplianceReview:
    async def test_compliance_user_can_submit_review(
        self,
        compliance_client: AsyncClient,
        db_client_profile: ClientProfile,
    ) -> None:
        resp = await compliance_client.post(
            f"{BASE}/{db_client_profile.id}/compliance-review",
            json={"status": "cleared", "notes": "All KYC docs verified."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["compliance_status"] == "cleared"
        # When cleared the workflow bumps approval_status to pending_md_approval
        assert data["approval_status"] == "pending_md_approval"

    async def test_md_can_submit_compliance_review(
        self,
        md_client: AsyncClient,
        db_client_profile: ClientProfile,
    ) -> None:
        resp = await md_client.post(
            f"{BASE}/{db_client_profile.id}/compliance-review",
            json={"status": "flagged", "notes": "Needs more docs."},
        )
        assert resp.status_code == 200

    async def test_rm_cannot_submit_compliance_review(
        self,
        rm_client: AsyncClient,
        db_client_profile: ClientProfile,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/{db_client_profile.id}/compliance-review",
            json={"status": "cleared", "notes": "test"},
        )
        assert resp.status_code == 403

    async def test_coordinator_cannot_submit_compliance_review(
        self,
        coordinator_client: AsyncClient,
        db_client_profile: ClientProfile,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/{db_client_profile.id}/compliance-review",
            json={"status": "cleared", "notes": "test"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# MD approval
# ---------------------------------------------------------------------------


class TestMDApproval:
    async def test_md_can_approve(
        self,
        md_client: AsyncClient,
        db_client_profile_pending_md: ClientProfile,
    ) -> None:
        resp = await md_client.post(
            f"{BASE}/{db_client_profile_pending_md.id}/md-approval",
            json={"approved": True, "notes": "Approved by MD."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["approval_status"] == "approved"

    async def test_md_can_reject(
        self,
        md_client: AsyncClient,
        db_client_profile_pending_md: ClientProfile,
    ) -> None:
        resp = await md_client.post(
            f"{BASE}/{db_client_profile_pending_md.id}/md-approval",
            json={"approved": False, "notes": "Rejected."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["approval_status"] == "rejected"

    async def test_rm_cannot_approve(
        self,
        rm_client: AsyncClient,
        db_client_profile_pending_md: ClientProfile,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/{db_client_profile_pending_md.id}/md-approval",
            json={"approved": True},
        )
        assert resp.status_code == 403

    async def test_md_approval_on_wrong_state_returns_400(
        self,
        md_client: AsyncClient,
        db_client_profile: ClientProfile,  # still in draft/pending_review state
    ) -> None:
        """Attempting MD approval when profile isn't in pending_md_approval state
        should fail with 400."""
        resp = await md_client.post(
            f"{BASE}/{db_client_profile.id}/md-approval",
            json={"approved": True},
        )
        assert resp.status_code == 400
