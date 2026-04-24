"""Compensating control for Cloudflare Authenticated Origin Pulls (AOP).

Railway does NOT expose a custom-CA upload (verified against
docs.railway.com/guides/public-networking, April 2026), so true mTLS-based
AOP is not available.  The standard pattern in that situation — used by
Vercel, Fly, Render and Railway itself in community guidance — is a shared
secret header injected by a Cloudflare Transform Rule.

Configuration:
- Set ``CF_ORIGIN_AUTH_HEADER`` (e.g. ``X-CF-Origin-Auth``) and
  ``CF_ORIGIN_AUTH_TOKEN`` (a random 32-byte secret) on the backend
  Railway service.
- In the Cloudflare dashboard create a Transform Rule for the proxied
  hostname:  ``Set static`` → header name = ``CF_ORIGIN_AUTH_HEADER`` →
  value = the same secret.

When both env vars are set this middleware rejects any request that does
not carry the expected header.  When unset, the middleware is a no-op so
local dev / CI continue to work.

Token comparison uses ``hmac.compare_digest`` to avoid leaking the secret
through reply-time differences.
"""

from __future__ import annotations

import hmac
import logging
import os
from typing import Final

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings

logger = logging.getLogger(__name__)

# Health probe + browser-emitted security reports must continue to work even
# when AOP is enforced (Cloudflare strips the Transform Rule on edge-internal
# health checks; browsers obviously can't add it to CSP reports).
_BYPASS_PATHS: Final[frozenset[str]] = frozenset(
    {
        "/health",
        "/api/v1/security/csp-report",
        "/api/v1/security/reports",
    }
)

# Module-level snapshot of enforcement state so ``/health`` can report it
# without holding a reference to the middleware instance.  Set on construction.
_enforcement_enabled: bool = False


def is_enforcement_enabled() -> bool:
    """Return ``True`` when the middleware is actively enforcing origin auth."""
    return _enforcement_enabled


class CloudflareOriginAuthMiddleware(BaseHTTPMiddleware):
    """Reject requests that didn't transit Cloudflare's edge.

    Active only when ``CF_ORIGIN_AUTH_HEADER`` and ``CF_ORIGIN_AUTH_TOKEN``
    are both set in the environment.  In production (``DEBUG=False``) a
    missing pair is logged at ERROR so ops alerts fire on regression — the
    middleware still installs as a no-op rather than blocking boot, since
    the backend remains behind Cloudflare WAF regardless.
    """

    def __init__(self, app: object) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._header = os.environ.get("CF_ORIGIN_AUTH_HEADER", "").strip()
        self._token = os.environ.get("CF_ORIGIN_AUTH_TOKEN", "").strip()
        self._enabled = bool(self._header and self._token)
        global _enforcement_enabled  # noqa: PLW0603
        _enforcement_enabled = self._enabled
        if self._enabled:
            logger.info("cloudflare_origin: enforcement enabled via %s header", self._header)
        elif not settings.DEBUG:
            # Production boot with AOP disabled — ops should be alerted via the
            # ``cloudflare_origin.disabled_in_production`` event and via the
            # ``/health`` endpoint's ``cloudflare_origin_auth`` dimension.
            logger.error(
                "cloudflare_origin: ENFORCEMENT DISABLED in production "
                "(CF_ORIGIN_AUTH_HEADER and/or CF_ORIGIN_AUTH_TOKEN unset) — "
                "backend is reachable directly without Cloudflare edge auth",
                extra={"event": "cloudflare_origin.disabled_in_production"},
            )

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        if not self._enabled or request.url.path in _BYPASS_PATHS:
            return await call_next(request)
        provided = request.headers.get(self._header, "")
        if not provided or not hmac.compare_digest(provided, self._token):
            logger.warning(
                "cloudflare_origin: rejected non-edge request",
                extra={
                    "event": "cloudflare_origin.rejected",
                    "path": request.url.path,
                    "method": request.method,
                },
            )
            return JSONResponse(
                {"detail": "Not Found"},
                status_code=404,
            )
        return await call_next(request)
