"""HTTP middleware that populates audit context from the request."""

import contextlib
import functools
import uuid
from collections.abc import Awaitable, Callable, Iterator
from contextvars import Token

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.audit_context import AuditContext, audit_context_var
from app.core.ip_utils import get_client_ip
from app.core.security import decode_access_token


@contextlib.contextmanager
def audit_context(
    *,
    user_id: uuid.UUID | None = None,
    user_email: str | None = "system",
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> Iterator[AuditContext]:
    """Populate ``audit_context_var`` outside an HTTP request.

    Background jobs (APScheduler, CLI scripts) run without an HTTP request, so
    the audit middleware never fires and the SQLAlchemy ``after_flush``
    listener sees an empty context. Wrapping DB-mutating job bodies in this
    context manager ensures system-sourced audit entries are still written.
    """
    ctx = AuditContext(
        user_id=user_id,
        user_email=user_email,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    token: Token[AuditContext | None] = audit_context_var.set(ctx)
    try:
        yield ctx
    finally:
        audit_context_var.reset(token)


def with_system_audit_context[**P, R](
    func: Callable[P, Awaitable[R]],
) -> Callable[P, Awaitable[R]]:
    """Decorator: run an async job inside a ``system``-sourced audit context.

    APScheduler jobs have no HTTP request, so ``audit_context_var`` is empty
    and the SQLAlchemy listener writes no audit entries. Wrapping a job with
    this decorator ensures DB mutations it performs are attributed to the
    scheduler as a system actor.
    """

    @functools.wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        with audit_context():
            return await func(*args, **kwargs)

    return wrapper


class AuditContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
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

        # IP address — only trust X-Forwarded-For from known proxy addresses
        ctx.ip_address = get_client_ip(request)

        # User-Agent
        ctx.user_agent = request.headers.get("user-agent", "")[:500]

        ctx_token: Token[AuditContext | None] = audit_context_var.set(ctx)
        try:
            response = await call_next(request)
        finally:
            audit_context_var.reset(ctx_token)

        return response
