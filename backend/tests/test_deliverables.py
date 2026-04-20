"""Tests for /api/v1/deliverables endpoints."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.deliverable import Deliverable
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.models.user import User

BASE = "/api/v1/deliverables"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def partner_profile(
    db_session: AsyncSession, partner_user: User, md_user: User
) -> PartnerProfile:
    """An active PartnerProfile linked to partner_user."""
    profile = PartnerProfile(
        id=uuid.uuid4(),
        user_id=partner_user.id,
        firm_name="Alpha Advisors Ltd",
        contact_name=partner_user.full_name,
        contact_email=partner_user.email,
        capabilities=["investment_advisory"],
        geographies=["UK"],
        status="active",
        created_by=md_user.id,
    )
    db_session.add(profile)
    await db_session.commit()
    return profile


@pytest_asyncio.fixture
async def test_program_for_deliverable(
    db_session: AsyncSession, db_client: Client, rm_user: User
) -> Program:
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Deliverable Test Program",
        status="active",
        created_by=rm_user.id,
    )
    db_session.add(program)
    await db_session.commit()
    return program


@pytest_asyncio.fixture
async def partner_assignment(
    db_session: AsyncSession,
    partner_profile: PartnerProfile,
    test_program_for_deliverable: Program,
    rm_user: User,
) -> PartnerAssignment:
    assignment = PartnerAssignment(
        id=uuid.uuid4(),
        partner_id=partner_profile.id,
        program_id=test_program_for_deliverable.id,
        assigned_by=rm_user.id,
        title="Investment Report",
        brief="Deliver quarterly investment report.",
        status="accepted",
        due_date=date.today() + timedelta(days=30),
    )
    db_session.add(assignment)
    await db_session.commit()
    return assignment


@pytest_asyncio.fixture
async def pending_deliverable(
    db_session: AsyncSession,
    partner_assignment: PartnerAssignment,
) -> Deliverable:
    d = Deliverable(
        id=uuid.uuid4(),
        assignment_id=partner_assignment.id,
        title="Q1 Investment Report",
        deliverable_type="report",
        description="Quarterly investment performance summary.",
        due_date=date.today() + timedelta(days=14),
        status="pending",
    )
    db_session.add(d)
    await db_session.commit()
    return d


@pytest_asyncio.fixture
async def submitted_deliverable(
    db_session: AsyncSession,
    partner_assignment: PartnerAssignment,
    partner_user: User,
) -> Deliverable:
    d = Deliverable(
        id=uuid.uuid4(),
        assignment_id=partner_assignment.id,
        title="Submitted Report",
        deliverable_type="report",
        status="submitted",
        submitted_by=partner_user.id,
        client_visible=False,
    )
    db_session.add(d)
    await db_session.commit()
    return d


# ---------------------------------------------------------------------------
# Create deliverable
# ---------------------------------------------------------------------------


class TestCreateDeliverable:
    async def test_coordinator_can_create(
        self,
        coordinator_client: AsyncClient,
        partner_assignment: PartnerAssignment,
    ) -> None:
        resp = await coordinator_client.post(
            BASE + "/",
            json={
                "assignment_id": str(partner_assignment.id),
                "title": "Onboarding Report",
                "deliverable_type": "report",
                "description": "Initial onboarding overview.",
                "due_date": (date.today() + timedelta(days=10)).isoformat(),
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Onboarding Report"
        assert data["status"] == "pending"
        assert data["client_visible"] is False

    async def test_rm_can_create(
        self,
        rm_client: AsyncClient,
        partner_assignment: PartnerAssignment,
    ) -> None:
        resp = await rm_client.post(
            BASE + "/",
            json={
                "assignment_id": str(partner_assignment.id),
                "title": "RM Created Deliverable",
                "deliverable_type": "document",
            },
        )
        assert resp.status_code == 201

    async def test_client_user_cannot_create(
        self,
        client_user_http: AsyncClient,
        partner_assignment: PartnerAssignment,
    ) -> None:
        resp = await client_user_http.post(
            BASE + "/",
            json={
                "assignment_id": str(partner_assignment.id),
                "title": "Blocked",
                "deliverable_type": "document",
            },
        )
        assert resp.status_code == 403

    async def test_invalid_assignment_returns_404(self, coordinator_client: AsyncClient) -> None:
        resp = await coordinator_client.post(
            BASE + "/",
            json={
                "assignment_id": str(uuid.uuid4()),
                "title": "Ghost",
                "deliverable_type": "document",
            },
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# List deliverables
# ---------------------------------------------------------------------------


class TestListDeliverables:
    async def test_internal_staff_can_list(self, rm_client: AsyncClient) -> None:
        resp = await rm_client.get(BASE + "/")
        assert resp.status_code == 200
        assert "deliverables" in resp.json()

    async def test_client_user_cannot_list(self, client_user_http: AsyncClient) -> None:
        resp = await client_user_http.get(BASE + "/")
        assert resp.status_code == 403

    async def test_filter_by_assignment_id(
        self,
        coordinator_client: AsyncClient,
        pending_deliverable: Deliverable,
        partner_assignment: PartnerAssignment,
    ) -> None:
        resp = await coordinator_client.get(
            BASE + "/",
            params={"assignment_id": str(partner_assignment.id)},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        ids = [d["id"] for d in data["deliverables"]]
        assert str(pending_deliverable.id) in ids


# ---------------------------------------------------------------------------
# Get single deliverable
# ---------------------------------------------------------------------------


class TestGetDeliverable:
    async def test_internal_staff_can_get(
        self,
        coordinator_client: AsyncClient,
        pending_deliverable: Deliverable,
    ) -> None:
        resp = await coordinator_client.get(f"{BASE}/{pending_deliverable.id}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Q1 Investment Report"

    async def test_client_user_cannot_get_internal_deliverable(
        self,
        client_user_http: AsyncClient,
        pending_deliverable: Deliverable,
    ) -> None:
        resp = await client_user_http.get(f"{BASE}/{pending_deliverable.id}")
        assert resp.status_code == 403

    async def test_nonexistent_returns_404(self, coordinator_client: AsyncClient) -> None:
        resp = await coordinator_client.get(f"{BASE}/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Review (approve / return / reject)
# ---------------------------------------------------------------------------


class TestReviewDeliverable:
    async def test_coordinator_can_approve(
        self,
        coordinator_client: AsyncClient,
        submitted_deliverable: Deliverable,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/{submitted_deliverable.id}/review",
            json={"status": "approved", "review_comments": "Excellent work."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "approved"
        # Approving a deliverable makes it visible to the client
        assert data["client_visible"] is True

    async def test_coordinator_can_reject(
        self,
        coordinator_client: AsyncClient,
        submitted_deliverable: Deliverable,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/{submitted_deliverable.id}/review",
            json={"status": "rejected", "review_comments": "Does not meet standards."},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"
        # Rejected deliverable should NOT be client-visible
        assert resp.json()["client_visible"] is False

    async def test_coordinator_can_return_for_revision(
        self,
        coordinator_client: AsyncClient,
        submitted_deliverable: Deliverable,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/{submitted_deliverable.id}/review",
            json={"status": "returned", "review_comments": "Please revise section 2."},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "returned"

    async def test_review_pending_deliverable_returns_400(
        self,
        coordinator_client: AsyncClient,
        pending_deliverable: Deliverable,
    ) -> None:
        """Can't review a deliverable that hasn't been submitted yet."""
        resp = await coordinator_client.post(
            f"{BASE}/{pending_deliverable.id}/review",
            json={"status": "approved"},
        )
        assert resp.status_code == 400

    async def test_invalid_review_status_returns_400(
        self,
        coordinator_client: AsyncClient,
        submitted_deliverable: Deliverable,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/{submitted_deliverable.id}/review",
            json={"status": "pending"},
        )
        assert resp.status_code == 400

    async def test_client_user_cannot_review(
        self,
        client_user_http: AsyncClient,
        submitted_deliverable: Deliverable,
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/{submitted_deliverable.id}/review",
            json={"status": "approved"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Client visibility gating
# ---------------------------------------------------------------------------


class TestClientVisibilityGating:
    async def test_pending_deliverable_not_client_visible(
        self,
        coordinator_client: AsyncClient,
        pending_deliverable: Deliverable,
    ) -> None:
        resp = await coordinator_client.get(f"{BASE}/{pending_deliverable.id}")
        assert resp.status_code == 200
        assert resp.json()["client_visible"] is False

    async def test_approved_deliverable_becomes_client_visible(
        self,
        coordinator_client: AsyncClient,
        submitted_deliverable: Deliverable,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/{submitted_deliverable.id}/review",
            json={"status": "approved"},
        )
        assert resp.status_code == 200
        assert resp.json()["client_visible"] is True

    async def test_non_approved_review_does_not_set_client_visible(
        self,
        coordinator_client: AsyncClient,
        submitted_deliverable: Deliverable,
    ) -> None:
        resp = await coordinator_client.post(
            f"{BASE}/{submitted_deliverable.id}/review",
            json={"status": "returned"},
        )
        assert resp.status_code == 200
        assert resp.json()["client_visible"] is False
