"""CSRF double-submit middleware.

Pattern
-------
1. ``__Host-csrf`` cookie (non-``HttpOnly`` so the SPA can read it).
2. ``X-CSRF-Token`` request header on every state-changing method.
3. The token is an HMAC over the user's session identifier (the access-token
   ``jti`` — or the ``sub`` claim as a fallback).  Because the attacker on
   another origin cannot read the cookie (SameSite=none + first-party-only
   ``__Host-`` prefix) *and* cannot forge the HMAC (requires SECRET_KEY),
   double-submit gives us strong CSRF protection even on cross-site POSTs.

The HMAC binding defends against the classic double-submit weakness where a
MITM-ish attacker who can set cookies on the victim's domain (sibling sub-domain
take-over, etc.) could otherwise pair their own chosen cookie with a matching
header.  Binding to the session means a token minted for user A cannot be
replayed by user B even if the cookie is controlled.

Binding choice
--------------
We bind the HMAC to the JWT ``sub`` claim (user id) today because access
tokens in this codebase do not yet carry a ``jti``.  The helper still
prefers ``jti`` when one is present, so when Phase 1.x adds ``jti`` to
access tokens we pick up per-issuance rotation "for free" — older tokens
minted before the change continue to validate against the ``sub`` fallback.

The trade-off: binding to ``sub`` means the cookie remains valid across
refreshes for the same user, so a CSRF cookie leaked from one session
would still verify after that user logs back in.  This is considered
acceptable because the cookie is ``Secure + SameSite=none + __Host-``
first-party-only, so the only realistic leak vector is a successful XSS
on the SPA — at which point the attacker has already won.

Exempt methods / paths
----------------------
* ``GET``/``HEAD``/``OPTIONS`` — safe by RFC 9110; preflight cannot carry cookies.
* Unauthenticated auth endpoints — login / register / refresh / forgot-password
  do not have a session yet, so there is nothing to bind to.
* ``/docs``, ``/redoc``, ``/openapi.json``, ``/health`` — served to browsers
  without session-auth.
"""

from __future__ import annotations

import hmac
from collections.abc import Awaitable, Callable
from hashlib import sha256
from typing import Any, Final, Literal

import jwt
import jwt.exceptions
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_403_FORBIDDEN

from app.core.config import settings

CSRF_COOKIE_NAME: Final[str] = "__Host-csrf"
CSRF_HEADER_NAME: Final[str] = "X-CSRF-Token"

# Methods that mutate server state and therefore require CSRF protection.
_PROTECTED_METHODS: Final[frozenset[str]] = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# Exact path matches that are exempt from CSRF enforcement.
# Kept narrow — only endpoints where no session exists (pre-auth) or that
# must work without the SPA (health probe, OpenAPI docs).
_EXEMPT_PATHS: Final[frozenset[str]] = frozenset(
    {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/openapi.json",
        "/health",
    }
)

# Path *prefixes* that are exempt (e.g. Swagger UI assets).
_EXEMPT_PREFIXES: Final[tuple[str, ...]] = ("/docs", "/redoc")


def _session_binding_from_payload(payload: dict[str, Any]) -> str | None:
    """Return the value we HMAC to produce the CSRF token.

    Prefers the unique ``jti`` so rotation invalidates the CSRF token;
    falls back to ``sub`` for payloads minted before ``jti`` was added.
    """
    jti = payload.get("jti")
    if isinstance(jti, str) and jti:
        return jti
    sub = payload.get("sub")
    if isinstance(sub, str) and sub:
        return sub
    return None


def _decode_access_token_silently(token: str) -> dict[str, Any] | None:
    """Decode an access JWT without raising.

    Kept inline (rather than importing ``decode_access_token``) so this
    middleware remains isolated from the auth module's import graph.
    """
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except jwt.exceptions.InvalidTokenError:
        return None
    if payload.get("type") != "access":
        return None
    return payload


def compute_csrf_token(session_binding: str) -> str:
    """Compute the expected CSRF token for a given session binding.

    HMAC-SHA256 over the session binding, keyed by ``SECRET_KEY``, hex-encoded.
    Callers setting the cookie after login should use this helper so the
    cookie value and middleware check stay in lock-step.
    """
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        session_binding.encode("utf-8"),
        digestmod=sha256,
    ).hexdigest()


