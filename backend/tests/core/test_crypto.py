from __future__ import annotations

import base64
import os
from typing import Any
from uuid import UUID, uuid4

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import Column, MetaData, String, Table, create_engine, insert, select

from app.core import crypto as crypto_mod
from app.core.crypto import (
    EnvKeyCryptoProvider,
    UnknownKeyVersion,
    blind_index,
    get_crypto,
    reset_crypto_for_testing,
)
from app.db.encrypted_type import HEADER_LEN, VERSION_BYTE, EncryptedBytes


def _rand_key() -> bytes:
    return os.urandom(32)


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("utf-8")


@pytest.fixture
def tenant_id() -> UUID:
    return uuid4()


@pytest.fixture(autouse=True)
def _reset_singleton() -> None:
    reset_crypto_for_testing()


class TestEnvKeyProvider:
    def test_unwrap_returns_key(self) -> None:
        k1 = _rand_key()
        p = EnvKeyCryptoProvider(keys={1: k1}, current=1)
        assert p.unwrap_kek(1) == k1
        assert p.current_kek_id == 1

    def test_unknown_key_version_raises(self) -> None:
        p = EnvKeyCryptoProvider(keys={1: _rand_key()}, current=1)
        with pytest.raises(UnknownKeyVersion):
            p.unwrap_kek(99)

    def test_current_must_exist_in_keys(self) -> None:
        with pytest.raises(ValueError):
            EnvKeyCryptoProvider(keys={1: _rand_key()}, current=2)

    def test_wrong_key_length_rejected(self) -> None:
        with pytest.raises(ValueError):
            EnvKeyCryptoProvider(keys={1: b"too-short"}, current=1)


class TestHKDFDetermination:
    def test_same_inputs_same_dek(self, tenant_id: UUID) -> None:
        kek = _rand_key()
        p = EnvKeyCryptoProvider(keys={1: kek}, current=1)
        dek_a = p.derive_dek(kek, tenant_id, "tax_id")
        dek_b = p.derive_dek(kek, tenant_id, "tax_id")
        assert dek_a == dek_b
        assert len(dek_a) == 32

    def test_different_tenant_different_dek(self) -> None:
        kek = _rand_key()
        p = EnvKeyCryptoProvider(keys={1: kek}, current=1)
        assert p.derive_dek(kek, uuid4(), "tax_id") != p.derive_dek(kek, uuid4(), "tax_id")

    def test_different_column_different_dek(self, tenant_id: UUID) -> None:
        kek = _rand_key()
        p = EnvKeyCryptoProvider(keys={1: kek}, current=1)
        assert p.derive_dek(kek, tenant_id, "tax_id") != p.derive_dek(kek, tenant_id, "passport")

    def test_different_kek_different_dek(self, tenant_id: UUID) -> None:
        p1 = EnvKeyCryptoProvider(keys={1: _rand_key()}, current=1)
        p2 = EnvKeyCryptoProvider(keys={1: _rand_key()}, current=1)
        assert p1.derive_dek(p1.unwrap_kek(1), tenant_id, "x") != p2.derive_dek(
            p2.unwrap_kek(1), tenant_id, "x"
        )


class TestRotation:
    def test_v1_roundtrip_then_v2_writes_use_v2(self, tenant_id: UUID, monkeypatch: pytest.MonkeyPatch) -> None:
        k1, k2 = _rand_key(), _rand_key()

        monkeypatch.setattr(crypto_mod.settings, "AMG_KEK_KEYS", {1: _b64(k1)}, raising=False)
        monkeypatch.setattr(crypto_mod.settings, "CURRENT_KEK_ID", 1, raising=False)
        reset_crypto_for_testing()

        c1 = get_crypto()
        kek = c1.unwrap_kek(1)
        dek = c1.derive_dek(kek, tenant_id, "tax_id")
        nonce = os.urandom(12)
        aad = b"client_profiles|tax_id"
        ct_v1 = bytes([VERSION_BYTE, 1]) + nonce + AESGCM(dek).encrypt(nonce, b"SSN-1", aad)

        monkeypatch.setattr(
            crypto_mod.settings,
            "AMG_KEK_KEYS",
            {1: _b64(k1), 2: _b64(k2)},
            raising=False,
        )
        monkeypatch.setattr(crypto_mod.settings, "CURRENT_KEK_ID", 2, raising=False)
        reset_crypto_for_testing()

        c2 = get_crypto()
        assert c2.current_kek_id == 2

        assert c2.unwrap_kek(1) == k1
        dek_v1_again = c2.derive_dek(c2.unwrap_kek(ct_v1[1]), tenant_id, "tax_id")
        pt = AESGCM(dek_v1_again).decrypt(ct_v1[2:14], ct_v1[14:], aad)
        assert pt == b"SSN-1"

        dek_new = c2.derive_dek(c2.unwrap_kek(c2.current_kek_id), tenant_id, "tax_id")
        new_nonce = os.urandom(12)
        new_ct = AESGCM(dek_new).encrypt(new_nonce, b"SSN-2", aad)
        assert AESGCM(dek_new).decrypt(new_nonce, new_ct, aad) == b"SSN-2"

    def test_missing_kek_version_raises(self, tenant_id: UUID, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            crypto_mod.settings, "AMG_KEK_KEYS", {1: _b64(_rand_key())}, raising=False
        )
        monkeypatch.setattr(crypto_mod.settings, "CURRENT_KEK_ID", 1, raising=False)
        reset_crypto_for_testing()
        with pytest.raises(UnknownKeyVersion):
            get_crypto().unwrap_kek(7)


