"""Unit + integration tests for the tamper-evident audit chain.

Covers Phase 1.12 (chain columns + linkage), 1.13 (Merkle + Ed25519 +
FreeTSA), and 1.14 (verify_day).  Concurrency test uses asyncio.gather over
the NullPool async engine exposed by the session-scope fixture in
``backend/tests/conftest.py``.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac as _hmac
import uuid
from datetime import UTC, date, datetime
from typing import Any
from unittest.mock import patch

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit_chain as ac
from app.core.audit_context import AuditContext, audit_context_var
from app.models.audit_checkpoint import AuditCheckpoint
from app.models.audit_log import AuditLog

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def _set_audit_ctx() -> Any:
    token = audit_context_var.set(
        AuditContext(
            user_id=uuid.uuid4(),
            user_email="tester@example.com",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    )
    yield
    audit_context_var.reset(token)


def _make_entry(action: str = "create", entity_type: str = "test") -> AuditLog:
    return AuditLog(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        user_email="ut@example.com",
        action=action,
        entity_type=entity_type,
        entity_id=str(uuid.uuid4()),
        before_state=None,
        after_state={"x": 1},
        ip_address="127.0.0.1",
        user_agent="ut",
    )


# ---------------------------------------------------------------------------
# Pure-function tests (no DB)
# ---------------------------------------------------------------------------


class TestCanonicalJson:
    def test_sorted_keys(self) -> None:
        e = _make_entry()
        e.created_at = datetime(2026, 4, 20, 12, 0, 0, tzinfo=UTC)
        encoded = ac._canonical_json(e)
        # Keys must be sorted — action comes before before_state alphabetically.
        text_out = encoded.decode()
        assert text_out.index('"action"') < text_out.index('"before_state"')

    def test_uuid_as_str(self) -> None:
        e = _make_entry()
        e.created_at = datetime(2026, 4, 20, 12, 0, 0, tzinfo=UTC)
        encoded = ac._canonical_json(e)
        assert str(e.id).encode() in encoded

    def test_separators_have_no_whitespace(self) -> None:
        e = _make_entry()
        e.created_at = datetime(2026, 4, 20, 12, 0, 0, tzinfo=UTC)
        encoded = ac._canonical_json(e)
        assert b", " not in encoded
        assert b": " not in encoded


class TestMerkleRoot:
    def test_empty(self) -> None:
        assert ac._merkle_root([]) == hashlib.sha256(b"").digest()

    def test_single_leaf(self) -> None:
        leaf = hashlib.sha256(b"a").digest()
        assert ac._merkle_root([leaf]) == leaf

    def test_two_leaves(self) -> None:
        a = hashlib.sha256(b"a").digest()
        b = hashlib.sha256(b"b").digest()
        expected = hashlib.sha256(a + b).digest()
        assert ac._merkle_root([a, b]) == expected

    def test_four_leaves_known_vector(self) -> None:
        a = hashlib.sha256(b"a").digest()
        b = hashlib.sha256(b"b").digest()
        c = hashlib.sha256(b"c").digest()
        d = hashlib.sha256(b"d").digest()
        ab = hashlib.sha256(a + b).digest()
        cd = hashlib.sha256(c + d).digest()
        expected = hashlib.sha256(ab + cd).digest()
        assert ac._merkle_root([a, b, c, d]) == expected

    def test_odd_duplicate_last(self) -> None:
        a = hashlib.sha256(b"a").digest()
        b = hashlib.sha256(b"b").digest()
        c = hashlib.sha256(b"c").digest()
        ab = hashlib.sha256(a + b).digest()
        cc = hashlib.sha256(c + c).digest()
        expected = hashlib.sha256(ab + cc).digest()
        assert ac._merkle_root([a, b, c]) == expected


class TestDailyHmacKey:
    def test_deterministic_across_calls(self) -> None:
        day = date(2026, 4, 20)
        assert ac._daily_hmac_key(day) == ac._daily_hmac_key(day)

    def test_different_day_different_key(self) -> None:
        d1 = ac._daily_hmac_key(date(2026, 4, 20))
        d2 = ac._daily_hmac_key(date(2026, 4, 21))
        assert d1 != d2

    def test_env_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        day = date(2026, 4, 20)
        raw = base64.urlsafe_b64encode(b"\xaa" * 32).decode()
        monkeypatch.setenv("AUDIT_HMAC_KEY_20260420", raw)
        assert ac._daily_hmac_key(day) == b"\xaa" * 32


# ---------------------------------------------------------------------------
# Chain linkage (DB-backed)
# ---------------------------------------------------------------------------


class TestChainLinkage:
    @pytest.mark.asyncio
    async def test_three_entries_chain(
        self,
        db_session: AsyncSession,
        _set_audit_ctx: None,  # noqa: ARG002
    ) -> None:
        # Insert three user rows; the after_flush listener chains each audit
        # entry it emits.  We verify the chain by reading it back.
        from app.core.security import hash_password
        from app.models.user import User

        for i in range(3):
            db_session.add(
                User(
                    id=uuid.uuid4(),
                    email=f"chain_{i}_{uuid.uuid4().hex[:6]}@test.local",
                    hashed_password=hash_password("TestPass1!"),
                    full_name=f"Chain Test {i}",
                    role="client",
                    status="active",
                )
            )
        await db_session.commit()

        result = await db_session.execute(
            select(AuditLog)
            .where(AuditLog.entity_type == "users")
            .order_by(AuditLog.created_at, AuditLog.id)
        )
        entries = list(result.scalars().all())
        assert len(entries) >= 3

        # prev_hash linkage: every entry after the first points at the
        # preceding row's row_hash.
        for i in range(1, len(entries)):
            assert entries[i].prev_hash == entries[i - 1].row_hash

        # All chain columns populated.
        for e in entries:
            assert len(bytes(e.row_hash)) == 32
            assert len(bytes(e.hmac)) == 32
            assert e.day_bucket is not None

    @pytest.mark.asyncio
    async def test_byte_tamper_detected(
        self,
        db_session: AsyncSession,
        _set_audit_ctx: None,  # noqa: ARG002
    ) -> None:
        from app.core.security import hash_password
        from app.models.user import User

        db_session.add(
            User(
                id=uuid.uuid4(),
                email=f"tamper_{uuid.uuid4().hex[:6]}@test.local",
                hashed_password=hash_password("TestPass1!"),
                full_name="Tamper Test",
                role="client",
                status="active",
            )
        )
        await db_session.commit()

        result = await db_session.execute(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(1)
        )
        entry = result.scalar_one()
        # Simulate a DB-level tamper by flipping a byte in after_state via
        # raw SQL (bypassing the ORM's ON UPDATE NOTHING rule is fine here —
        # the test DB is seeded from metadata, not the production migration
        # with the immutability rule).
        await db_session.execute(
            text("UPDATE audit_logs SET after_state = NULL WHERE id = CAST(:id AS uuid)"),
            {"id": str(entry.id)},
        )
        await db_session.commit()
        # Drop the ORM cache so the next SELECT returns the tampered row.
        await db_session.close()

        # Re-read and recompute; stored row_hash should no longer match.
        result = await db_session.execute(select(AuditLog).where(AuditLog.id == entry.id))
        tampered = result.scalar_one()
        payload = ac._canonical_json(tampered) + (
            bytes(tampered.prev_hash) if tampered.prev_hash is not None else b"\x00" * 32
        )
        recomputed = hashlib.sha256(payload).digest()
        assert recomputed != bytes(tampered.row_hash)


# ---------------------------------------------------------------------------
# Concurrency — advisory lock serialisation
# ---------------------------------------------------------------------------


class TestConcurrency:
    @pytest.mark.asyncio
    async def test_parallel_inserts_produce_consistent_chain(
        self,
        db_session: AsyncSession,  # noqa: ARG002  — pulls in the test DB fixture
    ) -> None:
        """Five concurrent audit-producing transactions must yield a coherent chain.

        With the advisory lock, all emitted audit rows end up in a single
        hash chain (each row's ``prev_hash`` is the preceding row's
        ``row_hash`` in insert order).  Without the lock, two txns would both
        read the same ``prev_hash`` and fork the chain.
        """
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from app.core.security import hash_password
        from app.models.user import User
        from tests.conftest import _make_engine

        engine = _make_engine()
        session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async def _insert_one(idx: int) -> None:
            token = audit_context_var.set(
                AuditContext(
                    user_id=uuid.uuid4(),
                    user_email=f"conc_{idx}@test.local",
                    ip_address="127.0.0.1",
                    user_agent="pytest-concurrent",
                )
            )
            try:
                async with session_factory() as s:
                    s.add(
                        User(
                            id=uuid.uuid4(),
                            email=f"conc_{idx}_{uuid.uuid4().hex[:6]}@test.local",
                            hashed_password=hash_password("TestPass1!"),
                            full_name=f"Concurrent {idx}",
                            role="client",
                            status="active",
                        )
                    )
                    await s.commit()
            finally:
                audit_context_var.reset(token)

        try:
            await asyncio.gather(*(_insert_one(i) for i in range(5)))

            async with session_factory() as s:
                result = await s.execute(
                    select(AuditLog)
                    .where(AuditLog.entity_type == "users")
                    .order_by(AuditLog.created_at, AuditLog.id)
                )
                entries = list(result.scalars().all())
            # At least 5 from our inserts (there may be more if any fixture
            # setup caused audits).  Tail of the chain must be linear.
            assert len(entries) >= 5
            for i in range(1, len(entries)):
                # Every row's prev_hash matches the preceding row's row_hash
                # — no fork, no gap.
                assert entries[i].prev_hash == entries[i - 1].row_hash, f"chain fork at index {i}"
        finally:
            await engine.dispose()


# ---------------------------------------------------------------------------
# sign_day + verify_day
# ---------------------------------------------------------------------------


async def _seed_audit_rows(db_session: AsyncSession, n: int = 3) -> date:
    """Create n audit rows with a deterministic day_bucket (today UTC)."""
    from app.core.security import hash_password
    from app.models.user import User

    token = audit_context_var.set(
        AuditContext(
            user_id=uuid.uuid4(),
            user_email="seed@test.local",
            ip_address="127.0.0.1",
            user_agent="seed",
        )
    )
    try:
        for i in range(n):
            db_session.add(
                User(
                    id=uuid.uuid4(),
                    email=f"sign_{i}_{uuid.uuid4().hex[:6]}@test.local",
                    hashed_password=hash_password("TestPass1!"),
                    full_name=f"Seed {i}",
                    role="client",
                    status="active",
                )
            )
        await db_session.commit()
    finally:
        audit_context_var.reset(token)

    result = await db_session.execute(
        select(AuditLog.day_bucket).order_by(AuditLog.created_at.desc()).limit(1)
    )
    day = result.scalar_one()
    assert isinstance(day, date)
    return day


class TestSignVerify:
    @pytest.mark.asyncio
    async def test_sign_then_verify_roundtrip(self, db_session: AsyncSession) -> None:
        day = await _seed_audit_rows(db_session, 3)

        # FreeTSA is network-gated in tests; stub it.
        with patch(
            "app.core.audit_chain._freetsa_timestamp",
            return_value=(b"stub-tsa-token", None),
        ):
            checkpoint = await ac.sign_day(day, db_session)

        assert checkpoint is not None
        assert checkpoint.day == day
        assert len(bytes(checkpoint.merkle_root)) == 32
        assert len(bytes(checkpoint.signature)) == 64
        assert bytes(checkpoint.tsa_token or b"") == b"stub-tsa-token"

        # Verify must ignore the TSA token (library would reject a stub).  We
        # patch rfc3161ng.get_timestamp to succeed so the integrity check
        # passes.
        with patch("rfc3161ng.get_timestamp", return_value=datetime.now(UTC)):
            ok, reason = await ac.verify_day(day, db_session)
        assert ok, reason

    @pytest.mark.asyncio
    async def test_sign_day_no_rows_returns_none(self, db_session: AsyncSession) -> None:
        # Far-future day with no rows → None.
        far_future = date(2099, 12, 31)
        with patch(
            "app.core.audit_chain._freetsa_timestamp",
            return_value=(None, None),
        ):
            out = await ac.sign_day(far_future, db_session)
        assert out is None

    @pytest.mark.asyncio
    async def test_verify_day_catches_tampered_checkpoint(self, db_session: AsyncSession) -> None:
        day = await _seed_audit_rows(db_session, 2)
        with patch(
            "app.core.audit_chain._freetsa_timestamp",
            return_value=(None, "stub no-network"),
        ):
            await ac.sign_day(day, db_session)

        # Corrupt the stored Merkle root.
        checkpoint = (
            await db_session.execute(select(AuditCheckpoint).where(AuditCheckpoint.day == day))
        ).scalar_one()
        checkpoint.merkle_root = b"\x00" * 32
        await db_session.commit()

        ok, reason = await ac.verify_day(day, db_session)
        assert not ok
        assert reason is not None
        assert "merkle" in reason.lower() or "signature" in reason.lower()

    @pytest.mark.asyncio
    async def test_verify_day_catches_tampered_row(self, db_session: AsyncSession) -> None:
        day = await _seed_audit_rows(db_session, 2)
        with patch(
            "app.core.audit_chain._freetsa_timestamp",
            return_value=(None, None),
        ):
            await ac.sign_day(day, db_session)

        # Flip a byte in one row's after_state.  The chain detects this at
        # the row_hash check before the Merkle comparison runs.
        first = (
            await db_session.execute(
                select(AuditLog)
                .where(AuditLog.day_bucket == day)
                .order_by(AuditLog.created_at)
                .limit(1)
            )
        ).scalar_one()
        await db_session.execute(
            text("UPDATE audit_logs SET after_state = NULL WHERE id = CAST(:id AS uuid)"),
            {"id": str(first.id)},
        )
        await db_session.commit()
        # Drop the ORM cache so verify_day reads the tampered row from DB.
        await db_session.close()

        ok, reason = await ac.verify_day(day, db_session)
        assert not ok
        assert reason is not None


# ---------------------------------------------------------------------------
# FreeTSA mock — success + failure paths
# ---------------------------------------------------------------------------


class TestFreeTsa:
    @pytest.mark.asyncio
    async def test_freetsa_success(self) -> None:
        class _StubRT:
            def __init__(self, *a: Any, **kw: Any) -> None:
                pass

            def __call__(self, data: bytes, **kw: Any) -> bytes:
                return b"stubtsr\x00\x01"

        with patch.dict(
            "sys.modules",
            {"rfc3161ng": type("M", (), {"RemoteTimestamper": _StubRT})()},
        ):
            token, err = await ac._freetsa_timestamp(b"payload")
        assert err is None
        assert token == b"stubtsr\x00\x01"

    @pytest.mark.asyncio
    async def test_freetsa_failure_returns_error(self) -> None:
        class _BrokenRT:
            def __init__(self, *a: Any, **kw: Any) -> None:
                raise RuntimeError("TSA reachable")  # simulate construction error

        with patch.dict(
            "sys.modules",
            {"rfc3161ng": type("M", (), {"RemoteTimestamper": _BrokenRT})()},
        ):
            token, err = await ac._freetsa_timestamp(b"payload")
        assert token is None
        assert err is not None
        assert "TSA" in err or "error" in err.lower()


# ---------------------------------------------------------------------------
# Sanity: finalize_chain + HMAC re-derivation align
# ---------------------------------------------------------------------------


class TestHmacAlignment:
    @pytest.mark.asyncio
    async def test_hmac_matches_recompute(
        self,
        db_session: AsyncSession,
        _set_audit_ctx: None,  # noqa: ARG002
    ) -> None:
        from app.core.security import hash_password
        from app.models.user import User

        db_session.add(
            User(
                id=uuid.uuid4(),
                email=f"hmac_{uuid.uuid4().hex[:6]}@test.local",
                hashed_password=hash_password("TestPass1!"),
                full_name="HMAC Test",
                role="client",
                status="active",
            )
        )
        await db_session.commit()

        entry = (
            await db_session.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(1))
        ).scalar_one()
        key = ac._daily_hmac_key(entry.day_bucket)
        expected = _hmac.new(key, bytes(entry.row_hash), hashlib.sha256).digest()
        assert bytes(entry.hmac) == expected
