"""Utilities for extracting a trustworthy client IP from a request.

X-Forwarded-For is only honoured when the TCP peer (``request.client.host``)
is in the configured ``TRUSTED_PROXIES`` list.  This prevents a client from
spoofing its IP address by injecting an arbitrary ``X-Forwarded-For`` header.
"""

import ipaddress
import logging

from starlette.requests import Request

from app.core.config import settings

logger = logging.getLogger(__name__)

# Pre-parse the trusted proxy list once at import time so every request is fast.
_TRUSTED_NETWORKS: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []

for _entry in settings.TRUSTED_PROXIES:
    try:
        _TRUSTED_NETWORKS.append(ipaddress.ip_network(_entry.strip(), strict=False))
    except ValueError:
        logger.warning("Invalid entry in TRUSTED_PROXIES, ignoring: %r", _entry)


def _is_trusted_proxy(host: str) -> bool:
    """Return True when *host* belongs to a configured trusted-proxy network."""
    if not _TRUSTED_NETWORKS:
        return False
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(addr in net for net in _TRUSTED_NETWORKS)


def get_client_ip(request: Request) -> str:
    """Return the real client IP for rate-limiting and audit purposes.

    Strategy:
    - If ``request.client.host`` is in ``settings.TRUSTED_PROXIES``, extract
      the *leftmost* (i.e. original client) address from ``X-Forwarded-For``.
    - Otherwise, use ``request.client.host`` directly to prevent spoofing.
    - Falls back to ``"unknown"`` when no peer address is available at all.
    """
    peer = request.client.host if request.client else None

    if peer and _is_trusted_proxy(peer):
        forwarded = request.headers.get("x-forwarded-for", "").strip()
        if forwarded:
            return forwarded.split(",")[0].strip()

    return peer or "unknown"
