"""Auth core endpoints — login, register, token refresh, step-up."""

import contextlib
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, CurrentUser
from app.core.config import settings
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    UnauthorizedException,
)
from app.core.rate_limit import (
    rate_limit_forgot_password,
    rate_limit_login,
    rate_limit_refresh,
    rate_limit_register,
)
from app.core.security import (
    create_access_token,
    create_mfa_setup_token,
    create_password_reset_token,
    create_refresh_token,
    create_step_up_token,
    decode_password_reset_token,
    decode_refresh_token,
    decrypt_mfa_secret,
    hash_password,
    hash_token,
    verify_password,
)
from app.middleware.csrf import clear_csrf_cookie, set_csrf_cookie
from app.models.enums import UserRole
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    StepUpTokenRequest,
    Token,
    UserCreate,
    UserResponse,
)
from app.services.email_service import (
    send_password_reset_email,
    send_registration_account_exists_email,
)
from app.services.hibp import enforce_not_pwned
from app.services.mfa_service import (
    verify_backup_code,
    verify_totp,
)

router = APIRouter()


def _is_cross_origin() -> bool:
    """True when frontend and backend are on different origins."""
    try:
        from urllib.parse import urlparse

        fe = urlparse(settings.FRONTEND_URL)
        be = urlparse(settings.BACKEND_URL)
        return fe.hostname != be.hostname
    except Exception:
        return False


# Cookie names use the ``__Host-`` prefix, which browsers enforce to require
# ``Secure``, ``Path=/``, and a missing ``Domain`` attribute.  This guarantees
# the cookie is first-party-only and cannot be set by a less-secure origin
# (e.g. a sibling sub-domain on plain HTTP).
ACCESS_COOKIE_NAME = "__Host-access_token"
REFRESH_COOKIE_NAME = "__Host-refresh_token"
MFA_SETUP_COOKIE_NAME = "__Host-mfa-setup-token"


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    *,
    user_id: str,
) -> None:
    """Set httpOnly cookies for access + refresh tokens, plus the CSRF cookie.

    The ``__Host-`` prefix mandates ``Secure`` and ``Path=/`` and forbids a
    ``Domain`` attribute.  In local HTTP development we have to relax the
    ``Secure`` flag, so the legacy ``access_token`` / ``refresh_token`` names
    are used instead — the ``__Host-`` prefix is only valid over HTTPS.

    The CSRF cookie value is HMAC-bound to *user_id* so the ``CSRFMiddleware``
    can reject a cookie that does not belong to the caller's current session.
    """
    cross_origin = _is_cross_origin()
    # Cross-origin deployments (separate frontend/backend domains) require
    # SameSite=none + Secure so the browser sends cookies on XHR requests.
    samesite: Literal["lax", "strict", "none"] = "none" if cross_origin else "lax"
    secure = True if cross_origin else not settings.DEBUG
    # Browsers silently drop a ``__Host-`` cookie unless ``Secure=True`` —
    # fall back to the un-prefixed name on plain HTTP (DEBUG + same-origin).
    use_host_prefix = secure
    access_key = ACCESS_COOKIE_NAME if use_host_prefix else "access_token"
    refresh_key = REFRESH_COOKIE_NAME if use_host_prefix else "refresh_token"
    response.set_cookie(
        key=access_key,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        domain=settings.COOKIE_DOMAIN,
    )
    # Refresh cookie must now live at Path=/ so the ``__Host-`` prefix is
    # accepted by the browser.  The refresh handler reads ``request.cookies``
    # directly (not path-scoped), so widening the path does not change
    # endpoint behaviour — only widens which requests *carry* the cookie.
    response.set_cookie(
        key=refresh_key,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )
    # CSRF cookie: only set over HTTPS (``__Host-`` + Secure).  Over plain HTTP
    # the CSRFMiddleware exemption for local dev is handled by the browser
    # never carrying the cookie, so enforcement degrades cleanly.
    if secure:
        set_csrf_cookie(response, user_id)


