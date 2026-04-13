"""Tests for /api/v1/leads (CRM lead pipeline) endpoints."""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import LeadSource, LeadStatus
from app.models.lead import Lead
from app.models.user import User

BASE = "/api/v1/leads"


def _payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "full_name": "Jane Prospect",
        "email": "jane@prospect.example",
        "company": "Prospect Holdings",
        "source": LeadSource.inbound_web.value,
    }
    base.update(overrides)
    return base


def _make_lead(owner_id: uuid.UUID, **overrides: object) -> Lead:
    fields: dict[str, object] = {
        "id": uuid.uuid4(),
        "full_name": "Existing Lead",
        "email": f"lead_{uuid.uuid4().hex[:6]}@example.com",
        "status": LeadStatus.new.value,
        "source": LeadSource.other.value,
        "owner_id": owner_id,
    }
    fields.update(overrides)
    return Lead(**fields)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


class TestCreateLead:
    async def test_rm_can_create_assigns_self_as_owner(
        self, rm_client: AsyncClient, rm_user: User
    ) -> None:
        resp = await rm_client.post(BASE + "/", json=_payload())
        assert resp.status_code == 201
        data = resp.json()
        assert data["full_name"] == "Jane Prospect"
        assert data["owner_id"] == str(rm_user.id)
        assert data["status"] == LeadStatus.new.value

    async def test_md_can_create(self, md_client: AsyncClient) -> None:
        resp = await md_client.post(BASE + "/", json=_payload(email="md@prospect.example"))
        assert resp.status_code == 201

    async def test_coordinator_cannot_create(self, coordinator_client: AsyncClient) -> None:
        resp = await coordinator_client.post(BASE + "/", json=_payload())
        assert resp.status_code == 403

    async def test_client_user_cannot_create(self, client_user_http: AsyncClient) -> None:
        resp = await client_user_http.post(BASE + "/", json=_payload())
        assert resp.status_code == 403

    async def test_partner_cannot_create(self, partner_http: AsyncClient) -> None:
        resp = await partner_http.post(BASE + "/", json=_payload())
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(BASE + "/", json=_payload())
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List with filters + RM scoping
# ---------------------------------------------------------------------------


