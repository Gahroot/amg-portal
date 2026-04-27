"""Tests for per-role, cost-weighted rate limiting in ``app.core.rate_limit``.

Covers both the Redis-backed sliding window and the in-process fallback path.
The Redis tests require Redis to be reachable at ``settings.REDIS_URL``; when
Redis is down, the fallback-path tests still run because they monkeypatch the
pipeline to raise.
"""

from __future__ import annotations

import contextlib
import uuid
from typing import Any, cast

import pytest
from fastapi import HTTPException
from redis.exceptions import RedisError
from starlette.requests import Request

from app.core import rate_limit
from app.core.rate_limit import RateLimiter, _fallback_cache
from app.core.security import create_access_token
from app.db.redis import redis_client

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_request(
    *,
    ip: str = "203.0.113.10",
    token: str | None = None,
) -> Request:
    """Build a minimal Starlette Request for dependency testing."""
    headers: list[tuple[bytes, bytes]] = []
    if token is not None:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    scope: dict[str, Any] = {
        "type": "http",
        "method": "POST",
        "path": "/",
        "headers": headers,
        "query_string": b"",
        "client": (ip, 49152),
        "server": ("testserver", 80),
        "scheme": "http",
        "root_path": "",
    }
    return Request(scope)


def _authed_token(role: str = "relationship_manager") -> str:
    return create_access_token({"sub": str(uuid.uuid4()), "role": role})


async def _flush_redis() -> None:
    """Wipe any rate_limit:* keys so tests start with an empty bucket.

    Reconnects on every call — asyncio Redis pools bind connections to the
    creating event loop, and pytest-asyncio creates a fresh loop per test.
    """
    try:
        import redis.asyncio as _redis

        from app.core.config import settings as _settings

        client = _redis.from_url(_settings.REDIS_URL, decode_responses=True)
        try:
            cursor = 0
            while True:
                cursor, keys = await client.scan(cursor, match="rate_limit:*", count=200)
                if keys:
                    await client.delete(*keys)
                if cursor == 0:
                    break
        finally:
            await client.aclose()
    except RedisError:
        pass
    except Exception:  # noqa: BLE001 — connection errors on fallback paths are fine
        pass


@pytest.fixture(autouse=True)
async def _reset_state() -> Any:
    _fallback_cache.clear()
    # Reset the shared async client's connection pool so tests don't inherit
    # connections attached to a prior test's event loop.
    with contextlib.suppress(Exception):
        await redis_client.aclose()
    await _flush_redis()
    yield
    _fallback_cache.clear()
    await _flush_redis()
    with contextlib.suppress(Exception):
        await redis_client.aclose()


# ---------------------------------------------------------------------------
# Legacy signature — RateLimiter("x", 5) still works
# ---------------------------------------------------------------------------


async def test_legacy_flat_signature_still_works() -> None:
    limiter = RateLimiter("legacy_flat", 2)
    req1 = _make_request(ip="198.51.100.1")

    await limiter(req1)  # 1/2
    await limiter(req1)  # 2/2
    with pytest.raises(HTTPException) as excinfo:
        await limiter(req1)
    assert excinfo.value.status_code == 429
    headers = cast(dict[str, str], excinfo.value.headers)
    assert "Retry-After" in headers


async def test_legacy_signature_uses_same_limit_across_tiers() -> None:
    limiter = RateLimiter("legacy_same_all", 1)
    # Each tier keyed separately, so each gets 1 request before 429.
    anon_req = _make_request(ip="198.51.100.2")
    authed_req = _make_request(ip="198.51.100.2", token=_authed_token())

    await limiter(anon_req)  # anon bucket OK (1/1)
    with pytest.raises(HTTPException):
        await limiter(anon_req)

    await limiter(authed_req)  # authed bucket OK (1/1)
    with pytest.raises(HTTPException):
        await limiter(authed_req)


# ---------------------------------------------------------------------------
# Tiered limits — anon / authed / admin
# ---------------------------------------------------------------------------