def _extract_access_token(request: Request) -> str | None:
    """Return the current access JWT from Authorization header or cookie."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip() or None
    # __Host- prefixed cookie is the primary carrier post-Phase 0.2;
    # fall back to the legacy name during rollout.
    return request.cookies.get("__Host-access_token") or request.cookies.get("access_token")


def _request_uses_cookie_auth(request: Request) -> bool:
    """Return ``True`` when the caller authenticates via cookie (not header).

    CSRF is a cookie-specific attack vector: an attacker can induce a
    browser to attach cookies to a cross-site request but cannot set an
    ``Authorization`` header (which requires JS on the target origin).
    Requests that carry an ``Authorization: Bearer ...`` header are either
    server-to-server or a tested/automated client — neither exposes the
    CSRF risk model.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        return False
    return bool(
        request.cookies.get("__Host-access_token") or request.cookies.get("access_token"),
    )


def _is_exempt(request: Request) -> bool:
    if request.method not in _PROTECTED_METHODS:
        return True
    path = request.url.path
    if path in _EXEMPT_PATHS:
        return True
    if any(path.startswith(prefix) for prefix in _EXEMPT_PREFIXES):
        return True
    # CSRF only matters for cookie-authenticated requests — a cross-site
    # attacker cannot set an Authorization header, so header-auth clients
    # (server-to-server, mobile app, test suite) are inherently safe.
    return not _request_uses_cookie_auth(request)


def _forbidden() -> JSONResponse:
    """Generic 403 — does not reveal which of cookie/header/HMAC failed."""
    return JSONResponse(
        status_code=HTTP_403_FORBIDDEN,
        content={"detail": "CSRF validation failed"},
    )


def _validate_csrf(request: Request) -> bool:
    """Return ``True`` iff the request's CSRF cookie and header check out.

    Consolidates every rejection reason into a single boolean so callers
    cannot accidentally leak *which* check failed.
    """
    cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
    header_token = request.headers.get(CSRF_HEADER_NAME)
    if not cookie_token or not header_token:
        return False
    # Step 1: cookie and header must match byte-for-byte.  Same-origin script
    # attached both values; a cross-origin attacker cannot read the cookie so
    # cannot echo it into the header.
    if not hmac.compare_digest(cookie_token, header_token):
        return False
    # Step 2: the token must be an HMAC tied to the caller's own session.
    access_token = _extract_access_token(request)
    if not access_token:
        return False
    payload = _decode_access_token_silently(access_token)
    if payload is None:
        return False
    binding = _session_binding_from_payload(payload)
    if binding is None:
        return False
    expected = compute_csrf_token(binding)
    return hmac.compare_digest(cookie_token, expected)


class CSRFMiddleware(BaseHTTPMiddleware):
    """Enforce the double-submit cookie + header pattern on mutating requests.

    Failure modes intentionally collapse into a single generic 403 so that
    probing cannot distinguish "cookie missing" from "header mismatch" —
    either way the client must re-fetch the token.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if _is_exempt(request):
            return await call_next(request)
        if not _validate_csrf(request):
            return _forbidden()
        return await call_next(request)


def set_csrf_cookie(response: Response, session_binding: str) -> None:
    """Attach the ``__Host-csrf`` cookie to *response*.

    Intended to be called by the auth flow right after a new access token is
    issued — ties the CSRF cookie to the same session binding (``jti``) that
    ``CSRFMiddleware`` will verify against on subsequent requests.

    The ``__Host-`` prefix mandates:
    * ``Secure``
    * ``Path=/``
    * *no* ``Domain`` attribute
    Browsers reject the cookie outright if any of these are violated.
    """
    # Non-HttpOnly on purpose: the SPA reads the cookie and echoes it into
    # the X-CSRF-Token header on each mutating call.
    samesite: Literal["none"] = "none"
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=compute_csrf_token(session_binding),
        httponly=False,
        secure=True,
        samesite=samesite,
        path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def clear_csrf_cookie(response: Response) -> None:
    """Remove the CSRF cookie (on logout)."""
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")
