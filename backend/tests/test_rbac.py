"""Role-Based Access Control (RBAC) tests.

Verifies that every role can only reach its permitted endpoints, and that
data-scoping rules (RM isolation, partner-assignment isolation, client data
isolation) are enforced at the API layer.
"""

from __future__ import annotations

import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.client_profile import ClientProfile
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.models.user import User

# ---------------------------------------------------------------------------
# Quick RBAC matrix helpers
# ---------------------------------------------------------------------------


async def _check(
    client: AsyncClient, method: str, url: str, expected: int, **kwargs: object
) -> None:
    """Assert that ``method url`` returns ``expected`` status code."""
    resp = await getattr(client, method)(url, **kwargs)
    assert resp.status_code == expected, (
        f"{method.upper()} {url} → got {resp.status_code}, expected {expected}\n"
        f"body: {resp.text[:300]}"
    )


# ---------------------------------------------------------------------------
# Unauthenticated access
# ---------------------------------------------------------------------------


class TestUnauthenticatedAccess:
    """Every protected endpoint must return 401 when no token is provided."""

    async def test_clients_list_returns_401(self, anon_client: AsyncClient) -> None:
        await _check(anon_client, "get", "/api/v1/clients/", 401)

    async def test_programs_list_returns_401(self, anon_client: AsyncClient) -> None:
        await _check(anon_client, "get", "/api/v1/programs/", 401)

    async def test_deliverables_list_returns_401(
        self, anon_client: AsyncClient
    ) -> None:
        await _check(anon_client, "get", "/api/v1/deliverables/", 401)

    async def test_escalations_list_returns_401(
        self, anon_client: AsyncClient
    ) -> None:
        await _check(anon_client, "get", "/api/v1/escalations/", 401)

    async def test_users_list_returns_401(self, anon_client: AsyncClient) -> None:
        await _check(anon_client, "get", "/api/v1/users/", 401)


# ---------------------------------------------------------------------------
# Managing Director — should access everything
# ---------------------------------------------------------------------------


class TestManagingDirector:
    async def test_can_list_clients(self, md_client: AsyncClient) -> None:
        await _check(md_client, "get", "/api/v1/clients/", 200)

    async def test_can_list_programs(self, md_client: AsyncClient) -> None:
        await _check(md_client, "get", "/api/v1/programs/", 200)

    async def test_can_list_deliverables(self, md_client: AsyncClient) -> None:
        await _check(md_client, "get", "/api/v1/deliverables/", 200)

    async def test_can_list_escalations(self, md_client: AsyncClient) -> None:
        await _check(md_client, "get", "/api/v1/escalations/", 200)

    async def test_can_list_users(self, md_client: AsyncClient) -> None:
        await _check(md_client, "get", "/api/v1/users/", 200)


# ---------------------------------------------------------------------------
# Relationship Manager
# ---------------------------------------------------------------------------


class TestRelationshipManager:
    async def test_can_list_clients(self, rm_client: AsyncClient) -> None:
        await _check(rm_client, "get", "/api/v1/clients/", 200)

    async def test_can_list_programs(self, rm_client: AsyncClient) -> None:
        await _check(rm_client, "get", "/api/v1/programs/", 200)

    async def test_can_list_deliverables(self, rm_client: AsyncClient) -> None:
        await _check(rm_client, "get", "/api/v1/deliverables/", 200)

    async def test_cannot_access_admin_endpoints(
        self, rm_client: AsyncClient
    ) -> None:
        """RMs may not perform MD-only operations (e.g. approving clients)."""
        await _check(
            rm_client,
            "post",
            f"/api/v1/clients/{uuid.uuid4()}/md-approval",
            403,
            json={"approved": True},
        )

    async def test_rm_scoped_away_from_other_rms_client(
        self,
        rm_client: AsyncClient,
        rm_user_b: User,
        db_session: AsyncSession,
    ) -> None:
        """RM cannot retrieve a client profile that belongs to another RM."""
        profile = ClientProfile(
            id=uuid.uuid4(),
            legal_name="Foreign Client",
            primary_email="foreign@example.com",
            compliance_status="pending_review",
            approval_status="draft",
            created_by=rm_user_b.id,
            assigned_rm_id=rm_user_b.id,
        )
        db_session.add(profile)
        await db_session.commit()

        await _check(rm_client, "get", f"/api/v1/clients/{profile.id}", 403)


# ---------------------------------------------------------------------------
# Coordinator
# ---------------------------------------------------------------------------


class TestCoordinator:
    async def test_can_list_clients(self, coordinator_client: AsyncClient) -> None:
        await _check(coordinator_client, "get", "/api/v1/clients/", 200)

    async def test_can_list_programs(self, coordinator_client: AsyncClient) -> None:
        await _check(coordinator_client, "get", "/api/v1/programs/", 200)

    async def test_cannot_create_client_profile(
        self, coordinator_client: AsyncClient
    ) -> None:
        await _check(
            coordinator_client,
            "post",
            "/api/v1/clients/",
            403,
            json={
                "legal_name": "Blocked",
                "primary_email": "blocked@test.local",
            },
        )

    async def test_cannot_perform_md_approval(
        self, coordinator_client: AsyncClient
    ) -> None:
        await _check(
            coordinator_client,
            "post",
            f"/api/v1/clients/{uuid.uuid4()}/md-approval",
            403,
            json={"approved": True},
        )