async def test_anon_hits_anon_limit_and_gets_429() -> None:
    limiter = RateLimiter("tier_anon", anon=2, authed=10, admin=50)
    req = _make_request(ip="198.51.100.3")

    await limiter(req)
    await limiter(req)
    with pytest.raises(HTTPException) as excinfo:
        await limiter(req)
    assert excinfo.value.status_code == 429
    headers = cast(dict[str, str], excinfo.value.headers)
    assert "Retry-After" in headers


async def test_authed_user_gets_higher_limit_than_anon() -> None:
    limiter = RateLimiter("tier_authed", anon=1, authed=5, admin=50)
    req = _make_request(ip="198.51.100.4", token=_authed_token("coordinator"))

    # Authed tier allows 5, so three back-to-back calls all succeed.
    for _ in range(5):
        await limiter(req)
    with pytest.raises(HTTPException):
        await limiter(req)


async def test_admin_token_gets_admin_tier_limit() -> None:
    limiter = RateLimiter("tier_admin", anon=1, authed=2, admin=6)
    req = _make_request(ip="198.51.100.5", token=_authed_token("managing_director"))

    for _ in range(6):
        await limiter(req)
    with pytest.raises(HTTPException):
        await limiter(req)


async def test_zero_anon_limit_denies_unauthenticated() -> None:
    limiter = RateLimiter("tier_authed_only", anon=0, authed=5, admin=20)
    req = _make_request(ip="198.51.100.6")
    with pytest.raises(HTTPException) as excinfo:
        await limiter(req)
    assert excinfo.value.status_code == 429


async def test_anon_and_authed_use_separate_buckets() -> None:
    """Burning the anon bucket must not affect the authed bucket for the same IP."""
    limiter = RateLimiter("tier_split", anon=1, authed=3, admin=10)
    anon_req = _make_request(ip="198.51.100.7")
    authed_req = _make_request(ip="198.51.100.7", token=_authed_token())

    await limiter(anon_req)
    with pytest.raises(HTTPException):
        await limiter(anon_req)  # anon exhausted
    # Same IP, but authed bucket is still fresh.
    for _ in range(3):
        await limiter(authed_req)
    with pytest.raises(HTTPException):
        await limiter(authed_req)


# ---------------------------------------------------------------------------
# Cost weighting
# ---------------------------------------------------------------------------


async def test_cost_weight_fills_bucket_faster() -> None:
    cheap = RateLimiter("cost_cheap", anon=10, authed=10, admin=10, cost=1)
    expensive = RateLimiter("cost_expensive", anon=10, authed=10, admin=10, cost=5)
    req = _make_request(ip="198.51.100.8")

    # cost=1 → 10 calls fit.
    for _ in range(10):
        await cheap(req)
    with pytest.raises(HTTPException):
        await cheap(req)

    # cost=5 → only 2 calls fit (5 + 5 = 10).  Third call would be 15 > 10.
    await expensive(req)
    await expensive(req)
    with pytest.raises(HTTPException):
        await expensive(req)


async def test_cost_must_be_positive() -> None:
    with pytest.raises(ValueError):
        RateLimiter("bad_cost", anon=5, authed=5, cost=0)


# ---------------------------------------------------------------------------
# Redis-down → in-process fallback still enforces tiers
# ---------------------------------------------------------------------------


async def test_fallback_path_enforces_tiered_limits(monkeypatch: pytest.MonkeyPatch) -> None:
    """Simulate Redis failure; fallback cache must still apply the tier limit."""

    class _BrokenPipeline:
        def zremrangebyscore(self, *a: Any, **k: Any) -> None: ...
        def zcard(self, *a: Any, **k: Any) -> None: ...
        def zadd(self, *a: Any, **k: Any) -> None: ...
        def expire(self, *a: Any, **k: Any) -> None: ...

        async def execute(self) -> None:
            raise RedisError("simulated outage")

    monkeypatch.setattr(redis_client, "pipeline", lambda: _BrokenPipeline())

    limiter = RateLimiter("fallback_tier", anon=1, authed=3, admin=10)
    anon_req = _make_request(ip="198.51.100.9")
    authed_req = _make_request(ip="198.51.100.9", token=_authed_token())

    # Anon tier = 1 in fallback
    await limiter(anon_req)
    with pytest.raises(HTTPException):
        await limiter(anon_req)

    # Authed tier = 3 in fallback (independent bucket)
    for _ in range(3):
        await limiter(authed_req)
    with pytest.raises(HTTPException):
        await limiter(authed_req)


