"""encrypt calendar oauth tokens at rest

Revision ID: enc_cal_tokens_01
Revises: widen_audit_action
Create Date: 2026-04-20 12:00:00.000000

Phase 1.3 of the security plan. Moves ``users.google_calendar_token`` and
``users.outlook_calendar_token`` from plaintext ``JSON`` to AES-GCM-encrypted
``BYTEA`` via the ``EncryptedJSON`` TypeDecorator.

In-place swap, mirroring the shape of ``encrypt_mfa_secrets_at_rest``:

1. Add sibling ``_enc`` columns (BYTEA).
2. Read each row's plaintext JSON, encrypt via the same TypeDecorator the ORM
   uses at runtime, write to the ``_enc`` column.
3. Drop the old columns and rename ``_enc`` → original name.

Downgrade reverses: add plaintext JSON column back, decrypt, drop encrypted.
"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "enc_cal_tokens_01"
down_revision: str | Sequence[str] | None = "widen_audit_action"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_COLUMNS = ("google_calendar_token", "outlook_calendar_token")


def _encrypt_json(value: dict[str, Any] | None, column: str) -> bytes | None:
    """Encrypt a Python dict via ``EncryptedJSON.process_bind_param``.

    Import-local so Alembic's offline mode / ``--sql`` flag never trips on the
    crypto module when run without a DB connection.
    """
    if value is None:
        return None
    from app.db.encrypted_json import EncryptedJSON

    td = EncryptedJSON(table="users", column=column)
    out: bytes | None = td.process_bind_param(value, dialect=op.get_bind().dialect)
    return out


def _decrypt_json(value: bytes | None, column: str) -> dict[str, Any] | None:
    if value is None:
        return None
    from app.db.encrypted_json import EncryptedJSON

    td = EncryptedJSON(table="users", column=column)
    return td.process_result_value(bytes(value), dialect=op.get_bind().dialect)  # type: ignore[no-any-return]


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add ``_enc`` columns
    for col in _COLUMNS:
        op.add_column("users", sa.Column(f"{col}_enc", sa.LargeBinary(), nullable=True))

    # 2. Backfill from plaintext JSON
    for col in _COLUMNS:
        rows = conn.execute(
            sa.text(f"SELECT id, {col} FROM users WHERE {col} IS NOT NULL")
        ).fetchall()
        for row in rows:
            user_id, plaintext_json = row
            # Postgres returns a dict for JSON columns; treat already-decoded None as skip
            if plaintext_json is None:
                continue
            ciphertext = _encrypt_json(plaintext_json, col)
            conn.execute(
                sa.text(f"UPDATE users SET {col}_enc = :blob WHERE id = :uid"),
                {"blob": ciphertext, "uid": user_id},
            )

    # 3. Drop plaintext, rename ``_enc`` → original
    for col in _COLUMNS:
        op.drop_column("users", col)
        op.alter_column("users", f"{col}_enc", new_column_name=col)


def downgrade() -> None:
    conn = op.get_bind()

    # 1. Add plaintext JSON columns back (with a ``_plain`` suffix temporarily)
    for col in _COLUMNS:
        op.add_column(
            "users",
            sa.Column(f"{col}_plain", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        )

    # 2. Decrypt and populate
    for col in _COLUMNS:
        rows = conn.execute(
            sa.text(f"SELECT id, {col} FROM users WHERE {col} IS NOT NULL")
        ).fetchall()
        for row in rows:
            user_id, ct = row
            plaintext = _decrypt_json(ct, col)
            if plaintext is None:
                continue
            import json as _json

            conn.execute(
                sa.text(
                    f"UPDATE users SET {col}_plain = CAST(:js AS json) WHERE id = :uid"
                ),
                {"js": _json.dumps(plaintext), "uid": user_id},
            )

    # 3. Drop encrypted, rename plain → original
    for col in _COLUMNS:
        op.drop_column("users", col)
        op.alter_column("users", f"{col}_plain", new_column_name=col)
