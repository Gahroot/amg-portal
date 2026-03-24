"""Tests for /api/v1/auth endpoints."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_refresh_token
from app.models.user import User
from tests.conftest import auth_headers, make_user

BASE = "/api/v1/auth"


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


class TestLogin:
    async def test_valid_credentials_in_mfa_grace_period(
        self, anon_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """Freshly-created users haven't set up MFA yet.  The response issues
        real tokens (because we're within the grace period) and sets
        ``mfa_setup_required=True``."""
        user = make_user("client")
        db_session.add(user)
        await db_session.commit()

        resp = await anon_client.post(
            f"{BASE}/login",
            json={"email": user.email, "password": "TestPass1!"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mfa_setup_required"] is True
        # Grace-period: real tokens are returned
        assert data["access_token"] != ""
        assert data["mfa_setup_token"] is not None

    async def test_wrong_password_returns_401(
        self, anon_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        user = make_user("client")
        db_session.add(user)
        await db_session.commit()

        resp = await anon_client.post(
            f"{BASE}/login",
            json={"email": user.email, "password": "WrongPass99!"},
        )
        assert resp.status_code == 401

    async def test_unknown_email_returns_401(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(
            f"{BASE}/login",
            json={"email": "nobody@test.local", "password": "TestPass1!"},
        )
        assert resp.status_code == 401

    async def test_suspended_account_returns_403(
        self, anon_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        user = make_user("client")
        user.status = "suspended"
        db_session.add(user)
        await db_session.commit()

        resp = await anon_client.post(
            f"{BASE}/login",
            json={"email": user.email, "password": "TestPass1!"},
        )
        assert resp.status_code == 403

    async def test_mfa_enabled_without_code_prompts_mfa(
        self, anon_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """When MFA is enabled, login without a code returns ``mfa_required=True``
        and empty tokens — forcing the caller to re-submit with an OTP."""
        user = make_user("coordinator")
        user.mfa_enabled = True
        user.mfa_secret = "JBSWY3DPEHPK3PXP"
        db_session.add(user)
        await db_session.commit()

        resp = await anon_client.post(
            f"{BASE}/login",
            json={"email": user.email, "password": "TestPass1!"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mfa_required"] is True
        assert data["access_token"] == ""
        assert data["refresh_token"] == ""

    async def test_mfa_enabled_invalid_code_returns_401(
        self, anon_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        user = make_user("coordinator")
        user.mfa_enabled = True
        user.mfa_secret = "JBSWY3DPEHPK3PXP"
        db_session.add(user)
        await db_session.commit()

        resp = await anon_client.post(
            f"{BASE}/login",
            json={
                "email": user.email,
                "password": "TestPass1!",
                "mfa_code": "000000",
            },
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------


class TestTokenRefresh:
    async def test_valid_refresh_token_issues_new_pair(
        self, anon_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        user = make_user("relationship_manager")
        db_session.add(user)
        await db_session.commit()

        refresh = create_refresh_token({"sub": str(user.id), "email": user.email})
        resp = await anon_client.post(
            f"{BASE}/refresh", json={"refresh_token": refresh}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["refresh_token"]

    async def test_invalid_refresh_token_returns_401(
        self, anon_client: AsyncClient
    ) -> None:
        resp = await anon_client.post(
            f"{BASE}/refresh", json={"refresh_token": "not-a-real-token"}
        )
        assert resp.status_code == 401

    async def test_refresh_for_suspended_user_returns_401(
        self, anon_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        user = make_user("relationship_manager")
        user.status = "suspended"
        db_session.add(user)
        await db_session.commit()

        refresh = create_refresh_token({"sub": str(user.id), "email": user.email})
        resp = await anon_client.post(
            f"{BASE}/refresh", json={"refresh_token": refresh}
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# /me (authenticated identity)
# ---------------------------------------------------------------------------


class TestGetMe:
    async def test_returns_current_user(
        self, anon_client: AsyncClient, rm_user: User
    ) -> None:
        anon_client.headers.update(auth_headers(rm_user))
        resp = await anon_client.get(f"{BASE}/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == rm_user.email
        assert data["role"] == "relationship_manager"

    async def test_unauthenticated_returns_401(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.get(f"{BASE}/me")
        assert resp.status_code == 401

    async def test_garbage_token_returns_401(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.get(
            f"{BASE}/me",
            headers={"Authorization": "Bearer invalid.jwt.garbage"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# MFA setup flow
# ---------------------------------------------------------------------------


class TestMFASetup:
    async def test_setup_returns_secret_and_qr_code(
        self, anon_client: AsyncClient, rm_user: User
    ) -> None:
        anon_client.headers.update(auth_headers(rm_user))
        resp = await anon_client.post(f"{BASE}/mfa/setup")
        assert resp.status_code == 200
        data = resp.json()
        assert "secret" in data
        assert "qr_code_base64" in data
        assert "backup_codes" in data
        assert len(data["backup_codes"]) > 0

    async def test_setup_requires_authentication(
        self, anon_client: AsyncClient
    ) -> None:
        resp = await anon_client.post(f"{BASE}/mfa/setup")
        assert resp.status_code == 401

    async def test_verify_setup_with_bad_code_returns_400(
        self, anon_client: AsyncClient, rm_user: User, db_session: AsyncSession
    ) -> None:
        """Calling verify-setup with a wrong TOTP code returns 400."""
        # First, initiate setup to store the secret on the user
        anon_client.headers.update(auth_headers(rm_user))
        setup_resp = await anon_client.post(f"{BASE}/mfa/setup")
        assert setup_resp.status_code == 200

        # Submit a clearly-wrong code
        resp = await anon_client.post(
            f"{BASE}/mfa/verify-setup", json={"code": "000000"}
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Profile update
# ---------------------------------------------------------------------------


class TestProfileUpdate:
    async def test_update_full_name(
        self, anon_client: AsyncClient, rm_user: User
    ) -> None:
        anon_client.headers.update(auth_headers(rm_user))
        resp = await anon_client.patch(
            f"{BASE}/me", json={"full_name": "Updated Name"}
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Updated Name"

    async def test_update_requires_authentication(
        self, anon_client: AsyncClient
    ) -> None:
        resp = await anon_client.patch(f"{BASE}/me", json={"full_name": "Anon"})
        assert resp.status_code == 401
