"""URL safety helpers for preventing SSRF via user-supplied webhook URLs."""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

_BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
    "metadata",
}


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_unspecified
        or ip.is_reserved
    )


def validate_safe_webhook_url(url: str) -> str:
    """Validate that ``url`` is safe to POST to from the server.

    Rejects non-http(s) schemes, loopback/private/link-local/metadata hosts,
    and IP literals that resolve to internal ranges. Does not perform DNS
    resolution — runtime delivery code should also resolve+check the host
    to defend against DNS rebinding.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must start with http:// or https://")

    host = (parsed.hostname or "").strip().lower()
    if not host:
        raise ValueError("URL must include a host")

    if host in _BLOCKED_HOSTNAMES or host.endswith(".localhost"):
        raise ValueError("URL host is not allowed")

    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return url

    if _is_blocked_ip(ip):
        raise ValueError("URL resolves to a disallowed network range")
    return url


def resolve_is_safe_host(host: str) -> bool:
    """Resolve ``host`` and return True iff every address is publicly routable.

    Use this at delivery time to defend against DNS rebinding between
    submission and webhook delivery.
    """
    if not host or host.lower() in _BLOCKED_HOSTNAMES:
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        sockaddr = info[4]
        try:
            ip = ipaddress.ip_address(sockaddr[0])
        except ValueError:
            return False
        if _is_blocked_ip(ip):
            return False
    return True