async def test_fallback_path_honours_cost_weight(monkeypatch: pytest.MonkeyPatch) -> None:
    class _BrokenPipeline:
        def zremrangebyscore(self, *a: Any, **k: Any) -> None: ...
        def zcard(self, *a: Any, **k: Any) -> None: ...
        def zadd(self, *a: Any, **k: Any) -> None: ...
        def expire(self, *a: Any, **k: Any) -> None: ...

        async def execute(self) -> None:
            raise RedisError("simulated outage")

    monkeypatch.setattr(redis_client, "pipeline", lambda: _BrokenPipeline())

    limiter = RateLimiter("fallback_cost", anon=10, authed=10, admin=10, cost=5)
    req = _make_request(ip="198.51.100.10")

    await limiter(req)  # 5/10
    await limiter(req)  # 10/10
    with pytest.raises(HTTPException):
        await limiter(req)  # would be 15/10


# ---------------------------------------------------------------------------
# Pre-built dependencies honour settings.RATE_LIMIT_TIERS
# ---------------------------------------------------------------------------


async def test_prebuilt_rate_limit_login_uses_configured_tiers() -> None:
    # Verify the pre-built dep has anon/authed/admin from settings.
    limits = rate_limit.rate_limit_login.limits
    assert limits["anon"] >= 1
    assert limits["authed"] >= limits["anon"]
    assert limits["admin"] >= limits["authed"]


async def test_prebuilt_export_pdf_has_cost_5() -> None:
    assert rate_limit.rate_limit_export_pdf.cost == 5
    assert rate_limit.rate_limit_bulk_email.cost == 5


# ---------------------------------------------------------------------------
# Invalid constructor arguments
# ---------------------------------------------------------------------------


async def test_constructor_requires_limits() -> None:
    with pytest.raises(ValueError):
        RateLimiter("bad_signature")


async def test_admin_defaults_to_authed_when_omitted() -> None:
    limiter = RateLimiter("admin_default", anon=1, authed=7)
    assert limiter.limits["admin"] == 7


# ---------------------------------------------------------------------------
# Redis path integration smoke test (skipped if Redis unreachable)
# ---------------------------------------------------------------------------


async def test_redis_path_allows_then_blocks() -> None:
    try:
        await cast(Any, redis_client.ping())
    except RedisError:
        pytest.skip("Redis not reachable — covered by fallback tests.")

    limiter = RateLimiter("redis_smoke", anon=2, authed=5, admin=10)
    req = _make_request(ip="198.51.100.11")

    await limiter(req)
    await limiter(req)
    with pytest.raises(HTTPException) as excinfo:
        await limiter(req)
    assert excinfo.value.status_code == 429
    # Retry-After is populated and positive.
    headers = cast(dict[str, str], excinfo.value.headers)
    retry_after = int(headers["Retry-After"])
    assert retry_after >= 1


async def test_redis_path_cost_weight_smoke() -> None:
    try:
        await cast(Any, redis_client.ping())
    except RedisError:
        pytest.skip("Redis not reachable — covered by fallback tests.")

    # A fresh "action" per test so we don't alias anyone else's bucket.
    limiter = RateLimiter("redis_cost_smoke", anon=4, authed=4, admin=4, cost=2)
    req = _make_request(ip="198.51.100.12")

    await limiter(req)  # 2/4
    await limiter(req)  # 4/4
    with pytest.raises(HTTPException):
        await limiter(req)
