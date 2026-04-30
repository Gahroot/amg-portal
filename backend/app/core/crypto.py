"""Envelope encryption primitives for AMG Portal.

Day-1 implementation uses env-var KEKs with HKDF-derived per-tenant/column DEKs.
A ``VaultCryptoProvider`` that unwraps KEKs via HashiCorp Vault OSS is Phase-future;
downstream callers depend only on the ``CryptoProvider`` Protocol and will not change
when that lands.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import unicodedata
from typing import Protocol
from uuid import UUID

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import settings

__all__ = [
    "CryptoProvider",
    "EnvKeyCryptoProvider",
    "UnknownKeyVersion",
    "blind_index",
    "derive_subject_dek",
    "get_crypto",
    "reset_crypto_for_testing",
    "settings",
]


class UnknownKeyVersion(Exception):  # noqa: N818 — downstream API contract, not "…Error"
    """Raised when a ciphertext header references a KEK id that isn't configured."""


class CryptoProvider(Protocol):
    def unwrap_kek(self, key_id: int) -> bytes: ...
    def derive_dek(self, kek: bytes, tenant_id: UUID, column: str) -> bytes: ...
    @property
    def current_kek_id(self) -> int: ...


def _decode_key(raw: str) -> bytes:
    """Accept either urlsafe-b64 or raw hex for a 32-byte key."""
    try:
        decoded = base64.urlsafe_b64decode(raw.encode("utf-8") + b"=" * (-len(raw) % 4))
        if len(decoded) == 32:
            return decoded
    except (ValueError, base64.binascii.Error):  # type: ignore[attr-defined]
        pass
    try:
        decoded = bytes.fromhex(raw)
        if len(decoded) == 32:
            return decoded
    except ValueError:
        pass
    raise ValueError("KEK must decode to 32 bytes (urlsafe-b64 or hex)")


class EnvKeyCryptoProvider:
    def __init__(self, keys: dict[int, bytes], current: int) -> None:
        if current not in keys:
            raise ValueError(f"CURRENT_KEK_ID={current} not present in configured KEKs")
        for kid, material in keys.items():
            if len(material) != 32:
                raise ValueError(f"KEK v{kid} must be 32 bytes, got {len(material)}")
        self._keys = dict(keys)
        self._current = current

    def unwrap_kek(self, key_id: int) -> bytes:
        try:
            return self._keys[key_id]
        except KeyError as exc:
            raise UnknownKeyVersion(f"No KEK configured for id={key_id}") from exc

    def derive_dek(self, kek: bytes, tenant_id: UUID, column: str) -> bytes:
        info = f"amg|tenant|{tenant_id}|col|{column}".encode()
        hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=info)
        return hkdf.derive(kek)

    @property
    def current_kek_id(self) -> int:
        return self._current


_provider: CryptoProvider | None = None


def _build_provider() -> EnvKeyCryptoProvider:
    keys: dict[int, bytes] = {
        kid: _decode_key(raw) for kid, raw in settings.AMG_KEK_KEYS.items() if raw
    }
    if not keys:
        raise RuntimeError(
            "No AMG KEKs configured. Set AMG_KEK_KEYS (JSON dict of id->key) "
            "or run with DEBUG=True to derive a dev key from SECRET_KEY."
        )
    return EnvKeyCryptoProvider(keys=keys, current=settings.CURRENT_KEK_ID)


def get_crypto() -> CryptoProvider:
    global _provider
    if _provider is None:
        _provider = _build_provider()
    return _provider


def reset_crypto_for_testing() -> None:
    """Reset the cached provider so tests can exercise rotation paths."""
    global _provider
    _provider = None


def blind_index(value: str) -> bytes:
    """Deterministic HMAC-SHA256 keyed hash for equality lookup on encrypted columns.

    Normalisation (NFKC + strip + casefold) is a contract: write and query paths MUST
    produce byte-identical inputs or the lookup silently misses.
    """
    normalized = unicodedata.normalize("NFKC", value).strip().lower()
    key = _decode_key(settings.AMG_BIDX_KEY_V1)
    return hmac.new(key, normalized.encode("utf-8"), hashlib.sha256).digest()[:16]


# ── Subject-scoped DEK derivation for crypto-shred (Phase 2.6 / 2.14) ─


def derive_subject_dek(subject_id: UUID, subject_version: int, column: str) -> tuple[bytes, int]:
    """HKDF a DEK bound to ``(subject_id, subject_version, column)``.

    Bumping ``subject_version`` permanently invalidates every ciphertext
    encrypted under the old version — the new DEK is unrelated.  This is
    the primitive ``crypto_shred_subject`` stands on: shred = bump the
    version + purge the plaintext copies (we keep no plaintext).
    """
    crypto = get_crypto()
    key_id = crypto.current_kek_id
    kek = crypto.unwrap_kek(key_id)
    info = (f"amg|subject|{subject_id}|v{subject_version}|col|{column}").encode()
    hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=info)
    return hkdf.derive(kek), key_id
