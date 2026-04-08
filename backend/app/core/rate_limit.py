"""Redis-backed rate limiting for authentication endpoints.

Uses a sliding-window counter per IP address stored in Redis.
Returns a FastAPI dependency that raises 429 when the limit is exceeded.

Redis failure handling
----------------------
When Redis is unavailable this module falls back to a per-process
``cachetools.TTLCache`` that preserves brute-force protection.  The in-process
cache is *not* shared across workers, so effective limits under multiple
workers are multiplied by the worker count — but that is far safer than the
previous behaviour of failing open (allowing unlimited requests).
"""

import logging
import threading
import time

from cachetools import TTLCache
from fastapi import HTTPException, Request, status
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.ip_utils import get_client_ip
from app.db.redis import redis_client

logger = logging.getLogger(__name__)

# Redis key prefix for rate limit counters
_KEY_PREFIX = "rate_limit:"

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


def _fallback_check(key: str, max_requests: int) -> tuple[bool, int, int]:
    """Increment the in-process counter for *key* and enforce *max_requests*.

    Returns ``(allowed, remaining, retry_after)`` — the same contract as
    ``_check_rate_limit``.
    """
    with _fallback_lock:
        count: int = _fallback_cache.get(key, 0)
        if count >= max_requests:
            return False, 0, _FALLBACK_TTL
        _fallback_cache[key] = count + 1
        return True, max_requests - count - 1, 0


async def _check_rate_limit(
    key: str, max_requests: int, window_seconds: int = 60,
) -> tuple[bool, int, int]:
    """Check whether *key* has exceeded *max_requests* in the last *window_seconds*.

    Returns ``(allowed, remaining, retry_after)`` where *retry_after* is
    only meaningful when *allowed* is ``False``.
    """
    now = time.time()
    window_start = now - window_seconds

    pipe = redis_client.pipeline()
    # Remove entries outside the window
    pipe.zremrangebyscore(key, 0, window_start)
    # Count entries inside the window
    pipe.zcard(key)
    # Add the current request timestamp
    pipe.zadd(key, {str(now): now})
    # Set expiry so keys don't linger forever
    pipe.expire(key, window_seconds + 1)
    results = await pipe.execute()

    current_count: int = results[1]  # zcard result (before adding this request)

    if current_count >= max_requests:
        # Over limit — find the oldest entry to calculate Retry-After
        oldest = await redis_client.zrange(key, 0, 0, withscores=True)
        retry_after = int(window_seconds - (now - oldest[0][1])) + 1 if oldest else window_seconds
        # Remove the optimistic zadd we just did
        await redis_client.zrem(key, str(now))
        return False, 0, max(retry_after, 1)

    remaining = max_requests - current_count - 1
    return True, remaining, 0


class RateLimiter:
    """FastAPI dependency that enforces per-IP rate limits via Redis.

    Usage::

        @router.post("/login", dependencies=[Depends(RateLimiter("login", 5))])
        async def login(...): ...
    """

    def __init__(self, action: str, max_requests: int, window_seconds: int = 60) -> None:
        self.action = action
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def __call__(self, request: Request) -> None:
        ip = get_client_ip(request)
        key = f"{_KEY_PREFIX}{self.action}:{ip}"

        try:
            allowed, remaining, retry_after = await _check_rate_limit(
                key, self.max_requests, self.window_seconds,
            )
        except RedisError as exc:
            # Redis is unavailable — switch to the in-process fallback cache
            # so brute-force protection remains active.
            logger.warning(
                "Redis unavailable for rate-limit check (%s); using in-process fallback",
                exc,
            )
            allowed, remaining, retry_after = _fallback_check(key, self.max_requests)

        if not allowed:
            logger.warning(
                "Rate limit exceeded: action=%s ip=%s limit=%d/%ds",
                self.action, ip, self.max_requests, self.window_seconds,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )


# ── Pre-built rate-limit dependencies for auth endpoints ────────────
rate_limit_login = RateLimiter("login", settings.RATE_LIMIT_LOGIN)
rate_limit_register = RateLimiter("register", settings.RATE_LIMIT_REGISTER)
rate_limit_forgot_password = RateLimiter("forgot_password", settings.RATE_LIMIT_FORGOT_PASSWORD)
rate_limit_refresh = RateLimiter("refresh", settings.RATE_LIMIT_REFRESH)
# 5 attempts per minute — matches login; prevents TOTP brute-force on MFA disable
rate_limit_mfa_disable = RateLimiter("mfa_disable", settings.RATE_LIMIT_LOGIN)
