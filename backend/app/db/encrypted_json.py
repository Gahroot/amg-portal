"""SQLAlchemy TypeDecorator composing ``EncryptedBytes`` with JSON (de)serialisation.

Phase 1.3 — lets us keep the Python-side interface as ``dict[str, Any]`` while the
row bytes on disk are AES-GCM ciphertext. Behaviour contract:

* ``None`` round-trips as ``None`` (so ``WHERE column IS NOT NULL`` still works).
* Values are JSON-serialised with ``sort_keys=True`` so two writes of equivalent
  dicts produce the same plaintext input to AES-GCM (makes migration backfills
  idempotent-detectable in principle, even though AES-GCM ciphertext is
  non-deterministic because of the random nonce).
* Reads return ``json.loads(...)`` — same Python type as the original write.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from sqlalchemy import LargeBinary
from sqlalchemy.types import TypeDecorator

from app.db.encrypted_type import EncryptedBytes

if TYPE_CHECKING:
    from sqlalchemy.engine.interfaces import Dialect


class EncryptedJSON(TypeDecorator[Any]):
    """JSON dict column that is AES-GCM encrypted at rest via ``EncryptedBytes``."""

    impl = LargeBinary
    cache_ok = True

    def __init__(self, *, table: str, column: str) -> None:
        super().__init__()
        self._inner = EncryptedBytes(table=table, column=column)

    @property
    def python_type(self) -> type[object]:
        return dict

    def process_bind_param(self, value: Any, dialect: Dialect) -> bytes | None:
        if value is None:
            return None
        payload = json.dumps(value, sort_keys=True, default=str).encode("utf-8")
        return self._inner.process_bind_param(payload, dialect)

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        raw = self._inner.process_result_value(value, dialect)
        if raw is None:
            return None
        return json.loads(raw.decode("utf-8"))
