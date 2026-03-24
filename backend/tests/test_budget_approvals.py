"""Tests for /api/v1/budget-approvals (budget approval routing) endpoints."""

from __future__ import annotations

import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget_approval import (
    ApprovalChain,
    ApprovalChainStep,
    ApprovalThreshold,
)
from app.models.client import Client
from app.models.program import Program
from app.models.user import User

BASE = "/api/v1/budget-approvals"


# ---------------------------------------------------------------------------
# Local fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def budget_program(
    db_session: AsyncSession,
    db_client: Client,
    rm_user: User,
) -> Program:
    """A Program used for budget approval tests."""
    program = Program(
        id=uuid.uuid4(),
        client_id=db_client.id,
        title="Budget Test Program",
        status="active",
        budget_envelope=1_000_000,
        created_by=rm_user.id,
    )
    db_session.add(program)
    await db_session.commit()
    return program


@pytest_asyncio.fixture
async def approval_chain(
    db_session: AsyncSession,
    md_user: User,
) -> ApprovalChain:
    """A basic approval chain."""
    chain = ApprovalChain(
        id=uuid.uuid4(),
        name="Standard Chain",
        description="Test chain",
        is_active=True,
        created_by=md_user.id,
    )
    db_session.add(chain)
    await db_session.commit()
    return chain


@pytest_asyncio.fixture
async def chain_step(
    db_session: AsyncSession,
    approval_chain: ApprovalChain,
) -> ApprovalChainStep:
    """A step in the approval chain."""
    step = ApprovalChainStep(
        id=uuid.uuid4(),
        approval_chain_id=approval_chain.id,
        step_number=1,
        required_role="managing_director",
        is_parallel=False,
        timeout_hours=48,
    )
    db_session.add(step)
    await db_session.commit()
    return step


@pytest_asyncio.fixture
async def threshold(
    db_session: AsyncSession,
    approval_chain: ApprovalChain,
) -> ApprovalThreshold:
    """A threshold that routes to the standard chain."""
    t = ApprovalThreshold(
        id=uuid.uuid4(),
        name="Standard",
        min_amount=0,
        max_amount=500_000,
        approval_chain_id=approval_chain.id,
        is_active=True,
        priority=1,
    )
    db_session.add(t)
    await db_session.commit()
    return t


# ---------------------------------------------------------------------------
# Approval Chains
# ---------------------------------------------------------------------------


