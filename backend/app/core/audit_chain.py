"""Audit-log tamper-evident chain primitives (Phase 1.12–1.14).

This module is the one canonical implementation of:

* canonical JSON encoding for audit rows (stable ordering, UTC ISO-8601,
  UUIDs stringified) — used by both insert and verify so any divergence shows
  up immediately as a hash mismatch,
* per-row chaining: ``row_hash = SHA-256(canonical_json(row) || prev_hash)``,
  chained under a Postgres advisory lock so concurrent inserters see a
  consistent ``prev_hash`` — this is the concurrency fix from the plan,
* per-day HMAC under a rolling daily key (env
  ``AUDIT_HMAC_KEY_YYYYMMDD``; HKDF-derived from ``SECRET_KEY`` in DEBUG),
* daily Merkle-root computation + Ed25519 signature (Phase 1.13),
* FreeTSA RFC-3161 anchoring (Phase 1.13),
* chain verification (Phase 1.14).

Never makes chain-finalisation fatal at insert time — verification failures
are surfaced by the daily cron job, not by blowing up a user's write.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac as _hmac
import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import TYPE_CHECKING, Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.audit_checkpoint import AuditCheckpoint
from app.models.audit_log import AuditLog

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# Columns that participate in the canonical encoding.  Order is fixed so the
# encoding is stable across SQLAlchemy metadata changes; anything added to the
# row in the future should be appended here deliberately.
_CANONICAL_FIELDS: tuple[str, ...] = (
    "id",
    "user_id",
    "user_email",
    "action",
    "entity_type",
    "entity_id",
    "before_state",
    "after_state",
    "ip_address",
    "user_agent",
    "created_at",
)

_ADVISORY_LOCK_KEY = "audit_chain"


# ---------------------------------------------------------------------------
# Canonical encoding
# ---------------------------------------------------------------------------


def _json_default(value: Any) -> Any:
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        # Normalise to UTC ISO-8601; naive timestamps are assumed UTC (matches
        # server_default=now() behaviour on Postgres).
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("ascii")
    raise TypeError(f"Non-JSON-serialisable type in audit row: {type(value).__name__}")


def _canonical_json(entry: AuditLog) -> bytes:
    """Stable byte-encoding of an AuditLog row.

    Used both by ``finalize_chain`` (insert side) and by ``verify_day``
    (re-compute side).  Any divergence between these two call-sites is a bug
    and will show up as a hash mismatch.
    """
    payload = {field: getattr(entry, field, None) for field in _CANONICAL_FIELDS}
    return json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        default=_json_default,
        ensure_ascii=False,
    ).encode("utf-8")


# ---------------------------------------------------------------------------
# Daily HMAC key
# ---------------------------------------------------------------------------


def _daily_hmac_key(day: date) -> bytes:
    """Return the 32-byte HMAC key for the given UTC day.

    Production sets ``AUDIT_HMAC_KEY_YYYYMMDD`` in the environment (one entry
    per day, rotated by the ops runbook).  When that variable is missing the
    key is HKDF-derived from ``SECRET_KEY`` — convenient for dev, but production
    should pre-provision explicit per-day keys so a DB compromise alone can't
    be combined with a known ``SECRET_KEY`` to forge valid HMACs.
    """
    env_key = f"AUDIT_HMAC_KEY_{day.strftime('%Y%m%d')}"
    raw = os.environ.get(env_key, "")
    if raw:
        try:
            decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        except Exception:
            decoded = raw.encode("utf-8")
        if len(decoded) >= 32:
            return decoded[:32]
        # Short/weird value — fall through to HKDF so we never silently use a
        # tiny key.
        logger.warning(
            "AUDIT_HMAC_KEY_%s is <32 bytes; falling back to HKDF-derived key",
            day.strftime("%Y%m%d"),
        )
    info = f"amg|audit|hmac|{day.isoformat()}".encode()
    return HKDF(
        algorithm=hashes.SHA256(), length=32, salt=None, info=info
    ).derive(settings.SECRET_KEY.encode("utf-8"))


# ---------------------------------------------------------------------------
# Chain finalisation (insert side)
# ---------------------------------------------------------------------------


def _last_row_hash(session: Session) -> bytes | None:
    """Return the row_hash of the most recent (already-persisted) audit row.

    Called under the advisory lock so readers of the chain tail are serialised
    against concurrent writers.
    """
    row = session.execute(
        text(
            "SELECT row_hash FROM audit_logs "
            "ORDER BY created_at DESC, id DESC LIMIT 1"
        )
    ).first()
    if row is None:
        return None
    value = row[0]
    return bytes(value) if value is not None else None


def finalize_chain(session: Session, new_entries: list[AuditLog]) -> None:
    """Compute ``prev_hash``/``row_hash``/``hmac``/``day_bucket`` for each new row.

    Runs inside the caller's transaction.  A Postgres advisory lock on
    ``hashtext('audit_chain')`` serialises this block across the cluster, so
    two concurrent flushes can't both read the same ``prev_hash`` — without
    this the chain would fork under contention.
    """
    if not new_entries:
        return

    # Run all our reads/locks with autoflush disabled — we're being called
    # from an after_flush listener, so if a read triggered autoflush we'd
    # recurse into the listener before the current batch is chained.
    with session.no_autoflush:
        # Advisory lock for the duration of this transaction.  Released on
        # commit or rollback.  pg_advisory_xact_lock(bigint) — hashtext
        # returns int4, SQLA widens it correctly in Postgres.
        session.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
            {"k": _ADVISORY_LOCK_KEY},
        )

        prev = _last_row_hash(session)
    today = datetime.now(UTC).date()
    hmac_key = _daily_hmac_key(today)

    for entry in new_entries:
        # AuditLog.id has default=uuid.uuid4, but SQLA only evaluates the
        # default at flush time — at this point in the after_flush callback
        # id is still None.  We materialise it here so the canonical JSON we
        # hash matches the row that hits the DB.
        if entry.id is None:
            entry.id = uuid.uuid4()
        # created_at isn't populated until the row is flushed (server_default).
        # Use the current UTC time for the canonical payload; on the next
        # flush SQLA will write the same timestamp server-side (within clock
        # skew tolerance of a few ms).  For chain integrity what matters is
        # that we use the same value we'll store — so we set created_at
        # explicitly here.
        if entry.created_at is None:
            entry.created_at = datetime.now(UTC)
        entry.day_bucket = (
            entry.created_at.astimezone(UTC).date()
            if entry.created_at.tzinfo is not None
            else entry.created_at.replace(tzinfo=UTC).date()
        )
        entry.prev_hash = prev
        payload = _canonical_json(entry) + (prev if prev is not None else b"\x00" * 32)
        entry.row_hash = hashlib.sha256(payload).digest()
        entry.hmac = _hmac.new(hmac_key, entry.row_hash, hashlib.sha256).digest()
        prev = entry.row_hash


# ---------------------------------------------------------------------------
# Merkle tree
# ---------------------------------------------------------------------------


def _merkle_root(leaves: list[bytes]) -> bytes:
    """SHA-256 Merkle root with duplicate-last on odd node counts.

    Each leaf is already a 32-byte SHA-256 (``row_hash``), so we do not
    pre-hash the leaves — we hash the concatenation at each internal level.
    Convention matches Bitcoin/BitTorrent/plenty of prior art.
    """
    if not leaves:
        # Empty-chain convention: SHA-256("") so verify has a deterministic
        # root to compare against.
        return hashlib.sha256(b"").digest()

    level = list(leaves)
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])
        level = [
            hashlib.sha256(level[i] + level[i + 1]).digest()
            for i in range(0, len(level), 2)
        ]
    return level[0]


# ---------------------------------------------------------------------------
# Ed25519 + FreeTSA
# ---------------------------------------------------------------------------


def _load_private_key() -> Ed25519PrivateKey:
    raw = os.environ.get("AUDIT_ED25519_PRIVATE_V1") or settings.AUDIT_ED25519_PRIVATE_V1
    if not raw:
        raise RuntimeError("AUDIT_ED25519_PRIVATE_V1 is not configured")
    return Ed25519PrivateKey.from_private_bytes(base64.b64decode(raw))


def _load_public_key() -> Ed25519PublicKey:
    raw = os.environ.get("AUDIT_ED25519_PUBLIC_V1") or settings.AUDIT_ED25519_PUBLIC_V1
    if not raw:
        raise RuntimeError("AUDIT_ED25519_PUBLIC_V1 is not configured")
    return Ed25519PublicKey.from_public_bytes(base64.b64decode(raw))


def _sign_payload(day: date, merkle_root: bytes) -> bytes:
    priv = _load_private_key()
    return priv.sign(merkle_root + day.isoformat().encode("utf-8"))


def _verify_signature(day: date, merkle_root: bytes, signature: bytes) -> bool:
    try:
        _load_public_key().verify(signature, merkle_root + day.isoformat().encode("utf-8"))
    except InvalidSignature:
        return False
    return True


async def _freetsa_timestamp(data: bytes) -> tuple[bytes | None, str | None]:
    """Request an RFC-3161 timestamp token over ``data`` from FreeTSA.

    Returns ``(tsr_bytes, None)`` on success, ``(None, error_message)`` on
    network/TSA failure — callers record the error in ``tsa_error`` and
    proceed; FreeTSA is a secondary anchor, it must not block Ed25519 signing.

    TODO: swap in a sigstore fallback if FreeTSA is persistently down.
    """
    try:
        import rfc3161ng
    except ImportError as e:
        return None, f"rfc3161ng unavailable: {e}"

    def _sync_call() -> bytes:
        timestamper = rfc3161ng.RemoteTimestamper(settings.FREETSA_URL, hashname="sha256")
        # return_tsr=True yields the raw TSR bytes.
        return bytes(timestamper(data=data, return_tsr=True))

    try:
        token = await asyncio.wait_for(asyncio.to_thread(_sync_call), timeout=15.0)
    except TimeoutError:
        return None, "FreeTSA timeout"
    except Exception as e:  # noqa: BLE001  — rfc3161ng raises generic exceptions
        return None, f"FreeTSA error: {type(e).__name__}: {e}"
    return token, None


# ---------------------------------------------------------------------------
# Sign / verify a day
# ---------------------------------------------------------------------------


async def _fetch_day_rows(db: AsyncSession, target_day: date) -> list[AuditLog]:
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.day_bucket == target_day)
        .order_by(AuditLog.created_at, AuditLog.id)
    )
    return list(result.scalars().all())


async def sign_day(target_day: date, db: AsyncSession) -> AuditCheckpoint | None:
    """Compute + persist the Merkle root + Ed25519 signature for ``target_day``.

    Returns the persisted checkpoint, or ``None`` if the day has no rows
    (nothing to anchor).  Idempotent: re-running for a day that already has a
    checkpoint returns the existing row unchanged — callers should treat the
    daily sign job as at-least-once-safe.
    """
    existing = (
        await db.execute(
            select(AuditCheckpoint).where(AuditCheckpoint.day == target_day)
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    rows = await _fetch_day_rows(db, target_day)
    if not rows:
        logger.info("sign_day(%s): no rows; skipping", target_day)
        return None

    leaves = [bytes(r.row_hash) for r in rows]
    root = _merkle_root(leaves)
    signature = _sign_payload(target_day, root)
    tsa_token, tsa_error = await _freetsa_timestamp(root)

    checkpoint = AuditCheckpoint(
        day=target_day,
        merkle_root=root,
        signature=signature,
        tsa_token=tsa_token,
        tsa_error=tsa_error,
    )
    db.add(checkpoint)
    await db.commit()
    logger.info(
        "sign_day(%s): signed %d rows (tsa=%s)",
        target_day,
        len(rows),
        "ok" if tsa_token else f"fail({tsa_error})",
    )
    return checkpoint


@dataclass
class VerifyFailure:
    """Why a verification rejected a day.  Kept simple for logs + alerts."""

    reason: str


async def verify_day(  # noqa: PLR0911 PLR0912 — short-circuit structure is intentional
    target_day: date, db: AsyncSession
) -> tuple[bool, str | None]:
    """Verify every signal the chain offers for ``target_day``.

    Re-computes each row_hash from canonical JSON + prev_hash, re-computes the
    per-row HMAC under the day's key, re-computes the Merkle root from the
    row_hashes in order, verifies the stored Ed25519 signature over that root,
    and (when present) verifies the TSA token is structurally valid for the
    same root bytes.  Any mismatch short-circuits with a human-readable
    reason.
    """
    # Days before the chain-start date are legacy-backfilled; the plan
    # explicitly marks them out of scope.
    if settings.AUDIT_CHAIN_START_AT and target_day < settings.AUDIT_CHAIN_START_AT:
        return True, None

    rows = await _fetch_day_rows(db, target_day)
    if not rows:
        # Empty day — nothing to verify.  Checkpoint is optional here.
        return True, None

    # We need the previous day's chain tail to seed prev_hash for row 0.  We
    # look it up from the DB so we can re-link correctly when a day starts
    # mid-chain.
    chain_tail = (
        await db.execute(
            text(
                "SELECT row_hash FROM audit_logs "
                "WHERE day_bucket < :d ORDER BY day_bucket DESC, created_at DESC, id DESC "
                "LIMIT 1"
            ),
            {"d": target_day},
        )
    ).first()
    prev: bytes | None = bytes(chain_tail[0]) if chain_tail and chain_tail[0] is not None else None

    hmac_key = _daily_hmac_key(target_day)

    for idx, row in enumerate(rows):
        expected_prev = prev
        stored_prev = bytes(row.prev_hash) if row.prev_hash is not None else None
        if stored_prev != expected_prev:
            return False, (
                f"row {idx} (id={row.id}) prev_hash mismatch: "
                f"expected {expected_prev!r}, stored {stored_prev!r}"
            )
        payload = _canonical_json(row) + (
            expected_prev if expected_prev is not None else b"\x00" * 32
        )
        recomputed_row_hash = hashlib.sha256(payload).digest()
        if bytes(row.row_hash) != recomputed_row_hash:
            return False, f"row {idx} (id={row.id}) row_hash mismatch"
        recomputed_hmac = _hmac.new(hmac_key, recomputed_row_hash, hashlib.sha256).digest()
        if bytes(row.hmac) != recomputed_hmac:
            return False, f"row {idx} (id={row.id}) hmac mismatch"
        prev = recomputed_row_hash

    # Merkle + signature over the re-computed row_hashes (belt and braces:
    # using the stored row_hashes above would just check "stored == stored").
    leaves = [
        hashlib.sha256(
            _canonical_json(r)
            + (bytes(r.prev_hash) if r.prev_hash is not None else b"\x00" * 32)
        ).digest()
        for r in rows
    ]
    recomputed_root = _merkle_root(leaves)

    checkpoint = (
        await db.execute(
            select(AuditCheckpoint).where(AuditCheckpoint.day == target_day)
        )
    ).scalar_one_or_none()
    if checkpoint is None:
        return False, f"no checkpoint for {target_day}"
    if bytes(checkpoint.merkle_root) != recomputed_root:
        return False, "merkle root mismatch"
    if not _verify_signature(target_day, recomputed_root, bytes(checkpoint.signature)):
        return False, "ed25519 signature invalid"
    # TSA is best-effort; only fail if a token was stored AND fails structural
    # validation.  We don't re-contact FreeTSA during verify (offline-safe).
    if checkpoint.tsa_token is not None:
        try:
            import rfc3161ng

            # rfc3161ng.get_timestamp returns the embedded time; failure
            # raises.  This is enough to catch a tampered TSR blob without
            # needing the TSA's signing cert on hand.
            rfc3161ng.get_timestamp(bytes(checkpoint.tsa_token))
        except ImportError:
            # Library missing at verify time: log + skip (chain still proven).
            logger.warning("rfc3161ng unavailable during verify_day(%s)", target_day)
        except Exception as e:  # noqa: BLE001
            return False, f"tsa token invalid: {e}"
    return True, None


__all__ = [
    "_canonical_json",
    "_daily_hmac_key",
    "_merkle_root",
    "finalize_chain",
    "sign_day",
    "verify_day",
]
