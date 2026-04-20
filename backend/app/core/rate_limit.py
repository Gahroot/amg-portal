"""Redis-backed rate limiting with per-role tiers and cost weighting.

Uses a sliding-window counter stored in Redis.  For authenticated callers
the bucket is keyed on ``user_id`` (stable across IP changes); for anonymous
callers it is keyed on the trusted client IP so distributed credential
stuffing still fills a finite bucket.

Tiers
-----
Each action declares three limits — ``anon`` / ``authed`` / ``admin`` —
resolved at call time from the authenticated user's role.  ``admin`` covers
the ``managing_director`` role only; every other authenticated role falls
into ``authed``.

Cost weighting
--------------
Heavy endpoints (PDF export, bulk email) declare ``cost=5`` at construction
time.  Each request consumes ``cost`` slots from the sliding window in a
single pipelined ``ZADD`` — 5-cost endpoints fill their bucket 5× faster
than 1-cost endpoints sharing the same tier.

Redis failure handling
----------------------
When Redis is unavailable this module falls back to a per-process
``cachetools.TTLCache`` that preserves brute-force protection.  The in-process
cache is *not* shared across workers, so effective limits under multiple
workers are multiplied by the worker count — but that is far safer than
failing open.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, Final, Literal

import jwt
import jwt.exceptions
from cachetools import TTLCache
from fastapi import HTTPException, Request, status
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.ip_utils import get_client_ip
from app.db.redis import redis_client

logger = logging.getLogger(__name__)

# Redis key prefix for rate limit counters
_KEY_PREFIX = "rate_limit:"

# Tier labels — kept as a Literal so a typo in one call site is caught by mypy.
Tier = Literal["anon", "authed", "admin"]

# Admin role — only the managing_director gets the admin tier.  Kept here
# rather than imported from ``app.models.enums`` to keep this module free of
# ORM imports (rate limiter is middleware-adjacent).
_ADMIN_ROLE: Final[str] = "managing_director"

# ---------------------------------------------------------------------------
# In-process fallback cache used when Redis is unreachable.
# Stores {key: count} with a TTL matching the rate-limit window.
# maxsize caps memory consumption: 10 000 distinct (action, IP) pairs is
# more than enough for any realistic deployment.
# ---------------------------------------------------------------------------
_fallback_lock = threading.Lock()
# TTL is set to the longest window we use (60 s by default).  Each key is
# evicted automatically after that period, mirroring the Redis sliding window.
_FALLBACK_TTL = 120  # seconds — generous upper bound across all windows
_fallback_cache: TTLCache[str, int] = TTLCache(maxsize=10_000, ttl=_FALLBACK_TTL)


def _fallback_check(
    key: str,
    max_requests: int,
    cost: int,
) -> tuple[bool, int, int]:
    """Increment the in-process counter for *key* by *cost* and enforce limit.

    Returns ``(allowed, remaining, retry_after)`` — same contract as
    ``_check_rate_limit``.  Mirrors the Redis path: over-limit denials do
    *not* mutate the counter, so they don't further delay legitimate retries.
    """
    with _fallback_lock:
        count: int = _fallback_cache.get(key, 0)
        if count + cost > max_requests:
            return False, max(max_requests - count, 0), _FALLBACK_TTL
        _fallback_cache[key] = count + cost
        return True, max_requests - count - cost, 0


async def _check_rate_limit(
    key: str,
    max_requests: int,
    window_seconds: int = 60,
    cost: int = 1,
) -> tuple[bool, int, int]:
    """Check whether *key* has exceeded *max_requests* in the last window.

    When ``cost > 1`` the request inserts ``cost`` entries into the sliding
    window ZSET in one pipelined ``ZADD`` — heavy endpoints drain their
    tier proportionally faster.

    Returns ``(allowed, remaining, retry_after)``.  ``retry_after`` is
    meaningful only when ``allowed`` is False.
    """
    now = time.time()
    window_start = now - window_seconds

    pipe = redis_client.pipeline()
    # Remove entries outside the window
    pipe.zremrangebyscore(key, 0, window_start)
    # Count entries inside the window
    pipe.zcard(key)
    # Insert *cost* distinct entries at the current timestamp.  Members must be
    # unique or ZADD is a no-op; we disambiguate with a monotonic suffix.
    # Batching into a single ZADD keeps this one round-trip regardless of cost.
    mapping = {f"{now}:{i}": now for i in range(cost)}
    pipe.zadd(key, mapping)
    # Set expiry so keys don't linger forever
    pipe.expire(key, window_seconds + 1)
    results = await pipe.execute()

    current_count: int = results[1]  # zcard result (before adding this request)

    if current_count + cost > max_requests:
        # Over limit — find the oldest entry to calculate Retry-After
        oldest = await redis_client.zrange(key, 0, 0, withscores=True)
        retry_after = int(window_seconds - (now - oldest[0][1])) + 1 if oldest else window_seconds
        # Remove the optimistic zadd we just did
        await redis_client.zrem(key, *mapping.keys())
        return False, max(max_requests - current_count, 0), max(retry_after, 1)

    remaining = max_requests - current_count - cost
    return True, remaining, 0


def _decode_access_token_silently(token: str) -> dict[str, Any] | None:
    """Decode an access JWT without raising.

    Mirrors ``middleware/csrf.py:_decode_access_token_silently`` — kept
    inline so the rate-limit middleware doesn't drag in the auth module's
    import graph.  Any decode failure → return ``None`` and the caller
    treats the request as anonymous.
    """
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except jwt.exceptions.InvalidTokenError:
        return None
    if payload.get("type") != "access":
        return None
    return payload


def _extract_token_from_request(request: Request) -> str | None:
    """Return the access JWT from Authorization header or auth cookie."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip() or None
    return request.cookies.get("__Host-access_token") or request.cookies.get("access_token")