def _clear_auth_cookies(response: Response) -> None:
    """Clear auth cookies (both the __Host- prefixed and legacy names)."""
    response.delete_cookie(key=ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")
    # Clean up any stale cookies set under the pre-__Host- names so a rollout
    # does not leave dangling cookies in users' browsers.
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/v1/auth/refresh")
    # CSRF cookie is session-scoped; drop it on logout.
    clear_csrf_cookie(response)


def _set_mfa_setup_cookie(response: Response, token: str) -> None:
    """Set a short-lived httpOnly cookie for the MFA setup token.

    Uses the ``__Host-`` prefix when running over HTTPS; falls back to the
    un-prefixed name on plain HTTP so local development still works.
    """
    cross_origin = _is_cross_origin()
    samesite: Literal["lax", "strict", "none"] = "none" if cross_origin else "lax"
    secure = True if cross_origin else not settings.DEBUG
    use_host_prefix = secure
    key = MFA_SETUP_COOKIE_NAME if use_host_prefix else "mfa_setup_token"
    # Path must be ``/`` for the ``__Host-`` prefix; the dependency that reads
    # this cookie (`get_mfa_setup_user`) looks it up by name, not by path.
    response.set_cookie(
        key=key,
        value=token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.MFA_SETUP_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def _clear_mfa_setup_cookie(response: Response) -> None:
    """Clear the MFA setup cookie (both the __Host- prefixed and legacy names)."""
    response.delete_cookie(key=MFA_SETUP_COOKIE_NAME, path="/")
    response.delete_cookie(key="mfa_setup_token", path="/")
    # Clear the legacy path-scoped variant too.
    response.delete_cookie(key="mfa_setup_token", path="/api/v1/auth/mfa")


async def _issue_refresh_token(
    db: AsyncSession,
    user_id: str,
    token_data: dict[str, Any],
    *,
    family_id: str | None = None,
) -> str:
    """Create a refresh token, store its hash, return the raw JWT."""
    fid = family_id or str(uuid.uuid4())
    jti = str(uuid.uuid4())
    token = create_refresh_token(token_data, family=fid, jti=jti)
    expires_at = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=hash_token(token),
            jti=jti,
            family_id=fid,
            is_revoked=False,
            expires_at=expires_at,
            last_active_at=datetime.now(UTC),
        )
    )
    return token


