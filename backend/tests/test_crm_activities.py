"""Tests for /api/v1/crm-activities (CRM activity timeline) endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm_activity import CrmActivity
from app.models.enums import CrmActivityType, LeadSource, LeadStatus, OpportunityStage
from app.models.lead import Lead
from app.models.opportunity import Opportunity
from app.models.user import User

BASE = "/api/v1/crm-activities"


def _make_lead(owner_id: uuid.UUID) -> Lead:
    return Lead(
        id=uuid.uuid4(),
        full_name="Timeline Lead",
        email=f"lead_{uuid.uuid4().hex[:6]}@example.com",
        status=LeadStatus.new.value,
        source=LeadSource.other.value,
        owner_id=owner_id,
    )


def _make_opp(owner_id: uuid.UUID) -> Opportunity:
    return Opportunity(
        id=uuid.uuid4(),
        title="Timeline Opp",
        stage=OpportunityStage.qualifying.value,
        position=0,
        probability=50,
        owner_id=owner_id,
    )


def _make_activity(
    created_by: uuid.UUID,
    *,
    lead_id: uuid.UUID | None = None,
    opportunity_id: uuid.UUID | None = None,
    client_profile_id: uuid.UUID | None = None,
    subject: str = "Activity",
    occurred_at: datetime | None = None,
) -> CrmActivity:
    return CrmActivity(
        id=uuid.uuid4(),
        type=CrmActivityType.note.value,
        subject=subject,
        body="body",
        occurred_at=occurred_at or datetime.now(UTC),
        lead_id=lead_id,
        opportunity_id=opportunity_id,
        client_profile_id=client_profile_id,
        created_by=created_by,
    )


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


class TestCreateActivity:
    async def test_rm_can_create_note_on_lead(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id)
        db_session.add(lead)
        await db_session.commit()

        resp = await rm_client.post(
            BASE + "/",
            json={
                "type": CrmActivityType.call.value,
                "subject": "Discovery call",
                "body": "Discussed program scope",
                "lead_id": str(lead.id),
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["type"] == CrmActivityType.call.value
        assert data["subject"] == "Discovery call"
        assert data["lead_id"] == str(lead.id)
        assert data["created_by"] == str(rm_user.id)
        assert data["occurred_at"] is not None

    async def test_rm_can_create_activity_on_opportunity(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        opp = _make_opp(rm_user.id)
        db_session.add(opp)
        await db_session.commit()

        resp = await rm_client.post(
            BASE + "/",
            json={"subject": "Proposal sent", "opportunity_id": str(opp.id)},
        )
        assert resp.status_code == 201
        assert resp.json()["opportunity_id"] == str(opp.id)

    async def test_activity_requires_a_parent(self, rm_client: AsyncClient) -> None:
        resp = await rm_client.post(BASE + "/", json={"subject": "orphan"})
        assert resp.status_code == 422

    async def test_coordinator_cannot_create(
        self, coordinator_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id)
        db_session.add(lead)
        await db_session.commit()

        resp = await coordinator_client.post(
            BASE + "/", json={"subject": "x", "lead_id": str(lead.id)}
        )
        assert resp.status_code == 403

    async def test_client_user_cannot_create(
        self, client_user_http: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id)
        db_session.add(lead)
        await db_session.commit()

        resp = await client_user_http.post(
            BASE + "/", json={"subject": "x", "lead_id": str(lead.id)}
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# List with filters
# ---------------------------------------------------------------------------


class TestListActivities:
    async def test_list_filter_by_lead(
        self, md_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead_a = _make_lead(rm_user.id)
        lead_b = _make_lead(rm_user.id)
        db_session.add_all([lead_a, lead_b])
        await db_session.flush()

        db_session.add_all(
            [
                _make_activity(rm_user.id, lead_id=lead_a.id, subject="on A"),
                _make_activity(rm_user.id, lead_id=lead_a.id, subject="also on A"),
                _make_activity(rm_user.id, lead_id=lead_b.id, subject="on B"),
            ]
        )
        await db_session.commit()

        resp = await md_client.get(BASE + "/", params={"lead_id": str(lead_a.id)})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 2
        subjects = {a["subject"] for a in body["activities"]}
        assert subjects == {"on A", "also on A"}

    async def test_list_filter_by_opportunity(
        self, md_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        opp = _make_opp(rm_user.id)
        db_session.add(opp)
        await db_session.flush()
        db_session.add(_make_activity(rm_user.id, opportunity_id=opp.id, subject="opp note"))
        await db_session.commit()

        resp = await md_client.get(BASE + "/", params={"opportunity_id": str(opp.id)})
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    async def test_list_orders_by_occurred_at_desc(
        self, md_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id)
        db_session.add(lead)
        await db_session.flush()

        now = datetime.now(UTC)
        db_session.add_all(
            [
                _make_activity(
                    rm_user.id,
                    lead_id=lead.id,
                    subject="older",
                    occurred_at=now - timedelta(hours=2),
                ),
                _make_activity(rm_user.id, lead_id=lead.id, subject="newer", occurred_at=now),
            ]
        )
        await db_session.commit()

        resp = await md_client.get(BASE + "/", params={"lead_id": str(lead.id)})
        subjects = [a["subject"] for a in resp.json()["activities"]]
        assert subjects == ["newer", "older"]

    async def test_client_user_cannot_list(self, client_user_http: AsyncClient) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_partner_cannot_list(self, partner_http: AsyncClient) -> None:
        resp = await partner_http.get(BASE + "/")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Update + delete
# ---------------------------------------------------------------------------


class TestUpdateActivity:
    async def test_rm_can_update_subject_and_body(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id)
        db_session.add(lead)
        await db_session.flush()
        activity = _make_activity(rm_user.id, lead_id=lead.id)
        db_session.add(activity)
        await db_session.commit()

        resp = await rm_client.patch(
            f"{BASE}/{activity.id}",
            json={"subject": "Updated", "body": "new body"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["subject"] == "Updated"
        assert data["body"] == "new body"

    async def test_update_missing_returns_404(self, md_client: AsyncClient) -> None:
        resp = await md_client.patch(f"{BASE}/{uuid.uuid4()}", json={"subject": "x"})
        assert resp.status_code == 404


class TestDeleteActivity:
    async def test_rm_can_delete(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id)
        db_session.add(lead)
        await db_session.flush()
        activity = _make_activity(rm_user.id, lead_id=lead.id)
        db_session.add(activity)
        await db_session.commit()

        resp = await rm_client.delete(f"{BASE}/{activity.id}")
        assert resp.status_code == 204

    async def test_delete_missing_returns_404(self, md_client: AsyncClient) -> None:
        resp = await md_client.delete(f"{BASE}/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_coordinator_cannot_delete(
        self, coordinator_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        lead = _make_lead(rm_user.id)
        db_session.add(lead)
        await db_session.flush()
        activity = _make_activity(rm_user.id, lead_id=lead.id)
        db_session.add(activity)
        await db_session.commit()

        resp = await coordinator_client.delete(f"{BASE}/{activity.id}")
        assert resp.status_code == 403
