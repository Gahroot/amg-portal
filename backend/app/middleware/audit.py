"""HTTP middleware that populates audit context from the request."""

import contextlib
import uuid
from contextvars import Token

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.audit_context import AuditContext, audit_context_var
from app.core.security import decode_access_token


class AuditContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
        ctx = AuditContext()

        # Extract user info from JWT (no DB hit)
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_access_token(token)
            if payload:
                sub = payload.get("sub")
                if sub:
                    with contextlib.suppress(ValueError):
                        ctx.user_id = uuid.UUID(sub)
                ctx.user_email = payload.get("email")

        # IP address
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            ctx.ip_address = forwarded.split(",")[0].strip()
        elif request.client:
            ctx.ip_address = request.client.host

        # User-Agent
        ctx.user_agent = request.headers.get("user-agent", "")[:500]

        ctx_token: Token[AuditContext | None] = audit_context_var.set(ctx)
        try:
            response = await call_next(request)
        finally:
            audit_context_var.reset(ctx_token)

        return response  # type: ignore[no-any-return]
