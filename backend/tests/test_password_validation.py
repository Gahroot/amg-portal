"""Tests for password complexity validation.

These cases are mirrored in
``frontend/src/lib/validations/__tests__/auth.test.ts``. The backend is the
canonical source of truth — both the Pydantic validator here and the Zod
schema on the frontend must agree on every case below.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.auth import UserCreate

VALID_PASSWORDS = [
    "Abcdefg1!",
    "ZZZzzz9@",
    "Password1.",
    "Hello1\\X",
]

INVALID_PASSWORDS = [
    ("Ab1!", "too short"),
    ("Abcdefg1", "no special character"),
    ("Abcdefg!", "no digit"),
    # Backend rejects `~` as a special character. The old frontend regex
    # accepted it, which caused mismatched validation. Both sides must now
    # reject this case.
    ("Abcdefg1~", "tilde is not an accepted special char"),
]


@pytest.mark.parametrize("password", VALID_PASSWORDS)
def test_valid_passwords_accepted(password: str) -> None:
    user = UserCreate(email="user@example.com", password=password, full_name="Test")
    assert user.password == password


@pytest.mark.parametrize(("password", "reason"), INVALID_PASSWORDS)
def test_invalid_passwords_rejected(password: str, reason: str) -> None:
    with pytest.raises(ValidationError):
        UserCreate(email="user@example.com", password=password, full_name="Test")
