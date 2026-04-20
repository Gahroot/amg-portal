"""SQLAlchemy TypeDecorator for column-level envelope encryption.

Wire format (bytes):
  [0]      version = 0x01
  [1]      key_id  (1..255) — indexes into the KEK set
  [2..13]  12-byte random nonce
  [14..]   AES-GCM ciphertext concatenated with the 16-byte auth tag

AAD (Day 1 / Option B) = b"{table}|{column}". PK binding (Option A in the plan) is
left as a follow-up: ``process_bind_param`` doesn't see the row PK cleanly, and the
context-var hand-off through before_insert/before_update is fiddly enough that we
ship without it rather than invent a half-broken abstraction. Tradeoff documented in
.gg/plans/phase1-encryption-audit.md §4.1.2.
"""

from __future__ import annotations

import os
from contextvars import ContextVar
from typing import TYPE_CHECKING, Any
from uuid import UUID

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import LargeBinary
from sqlalchemy.types import TypeDecorator

from app.core.crypto import get_crypto

if TYPE_CHECKING:
    from sqlalchemy.engine.interfaces import Dialect

VERSION_BYTE: int = 0x01
NONCE_LEN: int = 12
HEADER_LEN: int = 2 + NONCE_LEN

# Populated by SQLA before_insert/before_update listeners when row PK + tenant are
# known. Kept here so downstream Option A work has a single import point; today the
# TypeDecorator ignores whatever is stored and AADs on table|column alone.
encryption_context_var: ContextVar[dict[str, UUID] | None] = ContextVar(
    "encryption_context_var", default=None
)


class EncryptedBytes(TypeDecorator[bytes]):
    impl = LargeBinary
    cache_ok = True

    def __init__(self, *, table: str, column: str) -> None:
        super().__init__()
        self._table = table
        self._column = column
        self._tenant_placeholder = UUID("00000000-0000-0000-0000-000000000000")

    @property
    def python_type(self) -> type[bytes]:
        return bytes

    def _aad(self) -> bytes:
        return f"{self._table}|{self._column}".encode()

    def _resolve_tenant(self) -> UUID:
        ctx = encryption_context_var.get()
        if ctx is not None and "tenant_id" in ctx:
            return ctx["tenant_id"]
        return self._tenant_placeholder

    def process_bind_param(self, value: Any, dialect: Dialect) -> bytes | None:
        if value is None:
            return None
        if not isinstance(value, (bytes, bytearray, memoryview)):
            raise TypeError(
                f"EncryptedBytes({self._table}.{self._column}) requires bytes, "
                f"got {type(value).__name__}"
            )
        plaintext = bytes(value)
        crypto = get_crypto()
        key_id = crypto.current_kek_id
        kek = crypto.unwrap_kek(key_id)
        dek = crypto.derive_dek(kek, self._resolve_tenant(), self._column)
        nonce = os.urandom(NONCE_LEN)
        ct_and_tag = AESGCM(dek).encrypt(nonce, plaintext, self._aad())
        return bytes([VERSION_BYTE, key_id]) + nonce + ct_and_tag

    def process_result_value(self, value: Any, dialect: Dialect) -> bytes | None:
        if value is None:
            return None
        raw = bytes(value)
        if len(raw) < HEADER_LEN + 16:
            raise ValueError(
                f"EncryptedBytes({self._table}.{self._column}): ciphertext too short"
            )
        version = raw[0]
        if version != VERSION_BYTE:
            raise ValueError(
                f"EncryptedBytes({self._table}.{self._column}): "
                f"unsupported ciphertext version 0x{version:02x}"
            )
        key_id = raw[1]
        nonce = raw[2:HEADER_LEN]
        ct_and_tag = raw[HEADER_LEN:]
        crypto = get_crypto()
        kek = crypto.unwrap_kek(key_id)
        dek = crypto.derive_dek(kek, self._resolve_tenant(), self._column)
        return AESGCM(dek).decrypt(nonce, ct_and_tag, self._aad())
