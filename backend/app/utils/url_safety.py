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
    # AWS EC2 alt names for 169.254.169.254 (both IPv4 and the IMDSv2 IP cover
    # the same host; the hostname variant is what hits internal split-horizon
    # resolvers).
    "instance-data",
    "instance-data.ec2.internal",
    # Azure IMDS (resolves to 169.254.169.254 but flagged by hostname in case
    # a misconfigured resolver returns a public IP).
    "metadata.azure.internal",
}

# Ranges Python's ``ipaddress.is_*`` flags do NOT cover — must be added
# explicitly.  Patterns cross-checked against OWASP SSRF Prevention Cheat
# Sheet and real-world implementations (AutoGPT, Quay, langflow, hermes-agent).
_EXTRA_BLOCKED_NETWORKS: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    # RFC 6598 Shared Address Space — used for CGNAT, Tailscale/WireGuard
    # defaults, and some cloud VPC ranges (notably Alibaba IMDS 100.100.100.200).
    # ``IPv4Address.is_private`` returns False for this range.
    ipaddress.ip_network("100.64.0.0/10"),
    # RFC 2544 benchmarking range — occasionally reachable on lab networks.
    ipaddress.ip_network("198.18.0.0/15"),
    # IPv4-mapped IPv6 — an attacker can encode a private IPv4 as ``::ffff:a.b.c.d``
    # and dodge IPv4-only checks.
    ipaddress.ip_network("::ffff:0:0/96"),
]


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_unspecified
        or ip.is_reserved
    ):
        return True
    return any(ip in net for net in _EXTRA_BLOCKED_NETWORKS)


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
