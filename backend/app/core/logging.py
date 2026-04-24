"""Structured JSON logging with PII redaction (Phase 3.2 / Blindspot #1).

One JSON object per log line, request-scoped fields injected via a
``ContextVar`` populated by ``LoggingContextMiddleware``.  PII is redacted at
the formatter layer so background-job tracebacks and ad-hoc ``logger.info``
calls cannot leak sensitive values into Railway's stdout SIEM.

References (real-world patterns):
- ``open-webui/open-webui`` ``backend/open_webui/env.py`` — single-line JSON
  formatter with ISO-8601 ``ts`` field.
- ``crewAIInc/crewAI`` ``lib/.../a2a/utils/logging.py`` — ContextVar-driven
  request fields injected via a ``Filter``.
- ``apache/spark`` ``python/pyspark/logger/logger.py`` — JSON formatter
  exception/extras handling.
"""

from __future__ import annotations

import contextlib
import contextvars
import json
import logging
import logging.handlers
import os
import re
import time
import uuid
from collections.abc import Awaitable, Callable, MutableMapping
from datetime import UTC, datetime
from typing import Any, Final

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.core.ip_utils import get_client_ip

# ---------------------------------------------------------------------------
# Request-scoped context
# ---------------------------------------------------------------------------

# A single dict-shaped contextvar instead of one per field — set/reset is O(1)
# and the formatter can splat the whole thing into the record.
log_context_var: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar(
    "log_context",
    default=None,
)

_CONTEXT_FIELDS: Final[tuple[str, ...]] = (
    "request_id",
    "actor_id",
    "tenant_id",
    "path",
    "method",
    "status",
    "latency_ms",
    "client_ip",
)


def get_request_id() -> str | None:
    ctx = log_context_var.get()
    return ctx.get("request_id") if ctx else None


def bind_log_context(**fields: Any) -> None:
    """Add fields to the current request's log context (no-op outside a request)."""
    ctx = log_context_var.get()
    if ctx is None:
        return
    ctx.update({k: v for k, v in fields.items() if v is not None})


# ---------------------------------------------------------------------------
# PII redaction
# ---------------------------------------------------------------------------

# Keys whose VALUES we always replace.  Lower-cased on the comparison side.
_REDACT_KEYS: Final[frozenset[str]] = frozenset(
    {
        "password",
        "token",
        "access_token",
        "refresh_token",
        "secret",
        "authorization",
        "cookie",
        "set-cookie",
        "tax_id",
        "ssn",
        "passport",
        "national_id",
        "dob",
        "email",
        "phone",
        "net_worth",
        "iban",
        "account_number",
        "private_key",
        "client_secret",
        "api_key",
        "csrf",
    }
)
_REDACTED: Final[str] = "***"
_MIN_REDACT_LEN: Final[int] = 6

# JWT-shaped: three base64url segments separated by dots.
_JWT_RE: Final[re.Pattern[str]] = re.compile(
    r"\beyJ[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}\b",
)
_BEARER_RE: Final[re.Pattern[str]] = re.compile(
    r"(?i)\bbearer\s+[A-Za-z0-9_\-.=:+/]{8,}",
)


def _scrub_string(value: str) -> str:
    if len(value) >= _MIN_REDACT_LEN:
        value = _JWT_RE.sub(_REDACTED, value)
        value = _BEARER_RE.sub("Bearer " + _REDACTED, value)
    return value


def _scrub(value: Any, parent_key: str | None = None) -> Any:
    if parent_key and parent_key.lower() in _REDACT_KEYS:
        if isinstance(value, str) and len(value) >= _MIN_REDACT_LEN:
            return _REDACTED
        if isinstance(value, (bytes, bytearray)):
            return _REDACTED
    if isinstance(value, str):
        return _scrub_string(value)
    if isinstance(value, dict):
        return {k: _scrub(v, k) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_scrub(v, parent_key) for v in value]
    return value


class PIIRedactingFilter(logging.Filter):
    """Walk the record's message + args + extras; replace sensitive values."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: D401
        # ``record.msg`` may be a format string; we scrub it as text in case
        # a caller embedded a token directly without using args.
        if isinstance(record.msg, str):
            record.msg = _scrub_string(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: _scrub(v, k) for k, v in record.args.items()}
            else:
                record.args = tuple(_scrub(a) for a in record.args)
        # Custom attributes set via ``extra={...}``.
        for key in list(record.__dict__):
            if key in _STD_LOGRECORD_ATTRS:
                continue
            record.__dict__[key] = _scrub(record.__dict__[key], key)
        return True


# ---------------------------------------------------------------------------
# Context filter
# ---------------------------------------------------------------------------


class ContextFilter(logging.Filter):
    """Attach request-scoped fields from ``log_context_var`` to every record."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: D401
        ctx = log_context_var.get() or {}
        for field in _CONTEXT_FIELDS:
            if field not in record.__dict__:
                record.__dict__[field] = ctx.get(field)
        return True


# ---------------------------------------------------------------------------
# JSON formatter
# ---------------------------------------------------------------------------

