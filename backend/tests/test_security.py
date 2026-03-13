"""Tests for core security module — JWT tokens and password hashing."""

import uuid

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_password_returns_bcrypt_hash(self) -> None:
        hashed = hash_password("MyPassword123!")
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
        assert hashed != "MyPassword123!"

    def test_verify_correct_password(self) -> None:
        hashed = hash_password("CorrectPass1!")
        assert verify_password("CorrectPass1!", hashed) is True

    def test_verify_wrong_password(self) -> None:
        hashed = hash_password("CorrectPass1!")
        assert verify_password("WrongPass1!", hashed) is False

    def test_different_hashes_for_same_password(self) -> None:
        h1 = hash_password("Same1!")
        h2 = hash_password("Same1!")
        assert h1 != h2  # bcrypt uses random salt

    def test_empty_password_hashes(self) -> None:
        hashed = hash_password("")
        assert verify_password("", hashed) is True


class TestAccessToken:
    def test_create_and_decode_access_token(self) -> None:
        user_id = str(uuid.uuid4())
        token = create_access_token({"sub": user_id, "email": "test@example.com"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == user_id
        assert payload["email"] == "test@example.com"
        assert payload["type"] == "access"

    def test_access_token_has_expiry(self) -> None:
        token = create_access_token({"sub": "123"})
        payload = decode_access_token(token)
        assert payload is not None
        assert "exp" in payload

    def test_decode_invalid_token_returns_none(self) -> None:
        assert decode_access_token("invalid.token.here") is None

    def test_decode_empty_token_returns_none(self) -> None:
        assert decode_access_token("") is None

    def test_access_token_rejects_refresh_token(self) -> None:
        token = create_refresh_token({"sub": "123"})
        assert decode_access_token(token) is None


class TestRefreshToken:
    def test_create_and_decode_refresh_token(self) -> None:
        user_id = str(uuid.uuid4())
        token = create_refresh_token({"sub": user_id})
        payload = decode_refresh_token(token)
        assert payload is not None
        assert payload["sub"] == user_id
        assert payload["type"] == "refresh"

    def test_refresh_token_rejects_access_token(self) -> None:
        token = create_access_token({"sub": "123"})
        assert decode_refresh_token(token) is None

    def test_decode_invalid_refresh_returns_none(self) -> None:
        assert decode_refresh_token("bad.token") is None


class TestTokenDataIntegrity:
    def test_extra_data_preserved(self) -> None:
        data = {"sub": "user-1", "email": "x@y.com", "custom": "value"}
        token = create_access_token(data)
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["custom"] == "value"

    def test_original_data_not_mutated(self) -> None:
        data = {"sub": "user-1"}
        create_access_token(data)
        assert "exp" not in data
        assert "type" not in data
