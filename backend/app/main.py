import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
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
    validation_exception_handler,
)
from app.middleware.audit import AuditContextMiddleware
from app.middleware.security import SecurityHeadersMiddleware

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
    ],
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuditContextMiddleware)


app.include_router(v1_router, prefix=settings.API_V1_PREFIX)
app.include_router(websocket_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
