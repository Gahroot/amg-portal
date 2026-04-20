"""Tests for the argon2id + lazy bcrypt migration in ``app.core.security``."""

from __future__ import annotations

import bcrypt
import pytest
from argon2 import PasswordHasher

from app.core import security


def test_hash_password_produces_argon2id() -> None:
    h = security.hash_password("CorrectHorseBatteryStaple")
    assert h.startswith("$argon2id$")


def test_argon2_correct_password_does_not_need_rehash() -> None:
    h = security.hash_password("pw-one")
    ok, needs_rehash = security.verify_password("pw-one", h)
    assert ok is True
    assert needs_rehash is False


def test_argon2_wrong_password_returns_false_false() -> None:
    h = security.hash_password("pw-one")
    ok, needs_rehash = security.verify_password("pw-two", h)
    assert ok is False
    assert needs_rehash is False


def test_legacy_bcrypt_verifies_and_flags_rehash() -> None:
    plain = "legacy-secret!"
    legacy_hash = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    ok, needs_rehash = security.verify_password(plain, legacy_hash)
    assert ok is True
    assert needs_rehash is True


def test_legacy_bcrypt_wrong_password_returns_false_false() -> None:
    legacy_hash = bcrypt.hashpw(b"legacy-secret!", bcrypt.gensalt()).decode("utf-8")
    ok, needs_rehash = security.verify_password("nope", legacy_hash)
    assert ok is False
    assert needs_rehash is False


def test_rehash_from_bcrypt_produces_argon2() -> None:
    plain = "upgrade-me"
    legacy_hash = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    ok, needs_rehash = security.verify_password(plain, legacy_hash)
    assert ok and needs_rehash

    # Mirrors the login path: after successful verify + needs_rehash, hash again.
    upgraded = security.hash_password(plain)
    assert upgraded.startswith("$argon2id$")

    ok2, needs_rehash2 = security.verify_password(plain, upgraded)
    assert ok2 is True
    assert needs_rehash2 is False


def test_bumping_memory_cost_triggers_needs_rehash(monkeypatch: pytest.MonkeyPatch) -> None:
    # Hash with the current module-level hasher.
    h = security.hash_password("param-shift")

    # Swap in a hasher with a higher memory_cost; existing hashes should now
    # report as needing a rehash.
    stronger = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=1)
    monkeypatch.setattr(security, "_ph", stronger)

    ok, needs_rehash = security.verify_password("param-shift", h)
    assert ok is True
    assert needs_rehash is True


def test_malformed_hash_does_not_raise() -> None:
    # Neither a valid argon2 nor a valid bcrypt hash — must degrade gracefully.
    ok, needs_rehash = security.verify_password("anything", "not-a-real-hash")
    assert ok is False
    assert needs_rehash is False


def test_malformed_argon2_prefix_does_not_raise() -> None:
    ok, needs_rehash = security.verify_password("anything", "$argon2id$garbage")
    assert ok is False
    assert needs_rehash is False
