from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from content_size_limit_asgi import ContentSizeLimitMiddleware
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as v1_router
from app.api.websocket import ws_router as websocket_router
from app.core import audit_listener as _audit_listener  # noqa: F401
from app.core.config import settings
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.http_client import shutdown_http_clients, startup_http_clients
from app.core.logging import configure_logging
from app.middleware.audit import AuditContextMiddleware
from app.middleware.cloudflare_origin import CloudflareOriginAuthMiddleware
from app.middleware.csrf import CSRFMiddleware
from app.middleware.logging_context import LoggingContextMiddleware
from app.middleware.security import SecurityHeadersMiddleware

configure_logging()

import logging  # noqa: E402  — must run after configure_logging() to honour root config

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage application startup and shutdown."""
    from app.db.session import AsyncSessionLocal
    from app.services.program_template_seeder import seed_program_templates
    from app.services.scheduler_service import (
        start_scheduler,
        stop_scheduler,
    )
    from app.services.template_seeder import (
        seed_default_templates,
    )

    # Pooled httpx clients — opened once per process, shared across handlers
    # and APScheduler jobs.  Closed in the teardown branch.
    await startup_http_clients()

    # Seed system templates before starting scheduler
    try:
        async with AsyncSessionLocal() as db:
            await seed_default_templates(db)
    except Exception:
        logger.warning(
            "Failed to seed templates — DB may be unavailable or migrations pending",
            exc_info=True,
        )

    try:
        async with AsyncSessionLocal() as db:
            await seed_program_templates(db)
    except Exception:
        logger.warning(
            "Failed to seed program templates — DB may be unavailable or migrations pending",
            exc_info=True,
        )

    try:
        from app.services.meeting_scheduler_service import seed_meeting_types

        async with AsyncSessionLocal() as db:
            await seed_meeting_types(db)
    except Exception:
        logger.warning(
            "Failed to seed meeting types — DB may be unavailable or migrations pending",
            exc_info=True,
        )

    scheduler = start_scheduler()
    try:
        yield
    finally:
        stop_scheduler(scheduler)
        await shutdown_http_clients()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Register exception handlers for consistent, secure error responses
app.add_exception_handler(AppException, app_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(HTTPException, http_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(Exception, generic_exception_handler)

# CORS - Use explicit methods instead of wildcard for better security
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-CSRF-Token",
        "X-Request-ID",
    ],
)

# Reject oversize bodies before they are buffered into memory.  Default 10 MB;
# upload routes that need more (e.g. document vault) set their own limits
# closer to the handler.
app.add_middleware(ContentSizeLimitMiddleware, max_content_size=10 * 1024 * 1024)

app.add_middleware(SecurityHeadersMiddleware)
# CSRF is mounted *after* SecurityHeadersMiddleware so that its 403 responses
# still pick up the HSTS / CSP / Permissions-Policy headers on the way out.
# (Starlette runs middleware in reverse registration order, so the later
# `add_middleware` call becomes the *inner* wrapper.)
app.add_middleware(CSRFMiddleware)
app.add_middleware(AuditContextMiddleware)
# Cloudflare AOP compensating control — no-op unless CF_ORIGIN_AUTH_HEADER
# and CF_ORIGIN_AUTH_TOKEN are both set.  Mounted just inside the logging
# layer so rejections still get a structured ``request.completed`` line.
app.add_middleware(CloudflareOriginAuthMiddleware)
# LoggingContextMiddleware is the outermost wrapper so it sees the unmodified
# request first and the final response last (correct latency + status capture).
app.add_middleware(LoggingContextMiddleware)


app.include_router(v1_router, prefix=settings.API_V1_PREFIX)
app.include_router(websocket_router)


@app.get("/health")
async def health_check() -> dict[str, Any]:
    from app.middleware.cloudflare_origin import is_enforcement_enabled

    return {
        "status": "healthy",
        # Surfaces whether the Cloudflare-AOP compensating control is active.
        # Production alerting should page on this flipping to ``false``.
        "cloudflare_origin_auth": "enforced" if is_enforcement_enabled() else "disabled",
    }