class TestApprovalChains:
    async def test_md_creates_chain(
        self, md_client: AsyncClient
    ) -> None:
        resp = await md_client.post(
            f"{BASE}/chains",
            json={
                "name": "New Chain",
                "is_active": True,
                "steps": [
                    {"step_number": 1, "required_role": "managing_director"},
                ],
            },
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["name"] == "New Chain"

    async def test_list_chains(
        self,
        rm_client: AsyncClient,
        approval_chain: ApprovalChain,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/chains")
        assert resp.status_code == 200
        items = resp.json()
        assert isinstance(items, list)
        assert len(items) >= 1

    async def test_get_chain(
        self,
        rm_client: AsyncClient,
        approval_chain: ApprovalChain,
        chain_step: ApprovalChainStep,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/chains/{approval_chain.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(approval_chain.id)

    async def test_client_cannot_create_chain(
        self, client_user_http: AsyncClient
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/chains",
            json={
                "name": "Blocked",
                "is_active": True,
                "steps": [
                    {"step_number": 1, "required_role": "managing_director"},
                ],
            },
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Approval Thresholds
# ---------------------------------------------------------------------------


class TestApprovalThresholds:
    async def test_md_creates_threshold(
        self,
        md_client: AsyncClient,
        approval_chain: ApprovalChain,
    ) -> None:
        resp = await md_client.post(
            f"{BASE}/thresholds",
            json={
                "name": "High",
                "min_amount": 500_000,
                "max_amount": 1_000_000,
                "approval_chain_id": str(approval_chain.id),
                "is_active": True,
                "priority": 1,
            },
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["name"] == "High"

    async def test_list_thresholds(
        self,
        rm_client: AsyncClient,
        threshold: ApprovalThreshold,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/thresholds")
        assert resp.status_code == 200
        items = resp.json()
        assert isinstance(items, list)
        assert len(items) >= 1

    async def test_client_cannot_create(
        self,
        client_user_http: AsyncClient,
        approval_chain: ApprovalChain,
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/thresholds",
            json={
                "name": "Blocked",
                "min_amount": 0,
                "max_amount": 100_000,
                "approval_chain_id": str(approval_chain.id),
                "is_active": True,
                "priority": 1,
            },
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Budget Requests
# ---------------------------------------------------------------------------


class TestBudgetRequests:
    async def test_rm_creates_request(
        self,
        rm_client: AsyncClient,
        budget_program: Program,
        threshold: ApprovalThreshold,
        chain_step: ApprovalChainStep,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/requests",
            json={
                "program_id": str(budget_program.id),
                "request_type": "budget_increase",
                "title": "Additional funding",
                "requested_amount": 50_000,
                "description": "Need more budget",
            },
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["title"] == "Additional funding"

    async def test_list_requests(
        self,
        rm_client: AsyncClient,
        budget_program: Program,
        threshold: ApprovalThreshold,
        chain_step: ApprovalChainStep,
    ) -> None:
        # Create a request first
        await rm_client.post(
            f"{BASE}/requests",
            json={
                "program_id": str(budget_program.id),
                "request_type": "budget_increase",
                "title": "List test request",
                "requested_amount": 25_000,
                "description": "For list test",
            },
        )
        resp = await rm_client.get(f"{BASE}/requests")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert data["total"] >= 1

    async def test_get_request(
        self,
        rm_client: AsyncClient,
        budget_program: Program,
        threshold: ApprovalThreshold,
        chain_step: ApprovalChainStep,
    ) -> None:
        create_resp = await rm_client.post(
            f"{BASE}/requests",
            json={
                "program_id": str(budget_program.id),
                "request_type": "budget_increase",
                "title": "Get test request",
                "requested_amount": 30_000,
                "description": "For get test",
            },
        )
        request_id = create_resp.json()["id"]

        resp = await rm_client.get(f"{BASE}/requests/{request_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == request_id

    async def test_pending_approvals(
        self,
        rm_client: AsyncClient,
    ) -> None:
        resp = await rm_client.get(f"{BASE}/requests/pending")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data

    async def test_client_cannot_create_request(
        self,
        client_user_http: AsyncClient,
        budget_program: Program,
    ) -> None:
        resp = await client_user_http.post(
            f"{BASE}/requests",
            json={
                "program_id": str(budget_program.id),
                "request_type": "budget_increase",
                "title": "Blocked",
                "requested_amount": 10_000,
                "description": "Should fail",
            },
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Budget Impact
# ---------------------------------------------------------------------------


class TestBudgetImpact:
    async def test_calculate_impact(
        self,
        rm_client: AsyncClient,
        budget_program: Program,
        threshold: ApprovalThreshold,
        chain_step: ApprovalChainStep,
    ) -> None:
        resp = await rm_client.post(
            f"{BASE}/impact",
            json={
                "program_id": str(budget_program.id),
                "requested_amount": 50_000,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "current_budget" in data
        assert "projected_budget" in data


# ---------------------------------------------------------------------------
# Step Decision / Auth
# ---------------------------------------------------------------------------


class TestApprovalStepDecision:
    async def test_unauthenticated_returns_401(
        self, anon_client: AsyncClient
    ) -> None:
        fake_id = str(uuid.uuid4())
        resp = await anon_client.post(
            f"{BASE}/steps/{fake_id}/decide",
            json={"decision": "approve", "comments": "ok"},
        )
        assert resp.status_code == 401
