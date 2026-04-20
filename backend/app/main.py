import logging
import logging.handlers
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

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
from app.middleware.audit import AuditContextMiddleware
from app.middleware.csrf import CSRFMiddleware
from app.middleware.security import SecurityHeadersMiddleware


def _configure_logging() -> None:
    """Configure structured logging for the application.

    - Always logs to stdout (captured by process manager / Docker).
    - Optionally writes a rotating file log when LOG_FILE env var is set
      (e.g. LOG_FILE=backend/app.log).  File rotates at 10 MB, keeps 5 backups.
    - Log level is controlled by LOG_LEVEL env var (default: INFO).
    """
    log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    datefmt = "%Y-%m-%dT%H:%M:%S"

    handlers: list[logging.Handler] = [logging.StreamHandler()]

    log_file = os.environ.get("LOG_FILE", "")
    if log_file:
        os.makedirs(os.path.dirname(log_file) if os.path.dirname(log_file) else ".", exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding="utf-8",
        )
        handlers.append(file_handler)

    logging.basicConfig(level=log_level, format=fmt, datefmt=datefmt, handlers=handlers, force=True)

    # Quieten noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)


_configure_logging()

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
    yield
    stop_scheduler(scheduler)


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


app.include_router(v1_router, prefix=settings.API_V1_PREFIX)
app.include_router(websocket_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
