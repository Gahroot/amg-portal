"""Tests for /api/v1/partners endpoints (partner directory management)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner import PartnerProfile
from app.models.user import User

BASE = "/api/v1/partners"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_partner(
    db_session: AsyncSession,
    rm_user: User,
) -> PartnerProfile:
    """A PartnerProfile in pending status created by rm_user."""
    partner = PartnerProfile(
        id=uuid.uuid4(),
        firm_name="Acme Advisory Ltd",
        contact_name="Jane Partner",
        contact_email="jane@acme-advisory.example.com",
        contact_phone="+1-555-0100",
        capabilities=["investment_advisory", "tax_planning"],
        geographies=["US", "UK"],
        status="pending",
        created_by=rm_user.id,
    )
    db_session.add(partner)
    await db_session.commit()
    return partner


@pytest_asyncio.fixture
async def test_partner_active(
    db_session: AsyncSession,
    rm_user: User,
) -> PartnerProfile:
    """An active PartnerProfile with refresh metadata."""
    partner = PartnerProfile(
        id=uuid.uuid4(),
        firm_name="Active Partners Inc",
        contact_name="John Active",
        contact_email="john@active-partners.example.com",
        contact_phone="+1-555-0200",
        capabilities=["estate_planning"],
        geographies=["US"],
        status="active",
        created_by=rm_user.id,
    )
    db_session.add(partner)
    await db_session.commit()
    return partner


@pytest_asyncio.fixture
async def test_partner_overdue_refresh(
    db_session: AsyncSession,
    rm_user: User,
) -> PartnerProfile:
    """An active partner whose refresh_due_at is in the past (overdue)."""
    now = datetime.now(UTC)
    partner = PartnerProfile(
        id=uuid.uuid4(),
        firm_name="Overdue Refresh LLC",
        contact_name="Late Refresh",
        contact_email="late@overdue-refresh.example.com",
        contact_phone="+1-555-0300",
        capabilities=["legal"],
        geographies=["US"],
        status="active",
        created_by=rm_user.id,
        refresh_due_at=now - timedelta(days=30),
        last_refreshed_at=now - timedelta(days=395),
    )
    db_session.add(partner)
    await db_session.commit()
    return partner


@pytest_asyncio.fixture
async def test_partner_due_soon(
    db_session: AsyncSession,
    rm_user: User,
) -> PartnerProfile:
    """An active partner whose refresh_due_at is within 30 days."""
    now = datetime.now(UTC)
    partner = PartnerProfile(
        id=uuid.uuid4(),
        firm_name="Due Soon Partners",
        contact_name="Coming Due",
        contact_email="soon@due-soon.example.com",
        contact_phone="+1-555-0400",
        capabilities=["real_estate"],
        geographies=["UK"],
        status="active",
        created_by=rm_user.id,
        refresh_due_at=now + timedelta(days=15),
        last_refreshed_at=now - timedelta(days=350),
    )
    db_session.add(partner)
    await db_session.commit()
    return partner


# ---------------------------------------------------------------------------
# Create Partner
# ---------------------------------------------------------------------------


class TestCreatePartner:
    async def test_rm_can_create_partner(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.post(
            BASE + "/",
            json={
                "firm_name": "New Partner Firm",
                "contact_name": "New Contact",
                "contact_email": "new@partner.example.com",
                "contact_phone": "+1-555-0001",
                "capabilities": ["investment_advisory"],
                "geographies": ["US"],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["firm_name"] == "New Partner Firm"
        assert data["contact_email"] == "new@partner.example.com"
        assert data["status"] == "pending"
        assert "investment_advisory" in data["capabilities"]

    async def test_md_can_create_partner(
        self,
        md_client: AsyncClient,
    ) -> None:
        resp = await md_client.post(
            BASE + "/",
            json={
                "firm_name": "MD Created Firm",
                "contact_name": "MD Contact",
                "contact_email": "md@partner.example.com",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["firm_name"] == "MD Created Firm"

    async def test_coordinator_cannot_create_partner(
        self,
        coordinator_client: AsyncClient,
    ) -> None:
        resp = await coordinator_client.post(
            BASE + "/",
            json={
                "firm_name": "Blocked Firm",
                "contact_name": "Blocked",
                "contact_email": "blocked@partner.example.com",
            },
        )
        assert resp.status_code == 403

    async def test_client_cannot_create_partner(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.post(
            BASE + "/",
            json={
                "firm_name": "Blocked",
                "contact_name": "Blocked",
                "contact_email": "blocked2@partner.example.com",
            },
        )
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
    ) -> None:
        resp = await anon_client.post(
            BASE + "/",
            json={
                "firm_name": "Anon Firm",
                "contact_name": "Anon",
                "contact_email": "anon@partner.example.com",
            },
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List Partners
# ---------------------------------------------------------------------------


class TestListPartners:
    async def test_rm_can_list_partners(
        self,
        rm_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        data = resp.json()
        assert "profiles" in data
        assert "total" in data
        assert data["total"] >= 1

    async def test_md_can_list_partners(
        self,
        md_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        assert "profiles" in resp.json()

    async def test_coordinator_can_list_partners(
        self,
        coordinator_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await coordinator_client.get(BASE + "/")
        assert resp.status_code == 200
        assert "profiles" in resp.json()

    async def test_compliance_can_list_partners(
        self,
        compliance_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await compliance_client.get(BASE + "/")
        assert resp.status_code == 200
        assert "profiles" in resp.json()

    async def test_client_cannot_list_partners(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_partner_cannot_list_partners(
        self,
        partner_http: AsyncClient,
    ) -> None:
        resp = await partner_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_filter_by_status(
        self,
        rm_client: AsyncClient,
        test_partner: PartnerProfile,
        test_partner_active: PartnerProfile,
    ) -> None:
        resp = await rm_client.get(BASE + "/", params={"status": "pending"})
        assert resp.status_code == 200
        data = resp.json()
        for profile in data["profiles"]:
            assert profile["status"] == "pending"

    async def test_search_by_firm_name(
        self,
        rm_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await rm_client.get(BASE + "/", params={"search": "Acme"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        firm_names = [p["firm_name"] for p in data["profiles"]]
        assert any("Acme" in name for name in firm_names)


# ---------------------------------------------------------------------------
# Get Partner
# ---------------------------------------------------------------------------


class TestGetPartner:
    async def test_rm_can_get_partner(
        self,
        rm_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/{test_partner.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(test_partner.id)
        assert data["firm_name"] == test_partner.firm_name

    async def test_md_can_get_partner(
        self,
        md_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await md_client.get(f"{BASE}/{test_partner.id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == str(test_partner.id)

    async def test_coordinator_can_get_partner(
        self,
        coordinator_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await coordinator_client.get(f"{BASE}/{test_partner.id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == str(test_partner.id)

    async def test_get_nonexistent_partner_returns_404(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_client_cannot_get_partner(
        self,
        client_user_http: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/{test_partner.id}")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Update Partner
# ---------------------------------------------------------------------------


class TestUpdatePartner:
    async def test_rm_can_update_partner(
        self,
        rm_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await rm_client.patch(
            f"{BASE}/{test_partner.id}",
            json={
                "firm_name": "Updated Firm Name",
                "notes": "Added some notes",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["firm_name"] == "Updated Firm Name"
        assert data["notes"] == "Added some notes"

    async def test_md_can_update_partner(
        self,
        md_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await md_client.patch(
            f"{BASE}/{test_partner.id}",
            json={"contact_phone": "+1-555-9999"},
        )
        assert resp.status_code == 200
        assert resp.json()["contact_phone"] == "+1-555-9999"

    async def test_coordinator_cannot_update_partner(
        self,
        coordinator_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await coordinator_client.patch(
            f"{BASE}/{test_partner.id}",
            json={"firm_name": "Blocked Update"},
        )
        assert resp.status_code == 403

    async def test_update_nonexistent_partner_returns_404(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.patch(
            f"{BASE}/{uuid.uuid4()}",
            json={"firm_name": "Ghost"},
        )
        assert resp.status_code == 404

    async def test_update_status(
        self,
        rm_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await rm_client.patch(
            f"{BASE}/{test_partner.id}",
            json={"status": "active"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"


# ---------------------------------------------------------------------------
# Provision Partner
# ---------------------------------------------------------------------------


class TestProvisionPartner:
    async def test_md_can_provision_partner(
        self,
        md_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await md_client.post(
            f"{BASE}/{test_partner.id}/provision",
            json={"password": "TestPassword123!"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert data["user_id"] is not None

    async def test_md_can_provision_with_generated_password(
        self,
        md_client: AsyncClient,
        db_session: AsyncSession,
        rm_user: User,
    ) -> None:
        """Provision without providing a password - system generates one."""
        partner = PartnerProfile(
            id=uuid.uuid4(),
            firm_name="Auto Password Firm",
            contact_name="Auto Pass",
            contact_email="autopass@firm.example.com",
            status="pending",
            created_by=rm_user.id,
        )
        db_session.add(partner)
        await db_session.commit()

        resp = await md_client.post(f"{BASE}/{partner.id}/provision", json={})
        assert resp.status_code == 200
        assert resp.json()["user_id"] is not None

    async def test_rm_cannot_provision_partner(
        self,
        rm_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/{test_partner.id}/provision",
            json={"password": "TestPassword123!"},
        )
        assert resp.status_code == 403

    async def test_coordinator_cannot_provision_partner(
        self,
        coordinator_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/{test_partner.id}/provision",
            json={"password": "TestPassword123!"},
        )
        assert resp.status_code == 403

    async def test_provision_nonexistent_partner_returns_404(
        self,
        md_client: AsyncClient,
    ) -> None:
        resp = await md_client.post(
            f"{BASE}/{uuid.uuid4()}/provision",
            json={"password": "TestPassword123!"},
        )
        assert resp.status_code == 404

    async def test_cannot_provision_already_provisioned_partner(
        self,
        md_client: AsyncClient,
        db_session: AsyncSession,
        rm_user: User,
        partner_user: User,
    ) -> None:
        """Partner already has a user_id - should return 400."""
        partner = PartnerProfile(
            id=uuid.uuid4(),
            user_id=partner_user.id,
            firm_name="Already Provisioned",
            contact_name="Already Done",
            contact_email="already@provisioned.example.com",
            status="active",
            created_by=rm_user.id,
        )
        db_session.add(partner)
        await db_session.commit()

        resp = await md_client.post(
            f"{BASE}/{partner.id}/provision",
            json={"password": "TestPassword123!"},
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Refresh Due Partners
# ---------------------------------------------------------------------------


class TestRefreshDuePartners:
    async def test_rm_can_list_refresh_due_partners(
        self,
        rm_client: AsyncClient,
        test_partner_overdue_refresh: PartnerProfile,
    ) -> None:
        resp = await rm_client.get(BASE + "/refresh-due")
        assert resp.status_code == 200
        data = resp.json()
        assert "partners" in data
        assert "total" in data

    async def test_includes_overdue_partners(
        self,
        rm_client: AsyncClient,
        test_partner_overdue_refresh: PartnerProfile,
    ) -> None:
        resp = await rm_client.get(BASE + "/refresh-due")
        assert resp.status_code == 200
        data = resp.json()
        ids = [p["id"] for p in data["partners"]]
        assert str(test_partner_overdue_refresh.id) in ids
        # Find the specific partner in the response
        for p in data["partners"]:
            if p["id"] == str(test_partner_overdue_refresh.id):
                assert p["is_overdue"] is True

    async def test_includes_due_soon_by_default(
        self,
        rm_client: AsyncClient,
        test_partner_due_soon: PartnerProfile,
    ) -> None:
        resp = await rm_client.get(BASE + "/refresh-due")
        assert resp.status_code == 200
        data = resp.json()
        ids = [p["id"] for p in data["partners"]]
        assert str(test_partner_due_soon.id) in ids

    async def test_exclude_due_soon_with_flag(
        self,
        rm_client: AsyncClient,
        test_partner_due_soon: PartnerProfile,
        test_partner_overdue_refresh: PartnerProfile,
    ) -> None:
        resp = await rm_client.get(BASE + "/refresh-due", params={"include_due_soon": False})
        assert resp.status_code == 200
        data = resp.json()
        ids = [p["id"] for p in data["partners"]]
        # Overdue should still be included
        assert str(test_partner_overdue_refresh.id) in ids
        # Due soon should be excluded
        assert str(test_partner_due_soon.id) not in ids

    async def test_client_cannot_list_refresh_due(
        self,
        client_user_http: AsyncClient,
    ) -> None:
        resp = await client_user_http.get(BASE + "/refresh-due")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Upload Compliance Doc
# ---------------------------------------------------------------------------


class TestUploadComplianceDoc:
    async def test_rm_can_upload_compliance_doc(
        self,
        rm_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        with patch(
            "app.api.v1.partners.storage_service.upload_file",
            new_callable=AsyncMock,
        ) as mock_upload:
            mock_upload.return_value = ("partners/test/compliance/doc.pdf", 1024)

            resp = await rm_client.post(
                f"{BASE}/{test_partner.id}/compliance-doc",
                files={"file": ("compliance.pdf", b"fake pdf content", "application/pdf")},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["compliance_doc_url"] is not None

    async def test_md_can_upload_compliance_doc(
        self,
        md_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        with patch(
            "app.api.v1.partners.storage_service.upload_file",
            new_callable=AsyncMock,
        ) as mock_upload:
            mock_upload.return_value = ("partners/test/compliance/doc.pdf", 1024)

            resp = await md_client.post(
                f"{BASE}/{test_partner.id}/compliance-doc",
                files={"file": ("compliance.pdf", b"fake pdf content", "application/pdf")},
            )
            assert resp.status_code == 200

    async def test_coordinator_cannot_upload_compliance_doc(
        self,
        coordinator_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/{test_partner.id}/compliance-doc",
            files={"file": ("compliance.pdf", b"fake pdf content", "application/pdf")},
        )
        assert resp.status_code == 403

    async def test_upload_to_nonexistent_partner_returns_404(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/{uuid.uuid4()}/compliance-doc",
            files={"file": ("compliance.pdf", b"fake pdf content", "application/pdf")},
        )
        assert resp.status_code == 404

    async def test_client_cannot_upload_compliance_doc(
        self,
        client_user_http: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/{test_partner.id}/compliance-doc",
            files={"file": ("compliance.pdf", b"fake pdf content", "application/pdf")},
        )
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(
        self,
        anon_client: AsyncClient,
        test_partner: PartnerProfile,
    ) -> None:
        resp = await anon_client.post(
            f"{BASE}/{test_partner.id}/compliance-doc",
            files={"file": ("compliance.pdf", b"fake pdf content", "application/pdf")},
        )
        assert resp.status_code == 401
