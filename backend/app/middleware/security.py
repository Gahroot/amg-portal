"""HTTP middleware that adds security headers to every response."""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response: Response = await call_next(request)

        # Basic security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # HSTS (HTTP Strict Transport Security) - only add in production with HTTPS
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Content Security Policy — API-only.
        # The backend serves JSON to an SPA; browsers never render backend
        # responses as HTML documents, so the only CSP that meaningfully
        # protects the user is the one emitted by the Next.js frontend
        # (``frontend/src/middleware.ts``).  We still send a minimal CSP
        # here as defence-in-depth: it denies all resource loads and
        # forbids framing, so an attacker who somehow coerces the browser
        # to treat an API response as a document still gets nothing.
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"

        return response
