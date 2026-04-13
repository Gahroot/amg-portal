"""Tests for /api/v1/opportunities (CRM pipeline) endpoints."""

from __future__ import annotations

import uuid
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import OpportunityStage
from app.models.opportunity import Opportunity
from app.models.user import User

BASE = "/api/v1/opportunities"


def _payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "title": "Dubai Summit Protection",
        "value": "250000.00",
        "probability": 60,
        "stage": OpportunityStage.qualifying.value,
    }
    base.update(overrides)
    return base


def _make_opp(owner_id: uuid.UUID, **overrides: object) -> Opportunity:
    fields: dict[str, object] = {
        "id": uuid.uuid4(),
        "title": "Existing Opp",
        "stage": OpportunityStage.qualifying.value,
        "position": 0,
        "value": Decimal("100000"),
        "probability": 50,
        "owner_id": owner_id,
    }
    fields.update(overrides)
    return Opportunity(**fields)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


class TestCreateOpportunity:
    async def test_rm_create_assigns_owner_and_position(
        self, rm_client: AsyncClient, rm_user: User
    ) -> None:
        resp = await rm_client.post(BASE + "/", json=_payload())
        assert resp.status_code == 201
        data = resp.json()
        assert data["owner_id"] == str(rm_user.id)
        assert data["position"] == 0
        assert data["stage"] == OpportunityStage.qualifying.value

    async def test_create_increments_position_within_stage(self, rm_client: AsyncClient) -> None:
        first = await rm_client.post(BASE + "/", json=_payload(title="First"))
        second = await rm_client.post(BASE + "/", json=_payload(title="Second"))
        assert first.json()["position"] == 0
        assert second.json()["position"] == 1

    async def test_coordinator_cannot_create(self, coordinator_client: AsyncClient) -> None:
        resp = await coordinator_client.post(BASE + "/", json=_payload())
        assert resp.status_code == 403

    async def test_client_user_cannot_create(self, client_user_http: AsyncClient) -> None:
        resp = await client_user_http.post(BASE + "/", json=_payload())
        assert resp.status_code == 403

    async def test_unauthenticated(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(BASE + "/", json=_payload())
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List with scoping + filters
# ---------------------------------------------------------------------------


class TestListOpportunities:
    async def test_rm_only_sees_own(
        self,
        rm_client: AsyncClient,
        rm_user: User,
        rm_user_b: User,
        db_session: AsyncSession,
    ) -> None:
        db_session.add_all(
            [
                _make_opp(rm_user.id, title="Mine"),
                _make_opp(rm_user_b.id, title="Theirs"),
            ]
        )
        await db_session.commit()

        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        titles = {o["title"] for o in resp.json()["opportunities"]}
        assert "Mine" in titles
        assert "Theirs" not in titles

    async def test_md_sees_all(
        self,
        md_client: AsyncClient,
        rm_user: User,
        rm_user_b: User,
        db_session: AsyncSession,
    ) -> None:
        db_session.add_all(
            [
                _make_opp(rm_user.id, title="A"),
                _make_opp(rm_user_b.id, title="B"),
            ]
        )
        await db_session.commit()

        resp = await md_client.get(BASE + "/")
        titles = {o["title"] for o in resp.json()["opportunities"]}
        assert {"A", "B"} <= titles

    async def test_stage_filter(
        self, md_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        db_session.add_all(
            [
                _make_opp(rm_user.id, title="Q", stage=OpportunityStage.qualifying.value),
                _make_opp(rm_user.id, title="P", stage=OpportunityStage.proposal.value),
            ]
        )
        await db_session.commit()

        resp = await md_client.get(BASE + "/", params={"stage": OpportunityStage.proposal.value})
        titles = {o["title"] for o in resp.json()["opportunities"]}
        assert titles == {"P"}

    async def test_search_matches_title(
        self, md_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        db_session.add_all(
            [
                _make_opp(rm_user.id, title="Dubai Advance"),
                _make_opp(rm_user.id, title="London Estate"),
            ]
        )
        await db_session.commit()

        resp = await md_client.get(BASE + "/", params={"search": "dubai"})
        titles = {o["title"] for o in resp.json()["opportunities"]}
        assert titles == {"Dubai Advance"}


# ---------------------------------------------------------------------------
# Pipeline summary
# ---------------------------------------------------------------------------


class TestPipelineSummary:
    async def test_summary_has_entry_for_every_stage(
        self, md_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        db_session.add_all(
            [
                _make_opp(
                    rm_user.id,
                    title="q1",
                    stage=OpportunityStage.qualifying.value,
                    value=Decimal("100000"),
                    probability=50,
                ),
                _make_opp(
                    rm_user.id,
                    title="q2",
                    stage=OpportunityStage.qualifying.value,
                    value=Decimal("200000"),
                    probability=50,
                ),
                _make_opp(
                    rm_user.id,
                    title="won1",
                    stage=OpportunityStage.won.value,
                    value=Decimal("500000"),
                    probability=100,
                ),
            ]
        )
        await db_session.commit()

        resp = await md_client.get(f"{BASE}/pipeline-summary")
        assert resp.status_code == 200
        summary = {row["stage"]: row for row in resp.json()}
        assert set(summary.keys()) == {s.value for s in OpportunityStage}

        assert summary[OpportunityStage.qualifying.value]["count"] == 2
        assert Decimal(summary[OpportunityStage.qualifying.value]["total_value"]) == Decimal(
            "300000"
        )
        assert Decimal(summary[OpportunityStage.qualifying.value]["weighted_value"]) == Decimal(
            "150000"
        )

        assert summary[OpportunityStage.won.value]["count"] == 1
        assert Decimal(summary[OpportunityStage.won.value]["weighted_value"]) == Decimal("500000")

        assert summary[OpportunityStage.lost.value]["count"] == 0
        assert Decimal(summary[OpportunityStage.lost.value]["total_value"]) == Decimal("0")

    async def test_rm_summary_scoped_to_owner(
        self,
        rm_client: AsyncClient,
        rm_user: User,
        rm_user_b: User,
        db_session: AsyncSession,
    ) -> None:
        db_session.add_all(
            [
                _make_opp(rm_user.id, title="mine", value=Decimal("100000"), probability=50),
                _make_opp(rm_user_b.id, title="theirs", value=Decimal("999000"), probability=50),
            ]
        )
        await db_session.commit()

        resp = await rm_client.get(f"{BASE}/pipeline-summary")
        assert resp.status_code == 200
        summary = {row["stage"]: row for row in resp.json()}
        assert summary[OpportunityStage.qualifying.value]["count"] == 1
        assert Decimal(summary[OpportunityStage.qualifying.value]["total_value"]) == Decimal(
            "100000"
        )


# ---------------------------------------------------------------------------
# Update with stage side-effects
# ---------------------------------------------------------------------------


class TestUpdateOpportunity:
    async def test_move_to_won_sets_won_at_and_probability_100(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        opp = _make_opp(rm_user.id, probability=60)
        db_session.add(opp)
        await db_session.commit()

        resp = await rm_client.patch(f"{BASE}/{opp.id}", json={"stage": OpportunityStage.won.value})
        assert resp.status_code == 200
        data = resp.json()
        assert data["stage"] == OpportunityStage.won.value
        assert data["probability"] == 100
        assert data["won_at"] is not None
        assert data["lost_at"] is None

    async def test_move_to_lost_sets_lost_at_and_probability_zero(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        opp = _make_opp(rm_user.id, probability=60)
        db_session.add(opp)
        await db_session.commit()

        resp = await rm_client.patch(
            f"{BASE}/{opp.id}",
            json={"stage": OpportunityStage.lost.value, "lost_reason": "Budget cut"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["stage"] == OpportunityStage.lost.value
        assert data["probability"] == 0
        assert data["lost_at"] is not None
        assert data["lost_reason"] == "Budget cut"

    async def test_rm_cannot_update_other_rms_opp(
        self, rm_client: AsyncClient, rm_user_b: User, db_session: AsyncSession
    ) -> None:
        opp = _make_opp(rm_user_b.id)
        db_session.add(opp)
        await db_session.commit()

        resp = await rm_client.patch(f"{BASE}/{opp.id}", json={"title": "hacked"})
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Reorder (kanban drag-and-drop)
# ---------------------------------------------------------------------------


class TestReorderOpportunity:
    async def test_move_to_new_stage_to_top(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        q1 = _make_opp(rm_user.id, title="q1", stage=OpportunityStage.qualifying.value, position=0)
        q2 = _make_opp(rm_user.id, title="q2", stage=OpportunityStage.qualifying.value, position=1)
        p1 = _make_opp(rm_user.id, title="p1", stage=OpportunityStage.proposal.value, position=0)
        db_session.add_all([q1, q2, p1])
        await db_session.commit()

        resp = await rm_client.post(
            f"{BASE}/{q1.id}/reorder",
            json={"new_stage": OpportunityStage.proposal.value},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["stage"] == OpportunityStage.proposal.value
        assert data["position"] == 0

        # Pre-existing proposal item got pushed to position 1
        await db_session.refresh(p1)
        assert p1.position == 1

    async def test_move_after_specific_opportunity(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        p1 = _make_opp(rm_user.id, title="p1", stage=OpportunityStage.proposal.value, position=0)
        p2 = _make_opp(rm_user.id, title="p2", stage=OpportunityStage.proposal.value, position=1)
        q1 = _make_opp(rm_user.id, title="q1", stage=OpportunityStage.qualifying.value, position=0)
        db_session.add_all([p1, p2, q1])
        await db_session.commit()

        resp = await rm_client.post(
            f"{BASE}/{q1.id}/reorder",
            json={
                "new_stage": OpportunityStage.proposal.value,
                "after_opportunity_id": str(p1.id),
            },
        )
        assert resp.status_code == 200
        assert resp.json()["position"] == 1

        # Verify stage ordering is a dense 0..N after reorder
        result = await db_session.execute(
            select(Opportunity)
            .where(Opportunity.stage == OpportunityStage.proposal.value)
            .order_by(Opportunity.position)
        )
        ordered = [o.title for o in result.scalars().all()]
        assert ordered == ["p1", "q1", "p2"]

    async def test_reorder_to_won_sets_won_at(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        opp = _make_opp(rm_user.id, probability=40)
        db_session.add(opp)
        await db_session.commit()

        resp = await rm_client.post(
            f"{BASE}/{opp.id}/reorder", json={"new_stage": OpportunityStage.won.value}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["stage"] == OpportunityStage.won.value
        assert data["probability"] == 100
        assert data["won_at"] is not None

    async def test_rm_cannot_reorder_other_rms_opp(
        self, rm_client: AsyncClient, rm_user_b: User, db_session: AsyncSession
    ) -> None:
        opp = _make_opp(rm_user_b.id)
        db_session.add(opp)
        await db_session.commit()

        resp = await rm_client.post(
            f"{BASE}/{opp.id}/reorder", json={"new_stage": OpportunityStage.proposal.value}
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


class TestDeleteOpportunity:
    async def test_rm_can_delete_own(
        self, rm_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        opp = _make_opp(rm_user.id)
        db_session.add(opp)
        await db_session.commit()

        resp = await rm_client.delete(f"{BASE}/{opp.id}")
        assert resp.status_code == 204

    async def test_rm_cannot_delete_other_rms_opp(
        self, rm_client: AsyncClient, rm_user_b: User, db_session: AsyncSession
    ) -> None:
        opp = _make_opp(rm_user_b.id)
        db_session.add(opp)
        await db_session.commit()

        resp = await rm_client.delete(f"{BASE}/{opp.id}")
        assert resp.status_code == 403

    async def test_delete_missing_returns_404(self, md_client: AsyncClient) -> None:
        resp = await md_client.delete(f"{BASE}/{uuid.uuid4()}")
        assert resp.status_code == 404
