"""encrypt client pii tax_id + blind index

Revision ID: enc_client_pii_01
Revises: enc_cal_tokens_01
Create Date: 2026-04-20 12:05:00.000000

Phase 1.4 / 1.5 of the security plan. Turns ``client_profiles.tax_id`` from
plaintext ``VARCHAR(100)`` into AES-GCM ciphertext ``BYTEA``, and adds a
``tax_id_bidx BYTEA(16)`` HMAC blind-index sidecar with a B-tree index so
equality lookups keep working without scanning every ciphertext.

UHNW client counts are small (hundreds, not millions), so this is a single
in-place migration rather than the two-phase live swap the plan allows for
hot tables. Safety net: the backfill tolerates re-runs — if a row already has
``tax_id_bidx`` populated from a prior attempt, we recompute both columns
from the plaintext and idempotently overwrite.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "enc_client_pii_01"
down_revision: str | Sequence[str] | None = "enc_cal_tokens_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add new columns — ``tax_id_enc`` (BYTEA) and ``tax_id_bidx`` (BYTEA(16)).
    op.add_column("client_profiles", sa.Column("tax_id_enc", sa.LargeBinary(), nullable=True))
    op.add_column(
        "client_profiles", sa.Column("tax_id_bidx", sa.LargeBinary(length=16), nullable=True)
    )

    # 2. Backfill from the existing plaintext column.
    from app.core.crypto import blind_index
    from app.db.encrypted_type import EncryptedBytes

    td = EncryptedBytes(table="client_profiles", column="tax_id")
    rows = conn.execute(
        sa.text("SELECT id, tax_id FROM client_profiles WHERE tax_id IS NOT NULL")
    ).fetchall()
    for row in rows:
        profile_id, plaintext = row
        if not plaintext:
            continue
        payload = plaintext.encode("utf-8")
        ciphertext = td.process_bind_param(payload, dialect=conn.dialect)
        bidx = blind_index(plaintext)
        conn.execute(
            sa.text(
                "UPDATE client_profiles "
                "SET tax_id_enc = :ct, tax_id_bidx = :bidx "
                "WHERE id = :pid"
            ),
            {"ct": ciphertext, "bidx": bidx, "pid": profile_id},
        )

    # 3. Drop the old plaintext column and rename the encrypted one into place.
    op.drop_column("client_profiles", "tax_id")
    op.alter_column("client_profiles", "tax_id_enc", new_column_name="tax_id")

    # 4. B-tree index on the blind-index column for fast equality lookups.
    op.create_index(
        "ix_client_profiles_tax_id_bidx",
        "client_profiles",
        ["tax_id_bidx"],
    )


def downgrade() -> None:
    conn = op.get_bind()

    # 1. Add plaintext column back under a temporary name.
    op.add_column(
        "client_profiles", sa.Column("tax_id_plain", sa.String(length=100), nullable=True)
    )

    # 2. Decrypt existing rows.
    from app.db.encrypted_type import EncryptedBytes

    td = EncryptedBytes(table="client_profiles", column="tax_id")
    rows = conn.execute(
        sa.text("SELECT id, tax_id FROM client_profiles WHERE tax_id IS NOT NULL")
    ).fetchall()
    for row in rows:
        profile_id, ct = row
        if ct is None:
            continue
        plaintext = td.process_result_value(bytes(ct), dialect=conn.dialect)
        if plaintext is None:
            continue
        conn.execute(
            sa.text(
                "UPDATE client_profiles SET tax_id_plain = :pt WHERE id = :pid"
            ),
            {"pt": plaintext.decode("utf-8"), "pid": profile_id},
        )

    # 3. Drop encrypted + blind-index columns; promote the plaintext column.
    op.drop_index("ix_client_profiles_tax_id_bidx", table_name="client_profiles")
    op.drop_column("client_profiles", "tax_id")
    op.drop_column("client_profiles", "tax_id_bidx")
    op.alter_column("client_profiles", "tax_id_plain", new_column_name="tax_id")
