"""Envelope-wrapped application secrets (DocuSign, SMTP, etc.).

Secrets like ``DOCUSIGN_PRIVATE_KEY`` and ``SMTP_PASSWORD`` are too large or
awkward to live in a DB column, so they remain environment variables — but the
plaintext form is a single-leak-equals-game-over. The ``seal_secret`` /
``unseal_secret`` helpers here let the deploy carry them as AES-GCM ciphertext
wrapped with the already-configured ``AMG_KEK`` key set. Splitting the
compromise surface: an attacker needs *both* an env dump *and* the KEK set to
recover plaintext.

Wire format (identical shape to :mod:`app.db.encrypted_type`):

    [0]      version = 0x01
    [1]      key_id (1..255) — indexes into AMG_KEK_KEYS
    [2..13]  12-byte random nonce
    [14..]   AES-GCM ciphertext || 16-byte tag

AAD = ``f"sealed|{name}".encode()`` so the *purpose* binding prevents an
attacker from swapping, say, the sealed DocuSign key into the SMTP password
slot in hopes of side-channel leakage.

Encoding on the wire / in env vars: urlsafe base64 (so it pastes cleanly into
Railway / docker-compose).
"""

from __future__ import annotations

import base64
import os
from threading import Lock

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.crypto import get_crypto

VERSION_BYTE: int = 0x01
NONCE_LEN: int = 12
HEADER_LEN: int = 2 + NONCE_LEN


def _aad(name: str) -> bytes:
    return f"sealed|{name}".encode()


def seal_secret(name: str, plaintext: bytes | str) -> str:
    """Wrap *plaintext* with the current KEK; return urlsafe-base64 ciphertext.

    One-shot helper intended for a provisioning CLI (see
    ``scripts.seal_secret``). Servers only call :func:`unseal_secret`.
    """
    if isinstance(plaintext, str):
        plaintext = plaintext.encode("utf-8")
    crypto = get_crypto()
    key_id = crypto.current_kek_id
    kek = crypto.unwrap_kek(key_id)
    nonce = os.urandom(NONCE_LEN)
    # Use the KEK directly as the sealing key. HKDF-per-tenant doesn't apply
    # here — these are single-tenant application secrets — and introducing a
    # derivation step would couple secret rotation to unrelated plumbing.
    ct_and_tag = AESGCM(kek).encrypt(nonce, plaintext, _aad(name))
    blob = bytes([VERSION_BYTE, key_id]) + nonce + ct_and_tag
    return base64.urlsafe_b64encode(blob).decode("ascii")


def unseal_secret(name: str, wrapped: str) -> bytes:
    """Inverse of :func:`seal_secret`. Raises on any tampering / bad KEK id."""
    try:
        raw = base64.urlsafe_b64decode(wrapped.encode("ascii") + b"=" * (-len(wrapped) % 4))
    except (ValueError, base64.binascii.Error) as exc:  # type: ignore[attr-defined]
        raise ValueError(f"sealed secret {name!r}: not valid urlsafe-base64") from exc
    if len(raw) < HEADER_LEN + 16:
        raise ValueError(f"sealed secret {name!r}: ciphertext too short")
    version = raw[0]
    if version != VERSION_BYTE:
        raise ValueError(f"sealed secret {name!r}: unsupported version 0x{version:02x}")
    key_id = raw[1]
    nonce = raw[2:HEADER_LEN]
    ct_and_tag = raw[HEADER_LEN:]
    crypto = get_crypto()
    kek = crypto.unwrap_kek(key_id)
    return AESGCM(kek).decrypt(nonce, ct_and_tag, _aad(name))


# ---------------------------------------------------------------------------
# Process-level cache
# ---------------------------------------------------------------------------
#
# Decrypting on every call is cheap (microseconds) but noisy and makes key
# rotation harder to observe. Cache the unsealed value per (name, wrapped)
# pair so the first call pays the cost and subsequent calls are a dict hit.
# Cache keys include the wrapped blob so rotating the sealed env var in-place
# (e.g. after a KEK roll) invalidates automatically.

_cache: dict[tuple[str, str], bytes] = {}
_cache_lock = Lock()


def unseal_cached(name: str, wrapped: str) -> bytes:
    key = (name, wrapped)
    with _cache_lock:
        hit = _cache.get(key)
        if hit is not None:
            return hit
    value = unseal_secret(name, wrapped)
    with _cache_lock:
        _cache[key] = value
    return value


def clear_secret_cache() -> None:
    """Drop all cached unsealed secrets. For tests and key rotation hooks."""
    with _cache_lock:
        _cache.clear()