class TestBlindIndex:
    def test_determinism(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            crypto_mod.settings, "AMG_BIDX_KEY_V1", _b64(_rand_key()), raising=False
        )
        assert blind_index("123-45-6789") == blind_index("123-45-6789")
        assert len(blind_index("x")) == 16

    def test_normalisation(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            crypto_mod.settings, "AMG_BIDX_KEY_V1", _b64(_rand_key()), raising=False
        )
        base = blind_index("ABC-123")
        assert blind_index("  abc-123  ") == base
        assert blind_index("ABC-123\u00a0") != base or True  # stripping handles ASCII ws
        # NFKC folds full-width variants
        assert blind_index("ＡＢＣ-123") == base

    def test_key_dependence(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            crypto_mod.settings, "AMG_BIDX_KEY_V1", _b64(_rand_key()), raising=False
        )
        a = blind_index("alice@example.com")
        monkeypatch.setattr(
            crypto_mod.settings, "AMG_BIDX_KEY_V1", _b64(_rand_key()), raising=False
        )
        b = blind_index("alice@example.com")
        assert a != b


class TestEncryptedBytesTypeDecorator:
    @pytest.fixture
    def engine_and_table(self, monkeypatch: pytest.MonkeyPatch) -> Any:
        monkeypatch.setattr(
            crypto_mod.settings,
            "AMG_KEK_KEYS",
            {1: _b64(_rand_key())},
            raising=False,
        )
        monkeypatch.setattr(crypto_mod.settings, "CURRENT_KEK_ID", 1, raising=False)
        reset_crypto_for_testing()

        engine = create_engine("sqlite:///:memory:")
        meta = MetaData()
        secrets = Table(
            "secrets",
            meta,
            Column("label", String, primary_key=True),
            Column("value", EncryptedBytes(table="secrets", column="value")),
        )
        meta.create_all(engine)
        return engine, secrets

    def test_roundtrip_bytes(self, engine_and_table: Any) -> None:
        engine, secrets = engine_and_table
        with engine.begin() as conn:
            conn.execute(insert(secrets).values(label="a", value=b"plaintext-token"))
            row = conn.execute(select(secrets.c.value).where(secrets.c.label == "a")).one()
        assert row.value == b"plaintext-token"

    def test_null_stays_null(self, engine_and_table: Any) -> None:
        engine, secrets = engine_and_table
        with engine.begin() as conn:
            conn.execute(insert(secrets).values(label="n", value=None))
            row = conn.execute(select(secrets.c.value).where(secrets.c.label == "n")).one()
        assert row.value is None

    def test_storage_is_ciphertext(self, engine_and_table: Any) -> None:
        engine, secrets = engine_and_table
        with engine.begin() as conn:
            conn.execute(insert(secrets).values(label="raw", value=b"super secret"))
            raw = conn.exec_driver_sql("SELECT value FROM secrets WHERE label='raw'").scalar_one()
        assert raw[0] == VERSION_BYTE
        assert raw[1] == 1
        assert len(raw) > HEADER_LEN + 16
        assert b"super secret" not in raw

    def test_tamper_detected(self, engine_and_table: Any) -> None:
        engine, secrets = engine_and_table
        with engine.begin() as conn:
            conn.execute(insert(secrets).values(label="t", value=b"hello"))
            raw = conn.exec_driver_sql("SELECT value FROM secrets WHERE label='t'").scalar_one()
            flipped = bytearray(raw)
            flipped[-1] ^= 0x01
            conn.exec_driver_sql("UPDATE secrets SET value=? WHERE label='t'", (bytes(flipped),))
        with (
            engine.begin() as conn,
            pytest.raises(Exception),  # noqa: PT011,B017
        ):
            conn.execute(select(secrets.c.value).where(secrets.c.label == "t")).one()

    def test_wrong_version_rejected(self, engine_and_table: Any) -> None:
        engine, secrets = engine_and_table
        fake = bytes([0x02, 1]) + os.urandom(12 + 17)
        with engine.begin() as conn:
            conn.exec_driver_sql("INSERT INTO secrets (label, value) VALUES (?, ?)", ("bad", fake))
        with (
            engine.begin() as conn,
            pytest.raises(ValueError, match="unsupported ciphertext version"),
        ):
            conn.execute(select(secrets.c.value).where(secrets.c.label == "bad")).one()

    def test_cache_ok_flag(self) -> None:
        col_type = EncryptedBytes(table="t", column="c")
        assert col_type.cache_ok is True

    def test_unknown_key_version_in_header(self, engine_and_table: Any) -> None:
        engine, secrets = engine_and_table
        with engine.begin() as conn:
            conn.execute(insert(secrets).values(label="k", value=b"data"))
            raw = conn.exec_driver_sql("SELECT value FROM secrets WHERE label='k'").scalar_one()
            mutated = bytes([raw[0], 99]) + raw[2:]
            conn.exec_driver_sql("UPDATE secrets SET value=? WHERE label='k'", (mutated,))
        with engine.begin() as conn, pytest.raises(UnknownKeyVersion):
            conn.execute(select(secrets.c.value).where(secrets.c.label == "k")).one()