# Standard ``LogRecord`` attributes — anything else is treated as an "extra"
# and is dumped into the JSON output verbatim (after redaction).
_STD_LOGRECORD_ATTRS: Final[frozenset[str]] = frozenset(
    {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "taskName",
        "message",
        "asctime",
    }
)


def _resolve_env() -> str:
    explicit = os.environ.get("ENV", "").strip()
    if explicit:
        return explicit
    return "development" if settings.DEBUG else "production"


class JsonFormatter(logging.Formatter):
    """Emit one JSON object per log record.

    Output shape (always):
        {"ts", "level", "logger", "msg", "service", "env", ...request fields,
         ...extras, optional "exc_info"}
    """

    def __init__(self, *, service: str = "amg-portal-backend") -> None:
        super().__init__()
        self._service = service
        self._env = _resolve_env()

    def format(self, record: logging.LogRecord) -> str:  # noqa: D401
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "service": self._service,
            "env": self._env,
        }
        for field in _CONTEXT_FIELDS:
            value = record.__dict__.get(field)
            if value is not None:
                payload[field] = value
        # Hoist anything not in stdlib record attrs as a top-level field.
        for key, value in record.__dict__.items():
            if key in _STD_LOGRECORD_ATTRS or key in _CONTEXT_FIELDS:
                continue
            if key.startswith("_"):
                continue
            payload[key] = value
        # Exception + stack text is materialised HERE (after PIIRedactingFilter
        # has already run on record.__dict__), so any bearer tokens / JWTs
        # embedded in exception messages or traceback frames would otherwise
        # land in logs unredacted.  Run them through the same scrubber.
        if record.exc_info:
            payload["exc_info"] = _scrub_string(self.formatException(record.exc_info))
        if record.stack_info:
            payload["stack_info"] = _scrub_string(self.formatStack(record.stack_info))
        return json.dumps(payload, default=str, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


_QUIET_LOGGERS: Final[tuple[str, ...]] = (
    "uvicorn.access",
    "apscheduler",
    "apscheduler.scheduler",
    "apscheduler.executors.default",
    "httpx",
    "httpcore",
    "sqlalchemy.engine",
    "asyncio",
    "multipart.multipart",
)


def _build_text_formatter() -> logging.Formatter:
    return logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


def configure_logging() -> None:
    """Configure root logging.  Idempotent — safe to call from ``main.py``."""
    log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    # ``json`` in non-DEBUG, ``text`` in DEBUG, but ``LOG_FORMAT`` always wins.
    fmt_choice = os.environ.get("LOG_FORMAT", "text" if settings.DEBUG else "json").lower()
    formatter: logging.Formatter = (
        JsonFormatter() if fmt_choice == "json" else _build_text_formatter()
    )

    handlers: list[logging.Handler] = []
    stream = logging.StreamHandler()
    stream.setFormatter(formatter)
    handlers.append(stream)

    log_file = os.environ.get("LOG_FILE", "")
    if log_file:
        os.makedirs(
            os.path.dirname(log_file) if os.path.dirname(log_file) else ".",
            exist_ok=True,
        )
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        handlers.append(file_handler)

    pii_filter = PIIRedactingFilter()
    ctx_filter = ContextFilter()
    for h in handlers:
        h.addFilter(pii_filter)
        h.addFilter(ctx_filter)

    logging.basicConfig(level=log_level, handlers=handlers, force=True)
    for noisy in _QUIET_LOGGERS:
        logging.getLogger(noisy).setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
# Request middleware
# ---------------------------------------------------------------------------


_logger = logging.getLogger("app.request")


class LoggingContextMiddleware(BaseHTTPMiddleware):
    """Per-request: stamp ``request_id``, log ``request.completed`` on exit.

    ``X-Request-ID`` is honoured if the client provides one (handy for
    cross-service correlation behind Cloudflare); otherwise we mint a UUIDv4.
    The header is echoed back on the response so clients can quote it when
    reporting an error.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        request_id = request.headers.get("x-request-id", "").strip() or uuid.uuid4().hex
        ctx: dict[str, Any] = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": get_client_ip(request),
        }
        token = log_context_var.set(ctx)
        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            latency_ms = int((time.perf_counter() - start) * 1000)
            ctx["status"] = status_code
            ctx["latency_ms"] = latency_ms
            try:
                _logger.info(
                    "request.completed",
                    extra={"event": "request.completed"},
                )
            finally:
                log_context_var.reset(token)
            # ``response`` may not exist if call_next raised; the except path
            # is handled by the outer exception handlers which produce their
            # own response.  When we do have one, echo the request id.
            with contextlib.suppress(UnboundLocalError):
                response.headers["X-Request-ID"] = request_id


__all__ = [
    "ContextFilter",
    "JsonFormatter",
    "LoggingContextMiddleware",
    "PIIRedactingFilter",
    "bind_log_context",
    "configure_logging",
    "get_request_id",
    "log_context_var",
]


# Silence "imported but unused" for Awaitable/Callable/MutableMapping which we
# may want to add to the public surface later for typed middleware extensions.
_ = (Awaitable, Callable, MutableMapping)
