"""HaveIBeenPwned k-anonymity password check.

Uses the free Pwned Passwords range API (no API key required). Only the first
5 hex chars of the SHA-1 are sent over the wire — the remaining 35 chars are
matched locally against the returned suffix list.

Network outage is deliberately fail-open: blocking every registration when
HIBP is unreachable is worse than occasionally accepting a breached password.
See ``phase1-encryption-audit.md`` §1.7.
"""

from __future__ import annotations

import hashlib
import logging

import httpx

from app.core.exceptions import BadRequestException

logger = logging.getLogger(__name__)

_HIBP_URL = "https://api.pwnedpasswords.com/range/{prefix}"
_USER_AGENT = "AMG-Portal"
_TIMEOUT = httpx.Timeout(5.0, connect=2.0)
_THRESHOLD = 1


async def check_password_pwned(password: str) -> int:
    """Return how many times ``password`` appears in public breach corpora.

    Returns ``0`` on any network/HTTP failure (fail-open).
    """
    # HIBP returns hex in uppercase and matches are case-sensitive on the suffix.
    sha1 = hashlib.sha1(password.encode("utf-8"), usedforsecurity=False).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]

    logger.debug("HIBP range query prefix=%s", prefix)

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(
                _HIBP_URL.format(prefix=prefix),
                headers={"User-Agent": _USER_AGENT},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("HIBP lookup failed, failing open: %s", exc)
        return 0

    for line in response.text.splitlines():
        # Each line is ``SUFFIX:COUNT``; split once so pathological input cannot trip us up.
        sfx, _, count = line.partition(":")
        if sfx == suffix:
            try:
                return int(count)
            except ValueError:
                return 0
    return 0


async def enforce_not_pwned(password: str) -> None:
    """Raise ``BadRequestException`` if the password appears in known breaches."""
    count = await check_password_pwned(password)
    if count >= _THRESHOLD:
        raise BadRequestException(
            "This password has appeared in a public data breach. "
            "Choose a different password.",
        )
