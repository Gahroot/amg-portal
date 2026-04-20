"""User calendar OAuth token encryption round-trip tests.

Phase 1.3 of the security plan. Covers ``User.google_calendar_token`` and
``User.outlook_calendar_token`` — both use ``EncryptedJSON`` which composes
``EncryptedBytes`` + JSON (de)serialisation.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User


@pytest.mark.asyncio
async def test_google_token_round_trips_as_dict(db_session: AsyncSession) -> None:
    token = {
        "access_token": "ya29.a0FAKE",
        "refresh_token": "1//0FAKE",
        "expires_at": 1766016000,
        "token_type": "Bearer",
    }
    user = User(
        id=uuid.uuid4(),
        email=f"cal_{uuid.uuid4().hex[:6]}@test.local",
        hashed_password=hash_password("Pass1!"),
        full_name="Calendar Tester",
        role=UserRole.relationship_manager,
        status="active",
        google_calendar_token=token,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    assert user.google_calendar_token == token


@pytest.mark.asyncio
async def test_outlook_token_round_trips_as_dict(db_session: AsyncSession) -> None:
    token = {
        "access_token": "eyFAKE",
        "refresh_token": "M.R3FAKE",
        "expires_at": 1766016000,
        "token_type": "Bearer",
    }
    user = User(
        id=uuid.uuid4(),
        email=f"cal_{uuid.uuid4().hex[:6]}@test.local",
        hashed_password=hash_password("Pass1!"),
        full_name="Outlook Tester",
        role=UserRole.relationship_manager,
        status="active",
        outlook_calendar_token=token,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    assert user.outlook_calendar_token == token


@pytest.mark.asyncio
async def test_raw_storage_is_binary_ciphertext(db_session: AsyncSession) -> None:
    token = {"access_token": "SUPER-SECRET-XYZ123", "refresh_token": "r/123"}
    user = User(
        id=uuid.uuid4(),
        email=f"raw_{uuid.uuid4().hex[:6]}@test.local",
        hashed_password=hash_password("Pass1!"),
        full_name="Raw Tester",
        role=UserRole.relationship_manager,
        status="active",
        google_calendar_token=token,
    )
    db_session.add(user)
    await db_session.commit()

    row = (
        await db_session.execute(
            text("SELECT google_calendar_token FROM users WHERE id = :id"),
            {"id": user.id},
        )
    ).first()
    assert row is not None
    raw = bytes(row[0])
    # Version byte + key_id byte
    assert raw[0] == 0x01
    assert raw[1] >= 1
    # No plaintext substring present
    assert b"SUPER-SECRET-XYZ123" not in raw


@pytest.mark.asyncio
async def test_null_token_stays_null(db_session: AsyncSession) -> None:
    user = User(
        id=uuid.uuid4(),
        email=f"nul_{uuid.uuid4().hex[:6]}@test.local",
        hashed_password=hash_password("Pass1!"),
        full_name="Null Tester",
        role=UserRole.relationship_manager,
        status="active",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    assert user.google_calendar_token is None
    assert user.outlook_calendar_token is None

    row = (
        await db_session.execute(
            text(
                "SELECT google_calendar_token, outlook_calendar_token "
                "FROM users WHERE id = :id"
            ),
            {"id": user.id},
        )
    ).first()
    assert row is not None
    assert row[0] is None
    assert row[1] is None
