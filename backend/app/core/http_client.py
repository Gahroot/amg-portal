"""Shared ``httpx.AsyncClient`` factories with global timeout + SSRF guard.

Phase 3.11: every outbound HTTP call funnels through one of two pooled
clients so that timeout, redirect-following and connection-pool sizing can
be reasoned about centrally.  ``safe_request`` additionally validates a
user-supplied URL against ``app.utils.url_safety`` before dispatch.

References (real-world patterns):
- ``agno-agi/agno`` ``libs/agno/agno/utils/http.py`` — singleton async
  client with ``Limits`` + ``Timeout`` + lifecycle close.
- ``vllm-project/aibrix`` ``apps/chat/api/services/providers/openai.py`` —
  per-component ``Limits``/``Timeout`` configs and explicit lifecycle hooks.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Final
from urllib.parse import urlparse

import httpx

from app.utils.url_safety import resolve_is_safe_host, validate_safe_webhook_url

logger = logging.getLogger(__name__)

_USER_AGENT: Final[str] = "AMG-Portal/1.0 (+security)"

# Tighter on connect than on read so we fail fast against unreachable peers
# while still tolerating slow but legitimate API responses.
_INTERNAL_TIMEOUT: Final[httpx.Timeout] = httpx.Timeout(30.0, connect=5.0)
_EXTERNAL_TIMEOUT: Final[httpx.Timeout] = httpx.Timeout(10.0, connect=5.0)

_INTERNAL_LIMITS: Final[httpx.Limits] = httpx.Limits(
    max_connections=100,
    max_keepalive_connections=20,
)
_EXTERNAL_LIMITS: Final[httpx.Limits] = httpx.Limits(
    max_connections=50,
    max_keepalive_connections=10,
)

_internal_client: httpx.AsyncClient | None = None
_external_client: httpx.AsyncClient | None = None


class UnsafeURLError(ValueError):
    """Raised when ``safe_request`` rejects a URL via the SSRF guard."""


def _make_client(
    *,
    timeout: httpx.Timeout,
    limits: httpx.Limits,
    follow_redirects: bool,
) -> httpx.AsyncClient:
    # HTTP/1.1 only — opting into ``http2=True`` requires the ``h2`` extra
    # which is not currently in the dependency set; revisit if connection
    # setup overhead becomes a real cost.
    return httpx.AsyncClient(
        timeout=timeout,
        limits=limits,
        follow_redirects=follow_redirects,
        headers={"User-Agent": _USER_AGENT},
    )


async def startup_http_clients() -> None:
    """Create the singleton clients.  Call from FastAPI lifespan startup."""
    global _internal_client, _external_client  # noqa: PLW0603
    if _internal_client is None:
        _internal_client = _make_client(
            timeout=_INTERNAL_TIMEOUT,
            limits=_INTERNAL_LIMITS,
            follow_redirects=True,
        )
    if _external_client is None:
        _external_client = _make_client(
            timeout=_EXTERNAL_TIMEOUT,
            limits=_EXTERNAL_LIMITS,
            follow_redirects=False,
        )


async def shutdown_http_clients() -> None:
    """Close the singletons.  Call from FastAPI lifespan teardown."""
    global _internal_client, _external_client  # noqa: PLW0603
    for client in (_internal_client, _external_client):
        if client is not None:
            try:
                await client.aclose()
            except Exception:  # noqa: BLE001
                logger.warning("http_client: aclose failed", exc_info=True)
    _internal_client = None
    _external_client = None


def get_internal_client() -> httpx.AsyncClient:
    """Trusted-endpoint client (Google APIs, HIBP, Expo push, ...)."""
    if _internal_client is None:
        # Lazy create — covers test contexts that don't run the lifespan.
        return _make_client(
            timeout=_INTERNAL_TIMEOUT,
            limits=_INTERNAL_LIMITS,
            follow_redirects=True,
        )
    return _internal_client


def get_external_client() -> httpx.AsyncClient:
    """User-controlled / third-party client.  ``follow_redirects=False``."""
    if _external_client is None:
        return _make_client(
            timeout=_EXTERNAL_TIMEOUT,
            limits=_EXTERNAL_LIMITS,
            follow_redirects=False,
        )
    return _external_client


async def safe_request(
    method: str,
    url: str,
    *,
    client: httpx.AsyncClient | None = None,
    **kwargs: Any,
) -> httpx.Response:
    """Issue a request to ``url`` after running the SSRF allow-list checks.

    The validation runs in two passes so we defend against DNS rebinding:

    1. ``validate_safe_webhook_url`` rejects loopback, private, link-local,
       metadata-host names and IP literals at submit/parse time.
    2. ``resolve_is_safe_host`` re-resolves the hostname immediately before
       the request so a name flipped to a private address between submit
       and dispatch still gets blocked.
    """
    try:
        validate_safe_webhook_url(url)
    except ValueError as exc:
        raise UnsafeURLError(str(exc)) from exc

    host = (urlparse(url).hostname or "").strip()
    if not await asyncio.to_thread(resolve_is_safe_host, host):
        raise UnsafeURLError(f"Host {host!r} resolves to a disallowed range")

    target = client if client is not None else get_external_client()
    return await target.request(method, url, **kwargs)


__all__ = [
    "UnsafeURLError",
    "get_external_client",
    "get_internal_client",
    "safe_request",
    "shutdown_http_clients",
    "startup_http_clients",
]