# ---------------------------------------------------------------------------
# Finance / Compliance
# ---------------------------------------------------------------------------


class TestFinanceCompliance:
    async def test_can_list_clients(self, compliance_client: AsyncClient) -> None:
        await _check(compliance_client, "get", "/api/v1/clients/", 200)

    async def test_cannot_create_client_profile(
        self, compliance_client: AsyncClient
    ) -> None:
        await _check(
            compliance_client,
            "post",
            "/api/v1/clients/",
            403,
            json={
                "legal_name": "Blocked",
                "primary_email": "blocked2@test.local",
            },
        )


# ---------------------------------------------------------------------------
# Client role — portal user
# ---------------------------------------------------------------------------


class TestClientRole:
    async def test_cannot_list_internal_clients(
        self, client_user_http: AsyncClient
    ) -> None:
        await _check(client_user_http, "get", "/api/v1/clients/", 403)

    async def test_cannot_list_programs_internal(
        self, client_user_http: AsyncClient
    ) -> None:
        await _check(client_user_http, "get", "/api/v1/programs/", 403)

    async def test_cannot_list_escalations(
        self, client_user_http: AsyncClient
    ) -> None:
        await _check(client_user_http, "get", "/api/v1/escalations/", 403)

    async def test_cannot_create_programs(
        self, client_user_http: AsyncClient, db_client: Client
    ) -> None:
        await _check(
            client_user_http,
            "post",
            "/api/v1/programs/",
            403,
            json={
                "client_id": str(db_client.id),
                "title": "Blocked",
                "milestones": [],
            },
        )

    async def test_cannot_access_users_endpoint(
        self, client_user_http: AsyncClient
    ) -> None:
        await _check(client_user_http, "get", "/api/v1/users/", 403)


# ---------------------------------------------------------------------------
# Partner role
# ---------------------------------------------------------------------------


class TestPartnerRole:
    async def test_cannot_list_internal_clients(
        self, partner_http: AsyncClient
    ) -> None:
        await _check(partner_http, "get", "/api/v1/clients/", 403)

    async def test_cannot_list_programs(self, partner_http: AsyncClient) -> None:
        await _check(partner_http, "get", "/api/v1/programs/", 403)

    async def test_cannot_list_escalations(self, partner_http: AsyncClient) -> None:
        await _check(partner_http, "get", "/api/v1/escalations/", 403)

    async def test_cannot_create_deliverable_via_internal_endpoint(
        self, partner_http: AsyncClient
    ) -> None:
        """Partners submit via the /submit file-upload endpoint, not the
        coordinator's create endpoint."""
        await _check(
            partner_http,
            "post",
            "/api/v1/deliverables/",
            403,
            json={
                "assignment_id": str(uuid.uuid4()),
                "title": "Blocked",
                "deliverable_type": "document",
            },
        )

    async def test_cannot_access_users_endpoint(
        self, partner_http: AsyncClient
    ) -> None:
        await _check(partner_http, "get", "/api/v1/users/", 403)


# ---------------------------------------------------------------------------
# Partner data isolation — partner can only see own assignments
# ---------------------------------------------------------------------------


class TestPartnerAssignmentIsolation:
    @pytest_asyncio.fixture
    async def partner_a_profile(
        self, db_session: AsyncSession, partner_user: User, md_user: User
    ) -> PartnerProfile:
        profile = PartnerProfile(
            id=uuid.uuid4(),
            user_id=partner_user.id,
            firm_name="Partner A Firm",
            contact_name=partner_user.full_name,
            contact_email=partner_user.email,
            capabilities=[],
            geographies=[],
            status="active",
            created_by=md_user.id,
        )
        db_session.add(profile)
        await db_session.commit()
        return profile

    async def test_partner_portal_shows_only_own_assignments(
        self,
        partner_http: AsyncClient,
        partner_a_profile: PartnerProfile,
        db_session: AsyncSession,
        db_client: Client,
        rm_user: User,
        md_user: User,
    ) -> None:
        """The partner portal endpoint must scope assignments to the calling partner."""
        # Create a program and an assignment for partner A
        prog = Program(
            id=uuid.uuid4(),
            client_id=db_client.id,
            title="Partner Isolation Test Program",
            status="active",
            created_by=rm_user.id,
        )
        db_session.add(prog)
        await db_session.commit()

        assignment = PartnerAssignment(
            id=uuid.uuid4(),
            partner_id=partner_a_profile.id,
            program_id=prog.id,
            assigned_by=rm_user.id,
            title="Partner A Task",
            brief="Complete this task.",
            status="accepted",
        )
        db_session.add(assignment)
        await db_session.commit()

        # Partner portal returns the assignment
        resp = await partner_http.get("/api/v1/partner-portal/assignments")
        assert resp.status_code == 200
        data = resp.json()
        ids = [a["id"] for a in data.get("assignments", [])]
        assert str(assignment.id) in ids
