"""Client-profile PII encryption round-trip + blind-index tests.

Phase 1.4 / 1.5 of the security plan. Exercises the ORM integration end-to-end:
write a ``str`` tax_id → it persists as AES-GCM ciphertext, selects back as the
same ``str``, and the blind-index sidecar supports equality lookups that are
normalisation-stable.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import blind_index
from app.models.client_profile import ClientProfile
from app.models.user import User


@pytest.mark.asyncio
async def test_tax_id_round_trips_as_str(db_session: AsyncSession, rm_user: User) -> None:
    """Writing a str sets tax_id_enc + tax_id_bidx; reading gives the original str."""
    profile = ClientProfile(
        id=uuid.uuid4(),
        legal_name="Round Trip Ltd",
        primary_email="roundtrip@example.com",
        compliance_status="pending_review",
        approval_status="draft",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
    )
    profile.tax_id = "123-45-6789"
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(profile)

    assert profile.tax_id == "123-45-6789"
    assert profile.tax_id_enc is not None
    assert profile.tax_id_bidx is not None
    assert len(profile.tax_id_bidx) == 16


@pytest.mark.asyncio
async def test_raw_storage_is_ciphertext_not_plaintext(
    db_session: AsyncSession, rm_user: User
) -> None:
    """Raw SELECT exposes the BYTEA header + GCM tag, never the plaintext string."""
    profile = ClientProfile(
        id=uuid.uuid4(),
        legal_name="Raw Storage Co",
        primary_email="raw@example.com",
        compliance_status="pending_review",
        approval_status="draft",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
    )
    profile.tax_id = "AB-9988-XYZ"
    db_session.add(profile)
    await db_session.commit()

    row = (
        await db_session.execute(
            text("SELECT tax_id FROM client_profiles WHERE id = :id"),
            {"id": profile.id},
        )
    ).first()
    assert row is not None
    raw = bytes(row[0])
    # Header byte 0 = version 0x01, byte 1 = kek id (>=1)
    assert raw[0] == 0x01
    assert raw[1] >= 1
    # Plaintext must not appear anywhere in the on-disk blob
    assert b"AB-9988-XYZ" not in raw
    assert len(raw) > 14 + 16  # header + nonce + at least 1 byte CT + 16-byte tag


@pytest.mark.asyncio
async def test_blind_index_equality_lookup(db_session: AsyncSession, rm_user: User) -> None:
    """bidx lookup finds the exact row, not a prefix / wrong-case row."""
    p1 = ClientProfile(
        id=uuid.uuid4(),
        legal_name="Bidx Alpha",
        primary_email="bidxa@example.com",
        compliance_status="pending_review",
        approval_status="draft",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
    )
    p1.tax_id = "111-11-1111"
    p2 = ClientProfile(
        id=uuid.uuid4(),
        legal_name="Bidx Beta",
        primary_email="bidxb@example.com",
        compliance_status="pending_review",
        approval_status="draft",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
    )
    p2.tax_id = "222-22-2222"
    db_session.add_all([p1, p2])
    await db_session.commit()

    # Exact match
    hit = (
        await db_session.execute(
            select(ClientProfile).where(ClientProfile.tax_id_bidx == blind_index("111-11-1111"))
        )
    ).scalar_one()
    assert hit.id == p1.id

    # Prefix does NOT leak — blind index is equality-only
    miss = (
        await db_session.execute(
            select(ClientProfile).where(ClientProfile.tax_id_bidx == blind_index("111-11"))
        )
    ).scalar_one_or_none()
    assert miss is None


@pytest.mark.asyncio
async def test_different_tax_id_different_bidx(db_session: AsyncSession, rm_user: User) -> None:
    p1 = ClientProfile(
        id=uuid.uuid4(),
        legal_name="Diff A",
        primary_email="da@example.com",
        compliance_status="pending_review",
        approval_status="draft",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
    )
    p1.tax_id = "AAA-111"
    p2 = ClientProfile(
        id=uuid.uuid4(),
        legal_name="Diff B",
        primary_email="db@example.com",
        compliance_status="pending_review",
        approval_status="draft",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
    )
    p2.tax_id = "BBB-222"
    db_session.add_all([p1, p2])
    await db_session.commit()

    assert p1.tax_id_bidx != p2.tax_id_bidx


@pytest.mark.asyncio
async def test_normalisation_same_bidx_for_whitespace_and_case(
    db_session: AsyncSession, rm_user: User
) -> None:
    """NFKC + strip + lower means ``" 123-45-6789 "`` and ``"123-45-6789"``
    produce the same blind index.
    """
    p = ClientProfile(
        id=uuid.uuid4(),
        legal_name="Norm Co",
        primary_email="norm@example.com",
        compliance_status="pending_review",
        approval_status="draft",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
    )
    p.tax_id = "123-45-6789"
    db_session.add(p)
    await db_session.commit()

    hit = (
        await db_session.execute(
            select(ClientProfile).where(ClientProfile.tax_id_bidx == blind_index("  123-45-6789  "))
        )
    ).scalar_one()
    assert hit.id == p.id


@pytest.mark.asyncio
async def test_null_tax_id_clears_both_columns(db_session: AsyncSession, rm_user: User) -> None:
    p = ClientProfile(
        id=uuid.uuid4(),
        legal_name="Null Co",
        primary_email="nul@example.com",
        compliance_status="pending_review",
        approval_status="draft",
        created_by=rm_user.id,
        assigned_rm_id=rm_user.id,
    )
    p.tax_id = "TO-BE-CLEARED"
    db_session.add(p)
    await db_session.commit()

    p.tax_id = None
    await db_session.commit()
    await db_session.refresh(p)

    assert p.tax_id is None
    assert p.tax_id_enc is None
    assert p.tax_id_bidx is None