@router.post(
    "/register",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(rate_limit_register)],
)
async def register(data: UserCreate, db: DB) -> dict[str, str]:
    """Register a new account.

    Always returns ``202 Accepted`` with the same body regardless of whether
    the email was already in use — the API itself must not leak account
    existence.  Differentiation happens via email:

    * brand-new address → the account is created ``pending_approval`` and the
      usual onboarding flow continues from there.
    * existing address → a distinct "account already exists; use password
      reset" email is sent to the legitimate owner.

    Timing of the two branches is kept roughly uniform by hashing the password
    in both cases (bcrypt dominates the wall-clock cost of the endpoint).
    """
    await enforce_not_pwned(data.password)

    # Always run the password hash — even on the duplicate branch — so an
    # attacker cannot distinguish "email taken" from "email free" via timing.
    hashed = hash_password(data.password)

    result = await db.execute(select(User).where(User.email == data.email))
    existing = result.scalar_one_or_none()

    generic_body = {
        "message": "If the email is eligible, a confirmation will be sent.",
    }

    if existing is not None:
        # Fire-and-forget notification to the legitimate owner.  Errors are
        # suppressed: email delivery failures must never propagate into a
        # response that would re-leak the account-exists signal.
        with contextlib.suppress(Exception):
            await send_registration_account_exists_email(
                email=existing.email,
                frontend_url=settings.FRONTEND_URL,
            )
        return generic_body

    user = User(
        email=data.email,
        hashed_password=hashed,
        full_name=data.full_name,
        role=UserRole.client.value,
        status="pending_approval",
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        # Race with a concurrent registration that slipped in after our
        # pre-check; still do not reveal anything — treat as duplicate.
        await db.rollback()
        with contextlib.suppress(Exception):
            await send_registration_account_exists_email(
                email=data.email,
                frontend_url=settings.FRONTEND_URL,
            )
        return generic_body
    return generic_body


@router.post("/login", response_model=Token, dependencies=[Depends(rate_limit_login)])
async def login(data: LoginRequest, db: DB, response: Response) -> Any:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    ok, needs_rehash = (
        verify_password(data.password, user.hashed_password) if user else (False, False)
    )
    if not user or not ok:
        raise UnauthorizedException("Invalid email or password")
    if needs_rehash:
        user.hashed_password = hash_password(data.password)

    if user.status != "active":
        raise ForbiddenException("Account is not active")

    # ── MFA exempt (e.g. demo accounts) ─────────────────────
    if user.email in settings.MFA_EXEMPT_EMAILS:
        user.last_login_at = datetime.now(UTC)
        token_data = {"sub": str(user.id), "email": user.email}
        access_token = create_access_token(token_data)
        refresh_token = await _issue_refresh_token(db, str(user.id), token_data)
        await db.commit()
        _set_auth_cookies(response, access_token, refresh_token, user_id=str(user.id))
        return Token(access_token=access_token, refresh_token=refresh_token)

    # ── MFA not yet set up ──────────────────────────────────
    if not user.mfa_enabled:
        setup_token_data = {"sub": str(user.id), "email": user.email}
        setup_token = create_mfa_setup_token(setup_token_data)

        # Grace period: users created within MFA_GRACE_PERIOD_DAYS can still
        # access the app, but are required to complete setup immediately.
        # Users past the grace period receive no real tokens — setup is mandatory.
        grace_deadline = user.created_at + timedelta(days=settings.MFA_GRACE_PERIOD_DAYS)
        within_grace = datetime.now(UTC) <= grace_deadline

        if within_grace:
            # Soft enforcement: issue real tokens so the app is accessible,
            # but flag that setup must be completed.
            user.last_login_at = datetime.now(UTC)
            token_data = {"sub": str(user.id), "email": user.email}
            access_token = create_access_token(token_data)
            refresh_token = await _issue_refresh_token(db, str(user.id), token_data)
            await db.commit()
            _set_auth_cookies(response, access_token, refresh_token, user_id=str(user.id))
            _set_mfa_setup_cookie(response, setup_token)
            return Token(
                access_token=access_token,
                refresh_token=refresh_token,
                mfa_setup_required=True,
                mfa_setup_token=setup_token,
            )

        # Hard enforcement: no real tokens until MFA is configured.
        _set_mfa_setup_cookie(response, setup_token)
        return Token(
            access_token="",
            refresh_token="",
            mfa_setup_required=True,
            mfa_setup_token=None,
        )

    # ── MFA enabled — require TOTP/backup code ──────────────
    if not data.mfa_code:
        return Token(
            access_token="",
            refresh_token="",
            mfa_required=True,
        )

    # Try TOTP first, then backup codes
    mfa_valid = False
    if user.mfa_secret:
        decrypted_secret = decrypt_mfa_secret(user.mfa_secret)
        if verify_totp(decrypted_secret, data.mfa_code):
            mfa_valid = True
    elif user.mfa_backup_codes:
        valid, remaining = verify_backup_code(user.mfa_backup_codes, data.mfa_code)
        if valid:
            mfa_valid = True
            user.mfa_backup_codes = remaining
            await db.commit()

    if not mfa_valid:
        raise UnauthorizedException("Invalid MFA code")

    user.last_login_at = datetime.now(UTC)
    token_data = {"sub": str(user.id), "email": user.email}
    access_token = create_access_token(token_data)
    refresh_token = await _issue_refresh_token(db, str(user.id), token_data)
    await db.commit()
    _set_auth_cookies(response, access_token, refresh_token, user_id=str(user.id))
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=Token, dependencies=[Depends(rate_limit_refresh)])
async def refresh(
    request: Request,
    response: Response,
    db: DB,
    data: RefreshTokenRequest | None = None,
) -> Any:
    # Accept refresh token from request body (legacy) or httpOnly cookie.
    # Prefer the ``__Host-`` prefixed cookie (HTTPS prod) and fall back to
    # the legacy name for rollout compatibility / plain-HTTP local dev.
    cookie_token = request.cookies.get(REFRESH_COOKIE_NAME) or request.cookies.get("refresh_token")
    raw_token = data.refresh_token if data and data.refresh_token else cookie_token
    if not raw_token:
        raise UnauthorizedException("Missing refresh token")

    payload = decode_refresh_token(raw_token)
    if payload is None:
        raise UnauthorizedException("Invalid refresh token")

    user_id = payload.get("sub")
    token_jti = payload.get("jti")
    token_family = payload.get("family")
    if not user_id or not token_jti or not token_family:
        raise UnauthorizedException("Invalid refresh token")

    # Look up the stored token by jti
    result = await db.execute(select(RefreshToken).where(RefreshToken.jti == token_jti))
    stored_token = result.scalar_one_or_none()

    if stored_token is None:
        raise UnauthorizedException("Invalid refresh token")

    # Reuse detection: if this token was already revoked, revoke the entire family
    if stored_token.is_revoked:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == token_family, RefreshToken.is_revoked.is_(False))
            .values(is_revoked=True)
        )
        await db.commit()
        _clear_auth_cookies(response)
        raise UnauthorizedException("Refresh token reuse detected")

    # Verify token hash matches
    if stored_token.token_hash != hash_token(raw_token):
        raise UnauthorizedException("Invalid refresh token")

    # Phase 2.12 — sliding idle timeout.  If this family has been inactive
    # longer than the configured window, revoke the whole family so a
    # resumed device cannot silently roll forward to a fresh pair.
    idle_limit = settings.REFRESH_TOKEN_IDLE_TIMEOUT_MINUTES
    last_active = stored_token.last_active_at or stored_token.created_at
    if idle_limit is not None and last_active is not None:
        now = datetime.now(UTC)
        # ``created_at`` may be naïve in legacy rows — coerce to UTC.
        if last_active.tzinfo is None:
            last_active = last_active.replace(tzinfo=UTC)
        if now - last_active > timedelta(minutes=idle_limit):
            await db.execute(
                update(RefreshToken)
                .where(
                    RefreshToken.family_id == token_family,
                    RefreshToken.is_revoked.is_(False),
                )
                .values(is_revoked=True)
            )
            await db.commit()
            _clear_auth_cookies(response)
            raise UnauthorizedException("Session idle timeout")

    # Mark current token as revoked (rotation)
    stored_token.is_revoked = True

    # Verify user exists and is active
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    if not user or user.status != "active":
        await db.commit()
        raise UnauthorizedException("User not found or inactive")

    # Issue new token pair in the same family
    token_data = {"sub": str(user.id), "email": user.email}
    access_token = create_access_token(token_data)
    refresh_token = await _issue_refresh_token(
        db,
        str(user.id),
        token_data,
        family_id=token_family,
    )
    await db.commit()
    _set_auth_cookies(response, access_token, refresh_token, user_id=str(user.id))
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def logout(request: Request, response: Response, db: DB) -> None:
    """Clear auth cookies and revoke the current refresh token."""
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME) or request.cookies.get("refresh_token")
    if raw_token:
        payload = decode_refresh_token(raw_token)
        if payload:
            token_jti = payload.get("jti")
            if token_jti:
                result = await db.execute(select(RefreshToken).where(RefreshToken.jti == token_jti))
                stored_token = result.scalar_one_or_none()
                if stored_token and not stored_token.is_revoked:
                    stored_token.is_revoked = True
                    await db.commit()
    _clear_auth_cookies(response)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser) -> Any:
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def change_password(
    data: ChangePasswordRequest,
    current_user: CurrentUser,
    db: DB,
) -> None:
    ok, _ = verify_password(data.current_password, current_user.hashed_password)
    if not ok:
        raise BadRequestException("Current password is incorrect")

    await enforce_not_pwned(data.new_password)
    current_user.hashed_password = hash_password(data.new_password)

    # Revoke all active refresh tokens so sessions using the old password
    # are immediately invalidated (prevents stolen-token persistence).
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.is_revoked.is_(False),
        )
        .values(is_revoked=True)
    )

    await db.commit()


