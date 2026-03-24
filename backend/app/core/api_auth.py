"""API Key authentication middleware and dependencies.

This module provides authentication for API requests using API keys.
API keys can be passed via the X-API-Key header or as a query parameter.
"""

import hashlib
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import APIKeyHeader, APIKeyQuery
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedException
from app.db.session import get_db
from app.models.api_key import APIKey
from app.models.user import User

logger = logging.getLogger(__name__)

# API key can be passed in header or query parameter
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
api_key_query = APIKeyQuery(name="api_key", auto_error=False)

# Default rate limit (requests per minute)
DEFAULT_RATE_LIMIT = 60

# In-memory rate limiting (for single-instance deployment)
# For multi-instance, use Redis instead
_rate_limit_cache: dict[str, list[float]] = {}


def _hash_key(key: str) -> str:
    """Hash an API key for lookup."""
    return hashlib.sha256(key.encode()).hexdigest()


def _check_rate_limit(key_hash: str, limit: int) -> bool:
    """Check if the rate limit has been exceeded.

    Uses a simple sliding window algorithm.
    """
    import time

    current_time = time.time()
    window_start = current_time - 60  # 1 minute window

    # Get or initialize request timestamps for this key
    if key_hash not in _rate_limit_cache:
        _rate_limit_cache[key_hash] = []

    # Remove timestamps outside the window
    _rate_limit_cache[key_hash] = [
        ts for ts in _rate_limit_cache[key_hash] if ts > window_start
    ]

    # Check if under limit
    if len(_rate_limit_cache[key_hash]) >= limit:
        return False

    # Record this request
    _rate_limit_cache[key_hash].append(current_time)
    return True


async def _get_api_key_from_request(
    request: Request,
    api_key_header_val: str | None = None,
    api_key_query_val: str | None = None,
) -> str | None:
    """Extract API key from request headers or query parameters."""
    # Check header first, then query parameter
    if api_key_header_val:
        return api_key_header_val
    if api_key_query_val:
        return api_key_query_val
    return None


async def get_api_key_user(  # noqa: PLR0911
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    api_key_header_val: Annotated[str | None, Depends(api_key_header)] = None,
    api_key_query_val: Annotated[str | None, Depends(api_key_query)] = None,
) -> User | None:
    """Validate API key and return the associated user.

    This is used as an optional dependency - returns None if no API key is provided.
    """
    api_key = await _get_api_key_from_request(
        request, api_key_header_val, api_key_query_val
    )
    if not api_key:
        return None

    # Validate key format
    if not api_key.startswith("amg_"):
        return None

    # Hash the key for lookup
    key_hash = _hash_key(api_key)

    # Look up the API key
    result = await db.execute(select(APIKey).where(APIKey.key_hash == key_hash))
    api_key_obj = result.scalar_one_or_none()

    if not api_key_obj:
        logger.warning(f"API key lookup failed for hash prefix: {key_hash[:8]}...")
        return None

    # Check if key is active
    if not api_key_obj.is_active:
        logger.info(f"API key {api_key_obj.id} is inactive")
        return None

    # Check if key is expired
    if api_key_obj.expires_at and datetime.now(UTC) > api_key_obj.expires_at:
        logger.info(f"API key {api_key_obj.id} is expired")
        return None

    # Check rate limit
    rate_limit = api_key_obj.rate_limit or DEFAULT_RATE_LIMIT
    if not _check_rate_limit(key_hash, rate_limit):
        logger.warning(f"API key {api_key_obj.id} exceeded rate limit")
        raise UnauthorizedException("Rate limit exceeded. Please try again later.")

    # Get the user
    user_result = await db.execute(select(User).where(User.id == api_key_obj.user_id))
    user = user_result.scalar_one_or_none()

    if not user or user.status != "active":
        return None

    # Record usage
    api_key_obj.record_usage()
    await db.commit()

    # Store API key info in request state for audit logging
    request.state.api_key_id = api_key_obj.id
    request.state.api_key_scopes = api_key_obj.scopes

    return user


async def require_api_key_user(
    user: Annotated[User | None, Depends(get_api_key_user)],
) -> User:
    """Require a valid API key and return the associated user.

    Raises 401 if no valid API key is provided.
    """
    if not user:
        raise UnauthorizedException("Invalid or missing API key")
    return user


def require_api_key_scope(
    scope: str,
) -> Callable[[Request], Awaitable[None]]:
    """Dependency factory that checks if the API key has a specific scope.

    Usage:
        @router.get("/protected", dependencies=[Depends(require_api_key_scope("read:clients"))])
        async def protected_endpoint(): ...
    """

    async def check_scope(request: Request) -> None:
        api_key_scopes = getattr(request.state, "api_key_scopes", None)
        if api_key_scopes is None:
            # Not an API key request (might be JWT auth), allow through
            return

        if scope not in api_key_scopes and "*" not in api_key_scopes:
            raise UnauthorizedException(
                f"API key does not have required scope: {scope}"
            )

    return check_scope


# Type aliases for use in route handlers
APIKeyUser = Annotated[User | None, Depends(get_api_key_user)]
RequiredAPIKeyUser = Annotated[User, Depends(require_api_key_user)]


async def log_api_key_usage(
    request: Request,
    db: AsyncSession,
    status_code: int,
) -> None:
    """Log API key usage for audit purposes.

    This should be called after processing a request authenticated with an API key.
    """
    api_key_id = getattr(request.state, "api_key_id", None)
    if not api_key_id:
        return

    # Import here to avoid circular imports
    from app.models.audit_log import AuditLog
    from app.models.enums import AuditAction

    # Create audit log entry
    audit_log = AuditLog(
        user_id=None,  # API key usage doesn't have a direct user session
        action=AuditAction.create,  # Could be refined based on the operation
        entity_type="api_key_usage",
        entity_id=str(api_key_id),
        after_state={
            "endpoint": request.url.path,
            "method": request.method,
            "status_code": status_code,
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(audit_log)
    await db.commit()
