"""Tests for ``app.core.http_client`` (Phase 3.11).

Covers SSRF rejection paths in ``safe_request`` and verifies the external
client does not follow redirects.
"""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import httpx
import pytest

from app.core import http_client as hc


@pytest.fixture(autouse=True)
def _isolate_clients() -> Iterator[None]:
    """Ensure no leftover singleton from another test affects this one."""
    hc._internal_client = None  # type: ignore[attr-defined]
    hc._external_client = None  # type: ignore[attr-defined]
    yield
    hc._internal_client = None  # type: ignore[attr-defined]
    hc._external_client = None  # type: ignore[attr-defined]


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/foo",
        "http://10.0.0.5/bar",
        "http://[::1]/baz",
        "http://169.254.169.254/latest/meta-data/",
        "http://localhost/health",
        "http://metadata.google.internal/",
    ],
)
async def test_safe_request_rejects_loopback_and_private(url: str) -> None:
    with pytest.raises(hc.UnsafeURLError):
        await hc.safe_request("GET", url)


async def test_safe_request_rejects_dns_resolving_to_private() -> None:
    """A hostname that resolves only to RFC1918 must be rejected."""
    # Patch ``resolve_is_safe_host`` to simulate the DNS rebinding case where
    # ``validate_safe_webhook_url`` lets the literal string through (because
    # it isn't an IP) but resolution returns a private address.
    with (
        patch("app.core.http_client.resolve_is_safe_host", return_value=False),
        pytest.raises(hc.UnsafeURLError),
    ):
        await hc.safe_request("GET", "https://internal-thing.example.com/")


async def test_safe_request_rejects_non_http_scheme() -> None:
    with pytest.raises(hc.UnsafeURLError):
        await hc.safe_request("GET", "ftp://example.com/")


async def test_external_client_does_not_follow_redirects() -> None:
    """A 302 from the upstream must be returned as-is (not transparently followed)."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/start":
            return httpx.Response(302, headers={"Location": "https://example.com/end"})
        return httpx.Response(200, text="reached redirect target")

    transport = httpx.MockTransport(handler)
    # Match the production config: follow_redirects=False, short timeout.
    client = httpx.AsyncClient(
        transport=transport,
        follow_redirects=False,
        timeout=hc._EXTERNAL_TIMEOUT,
        limits=hc._EXTERNAL_LIMITS,
    )
    try:
        resp = await client.get("https://example.com/start")
        assert resp.status_code == 302
        assert resp.headers["Location"].endswith("/end")
    finally:
        await client.aclose()


async def test_get_external_client_has_correct_defaults() -> None:
    client = hc.get_external_client()
    try:
        assert client.follow_redirects is False
        assert client.timeout == hc._EXTERNAL_TIMEOUT
        assert client.headers.get("User-Agent", "").startswith("AMG-Portal/")
    finally:
        await client.aclose()


async def test_get_internal_client_follows_redirects() -> None:
    client = hc.get_internal_client()
    try:
        assert client.follow_redirects is True
        assert client.timeout == hc._INTERNAL_TIMEOUT
    finally:
        await client.aclose()


async def test_lifecycle_roundtrip() -> None:
    """startup creates singletons; shutdown closes and clears them."""
    await hc.startup_http_clients()
    assert hc._internal_client is not None  # type: ignore[attr-defined]
    assert hc._external_client is not None  # type: ignore[attr-defined]
    await hc.shutdown_http_clients()
    assert hc._internal_client is None  # type: ignore[attr-defined]
    assert hc._external_client is None  # type: ignore[attr-defined]
