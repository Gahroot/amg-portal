"""Integration tests for auth API endpoints."""
from __future__ import annotations

from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class TestRegister:
    async def test_register_success(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "new@example.com",
                "password": "StrongPass1!",
                "full_name": "New User",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "new@example.com"
        assert data["full_name"] == "New User"
        assert data["role"] == "client"
        assert data["status"] == "pending_approval"

    async def test_register_duplicate_email(self, client: AsyncClient, test_user: User) -> None:
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": test_user.email,
                "password": "StrongPass1!",
                "full_name": "Duplicate",
            },
        )
        assert resp.status_code == 409

    async def test_register_weak_password(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "weak@example.com",
                "password": "weak",
                "full_name": "Weak",
            },
        )
        assert resp.status_code == 422

    async def test_register_invalid_email(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "not-email",
                "password": "StrongPass1!",
                "full_name": "Bad Email",
            },
        )
        assert resp.status_code == 422


class TestLogin:
    async def test_login_success(self, client: AsyncClient, test_user: User) -> None:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "Test123!@#"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["token_type"] == "bearer"
        assert data["mfa_required"] is False

    async def test_login_wrong_password(self, client: AsyncClient, test_user: User) -> None:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "WrongPass1!"},
        )
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "Pass123!"},
        )
        assert resp.status_code == 401

    async def test_login_inactive_user(
        self, client: AsyncClient, db_session: AsyncSession
    ) -> None:
        import uuid

        from app.core.security import hash_password
        from app.models.user import User as UserModel

        user = UserModel(
            id=uuid.uuid4(),
            email="inactive@example.com",
            hashed_password=hash_password("Test123!@#"),
            full_name="Inactive",
            role="client",
            status="pending_approval",
        )
        db_session.add(user)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "inactive@example.com", "password": "Test123!@#"},
        )
        assert resp.status_code == 403


class TestRefreshToken:
    async def test_refresh_success(self, client: AsyncClient, test_user: User) -> None:
        # Login first
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "Test123!@#"},
        )
        refresh_token = login_resp.json()["refresh_token"]

        # Refresh
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["refresh_token"]

    async def test_refresh_invalid_token(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
        )
        assert resp.status_code == 401


class TestGetMe:
    async def test_get_me_authenticated(
        self, client: AsyncClient, test_user: User, auth_headers: dict[str, Any]
    ) -> None:
        resp = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == test_user.email
        assert data["full_name"] == test_user.full_name

    async def test_get_me_unauthenticated(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 401


class TestHealthCheck:
    async def test_health_endpoint(self, client: AsyncClient) -> None:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "healthy"}