# ── Password Reset endpoints ────────────────────────────────


@router.post("/forgot-password", dependencies=[Depends(rate_limit_forgot_password)])
async def forgot_password(data: ForgotPasswordRequest, db: DB) -> dict[str, str]:
    """Request a password reset link.

    Always returns the same response to prevent email enumeration attacks.
    Only sends an email if the user actually exists.
    """
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    # Always return the same response regardless of whether user exists
    if user:
        # Generate reset token
        token_data = {"sub": str(user.id), "email": user.email}
        reset_token = create_password_reset_token(token_data)

        # Persist a hash of the token so we can enforce single-use
        expires_at = datetime.now(UTC) + timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
        )
        db.add(
            PasswordResetToken(
                user_id=str(user.id),
                token_hash=hash_token(reset_token),
                is_used=False,
                expires_at=expires_at,
            )
        )
        await db.commit()

        # Send reset email (non-blocking, errors are suppressed to prevent enumeration)
        with contextlib.suppress(Exception):
            await send_password_reset_email(
                email=user.email,
                name=user.full_name,
                reset_token=reset_token,
                frontend_url=settings.FRONTEND_URL,
            )

    return {"message": "If this email exists, a reset link has been sent"}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(data: ResetPasswordRequest, db: DB) -> None:
    """Reset password using a valid reset token.

    The token is single-use: on first successful reset its DB record is
    marked as consumed so replay attempts within the 15-minute window are
    rejected immediately.
    """
    payload = decode_password_reset_token(data.token)
    if payload is None:
        raise BadRequestException("Invalid or expired reset token")

    user_id = payload.get("sub")
    if not user_id:
        raise BadRequestException("Invalid reset token")

    # Look up the persisted token record and enforce single-use
    token_hash = hash_token(data.token)
    prt_result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    prt = prt_result.scalar_one_or_none()

    if prt is None or prt.is_used:
        raise BadRequestException("Invalid or expired reset token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise BadRequestException("Invalid reset token")

    await enforce_not_pwned(data.new_password)

    # Consume the token before updating the password so concurrent requests fail
    prt.is_used = True

    # Update password
    user.hashed_password = hash_password(data.new_password)
    await db.commit()


# ── Step-up auth (Phase 2.10) ───────────────────────────────


@router.post("/step-up")
async def mint_step_up_token(
    data: StepUpTokenRequest,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """Mint a short-lived step-up token for a list of sensitive actions.

    The caller must re-authenticate by providing either:

    * ``password`` — the current account password, or
    * ``totp_code`` — a valid TOTP (if MFA is enabled).

    The returned token is single-session and must be replayed in the
    ``X-Step-Up-Token`` header when calling a gated endpoint.
    """
    # Verify at least one factor.
    proved = False
    if data.password:
        ok, _ = verify_password(data.password, current_user.hashed_password)
        if ok:
            proved = True
    if not proved and data.totp_code:
        if not current_user.mfa_secret:
            raise BadRequestException("MFA not enrolled; cannot use TOTP for step-up")
        decrypted = decrypt_mfa_secret(current_user.mfa_secret)
        if verify_totp(decrypted, data.totp_code):
            proved = True

    if not proved:
        raise UnauthorizedException("Step-up re-authentication failed")

    if not data.action_scope:
        raise BadRequestException("action_scope must include at least one action")

    token = create_step_up_token(
        {"sub": str(current_user.id), "email": current_user.email},
        action_scope=data.action_scope,
    )
    return {
        "step_up_token": token,
        "expires_in": settings.STEP_UP_TOKEN_EXPIRE_MINUTES * 60,
        "action_scope": data.action_scope,
    }