class TestListLeads:
    async def test_rm_only_sees_own_leads(
        self,
        rm_client: AsyncClient,
        rm_user: User,
        rm_user_b: User,
        db_session: AsyncSession,
    ) -> None:
        mine = _make_lead(rm_user.id, full_name="Mine Lead")
        theirs = _make_lead(rm_user_b.id, full_name="Their Lead")
        db_session.add_all([mine, theirs])
        await db_session.commit()

        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        names = {lead["full_name"] for lead in resp.json()["leads"]}
        assert "Mine Lead" in names
        assert "Their Lead" not in names

    async def test_md_sees_all_leads(
        self,
        md_client: AsyncClient,
        rm_user: User,
        rm_user_b: User,
        db_session: AsyncSession,
    ) -> None:
        db_session.add_all(
            [
                _make_lead(rm_user.id, full_name="Alpha"),
                _make_lead(rm_user_b.id, full_name="Beta"),
            ]
        )
        await db_session.commit()

        resp = await md_client.get(BASE + "/")
        assert resp.status_code == 200
        names = {lead["full_name"] for lead in resp.json()["leads"]}
        assert {"Alpha", "Beta"} <= names

    async def test_status_filter(
        self, md_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        db_session.add_all(
            [
                _make_lead(
                    rm_user.id, full_name="Qualified One", status=LeadStatus.qualified.value
                ),
                _make_lead(rm_user.id, full_name="New One", status=LeadStatus.new.value),
            ]
        )
        await db_session.commit()

        resp = await md_client.get(BASE + "/", params={"status": LeadStatus.qualified.value})
        assert resp.status_code == 200
        names = {lead["full_name"] for lead in resp.json()["leads"]}
        assert names == {"Qualified One"}

    async def test_search_matches_name_or_email(
        self, md_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        db_session.add_all(
            [
                _make_lead(rm_user.id, full_name="Harrington Scion", email="h@example.com"),
                _make_lead(rm_user.id, full_name="Nobody", email="nobody@example.com"),
            ]
        )
        await db_session.commit()

        resp = await md_client.get(BASE + "/", params={"search": "harrington"})
        assert resp.status_code == 200
        names = {lead["full_name"] for lead in resp.json()["leads"]}
        assert names == {"Harrington Scion"}

    async def test_client_user_cannot_list(self, client_user_http: AsyncClient) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_partner_cannot_list(self, partner_http: AsyncClient) -> None:
        resp = await partner_http.get(BASE + "/")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Get / Update / Delete with RM scoping
# ---------------------------------------------------------------------------


class TestGetLead:
    async def test_rm_can_access_own(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id)
        db_session.add(lead)
        await db_session.commit()

        resp = await rm_client.get(f"{BASE}/{lead.id}")
        assert resp.status_code == 200

    async def test_rm_denied_for_other_rms_lead(
        self, rm_client: AsyncClient, rm_user_b: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user_b.id)
        db_session.add(lead)
        await db_session.commit()

        resp = await rm_client.get(f"{BASE}/{lead.id}")
        assert resp.status_code == 403

    async def test_md_can_access_any(
        self, md_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id)
        db_session.add(lead)
        await db_session.commit()

        resp = await md_client.get(f"{BASE}/{lead.id}")
        assert resp.status_code == 200

    async def test_missing_returns_404(self, md_client: AsyncClient) -> None:
        resp = await md_client.get(f"{BASE}/{uuid.uuid4()}")
        assert resp.status_code == 404


class TestUpdateLead:
    async def test_rm_can_update_own(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id)
        db_session.add(lead)
        await db_session.commit()

        resp = await rm_client.patch(
            f"{BASE}/{lead.id}", json={"status": LeadStatus.qualifying.value, "notes": "Hot"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == LeadStatus.qualifying.value
        assert data["notes"] == "Hot"

    async def test_rm_cannot_update_other_rms_lead(
        self, rm_client: AsyncClient, rm_user_b: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user_b.id)
        db_session.add(lead)
        await db_session.commit()

        resp = await rm_client.patch(f"{BASE}/{lead.id}", json={"notes": "no"})
        assert resp.status_code == 403


class TestDeleteLead:
    async def test_rm_can_delete_own(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id)
        db_session.add(lead)
        await db_session.commit()

        resp = await rm_client.delete(f"{BASE}/{lead.id}")
        assert resp.status_code == 204

        resp = await rm_client.get(f"{BASE}/{lead.id}")
        assert resp.status_code == 404

    async def test_rm_cannot_delete_other_rms_lead(
        self, rm_client: AsyncClient, rm_user_b: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user_b.id)
        db_session.add(lead)
        await db_session.commit()

        resp = await rm_client.delete(f"{BASE}/{lead.id}")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Convert to ClientProfile
# ---------------------------------------------------------------------------


class TestConvertLead:
    async def _convert_body(self, **overrides: object) -> dict[str, object]:
        body: dict[str, object] = {
            "legal_name": "Jane Prospect Family Trust",
            "primary_email": "jane@prospect.example",
            "entity_type": "family_office",
            "notes": "Converted from qualified lead",
        }
        body.update(overrides)
        return body

    async def test_rm_can_convert_qualified_lead(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id, status=LeadStatus.qualified.value)
        db_session.add(lead)
        await db_session.commit()

        resp = await rm_client.post(f"{BASE}/{lead.id}/convert", json=await self._convert_body())
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == LeadStatus.converted.value
        assert data["converted_at"] is not None
        assert data["converted_client_profile_id"] is not None

    async def test_cannot_convert_already_converted(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id, status=LeadStatus.converted.value)
        db_session.add(lead)
        await db_session.commit()

        resp = await rm_client.post(f"{BASE}/{lead.id}/convert", json=await self._convert_body())
        assert resp.status_code == 400

    async def test_cannot_convert_disqualified(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id, status=LeadStatus.disqualified.value)
        db_session.add(lead)
        await db_session.commit()

        resp = await rm_client.post(f"{BASE}/{lead.id}/convert", json=await self._convert_body())
        assert resp.status_code == 400

    async def test_convert_missing_returns_404(self, md_client: AsyncClient) -> None:
        resp = await md_client.post(
            f"{BASE}/{uuid.uuid4()}/convert", json=await self._convert_body()
        )
        assert resp.status_code == 404

    async def test_coordinator_cannot_convert(
        self, coordinator_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id, status=LeadStatus.qualified.value)
        db_session.add(lead)
        await db_session.commit()

        resp = await coordinator_client.post(
            f"{BASE}/{lead.id}/convert", json=await self._convert_body()
        )
        assert resp.status_code == 403