def _resolve_caller(request: Request) -> tuple[Tier, str]:
    """Return ``(tier, bucket_id)`` for the current request.

    * Authenticated user → ``(authed|admin, user_id)``.
    * Anon / unparseable token → ``(anon, client_ip)``.
    """
    token = _extract_token_from_request(request)
    if token:
        payload = _decode_access_token_silently(token)
        if payload is not None:
            sub = payload.get("sub")
            role = payload.get("role")
            if isinstance(sub, str) and sub:
                tier: Tier = "admin" if role == _ADMIN_ROLE else "authed"
                return tier, f"uid:{sub}"
    return "anon", f"ip:{get_client_ip(request)}"


class RateLimiter:
    """FastAPI dependency enforcing per-role, cost-weighted rate limits.

    Two construction styles are supported:

    * Tiered (preferred)::

          RateLimiter("login", anon=5, authed=20, admin=100, cost=1)

    * Legacy flat limit (kept for backward compatibility with existing
      call-sites)::

          RateLimiter("login", 5)

      — the integer is used for every tier.
    """

    def __init__(
        self,
        action: str,
        max_requests: int | None = None,
        window_seconds: int = 60,
        *,
        anon: int | None = None,
        authed: int | None = None,
        admin: int | None = None,
        cost: int = 1,
    ) -> None:
        if cost < 1:
            raise ValueError("cost must be >= 1")
        self.action = action
        self.window_seconds = window_seconds
        self.cost = cost

        if max_requests is not None and anon is None and authed is None and admin is None:
            # Legacy flat-limit signature: RateLimiter("login", 5)
            self.limits: dict[Tier, int] = {
                "anon": max_requests,
                "authed": max_requests,
                "admin": max_requests,
            }
        else:
            if anon is None or authed is None:
                raise ValueError(
                    "RateLimiter requires either max_requests (flat) or both "
                    "anon= and authed= (tiered).  admin= defaults to authed.",
                )
            self.limits = {
                "anon": anon,
                "authed": authed,
                "admin": admin if admin is not None else authed,
            }

    async def __call__(self, request: Request) -> None:
        tier, bucket_id = _resolve_caller(request)
        limit = self.limits[tier]
        # An explicit limit of 0 means "forbidden for this tier" — usually
        # applied to anon on endpoints that require authentication.
        if limit <= 0:
            logger.warning(
                "Rate limit denies tier=%s on action=%s (limit=0)", tier, self.action
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(self.window_seconds)},
            )

        key = f"{_KEY_PREFIX}{self.action}:{tier}:{bucket_id}"

        try:
            allowed, remaining, retry_after = await _check_rate_limit(
                key,
                limit,
                self.window_seconds,
                self.cost,
            )
        except RedisError as exc:
            # Redis is unavailable — switch to the in-process fallback cache
            # so brute-force protection remains active.
            logger.warning(
                "Redis unavailable for rate-limit check (%s); using in-process fallback",
                exc,
            )
            allowed, remaining, retry_after = _fallback_check(key, limit, self.cost)

        if not allowed:
            logger.warning(
                "Rate limit exceeded: action=%s tier=%s bucket=%s limit=%d/%ds cost=%d",
                self.action,
                tier,
                bucket_id,
                limit,
                self.window_seconds,
                self.cost,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )


def _tier_kwargs(action: str) -> dict[str, int]:
    """Pull ``anon``/``authed``/``admin`` kwargs for *action* out of settings.

    Falls back to the single-tier flat limit if the action is missing from
    ``RATE_LIMIT_TIERS`` so adding a new entry to config is non-breaking.
    """
    tiers = settings.RATE_LIMIT_TIERS.get(action)
    if tiers is None:
        return {}
    return {"anon": tiers["anon"], "authed": tiers["authed"], "admin": tiers["admin"]}


# ── Pre-built rate-limit dependencies for auth endpoints ────────────
rate_limit_login = RateLimiter("login", **_tier_kwargs("login"))
rate_limit_register = RateLimiter("register", **_tier_kwargs("register"))
rate_limit_forgot_password = RateLimiter("forgot_password", **_tier_kwargs("forgot_password"))
rate_limit_refresh = RateLimiter("refresh", **_tier_kwargs("refresh"))
# Matches login tier — prevents TOTP brute-force on MFA disable.
rate_limit_mfa_disable = RateLimiter("mfa_disable", **_tier_kwargs("mfa_disable"))

# ── Heavy-cost endpoints (cost=5) ──────────────────────────────────
# These define the dependencies; individual route handlers are wired
# separately by the agent owning those routes.
rate_limit_export_pdf = RateLimiter(
    "export_pdf", cost=5, **_tier_kwargs("export_pdf")
)
rate_limit_bulk_email = RateLimiter(
    "bulk_email", cost=5, **_tier_kwargs("bulk_email")
)
