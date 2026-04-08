"""encrypt mfa secrets at rest

Revision ID: f8a2c3d4e5b6
Revises: 45ff9a1104a8
Create Date: 2026-03-30 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f8a2c3d4e5b6"
down_revision: str | None = "45ff9a1104a8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Widen mfa_secret column to accommodate Fernet ciphertext (~120+ chars)
    op.alter_column(
        "users",
        "mfa_secret",
        type_=sa.String(255),
        existing_type=sa.String(64),
        existing_nullable=True,
    )

    # Encrypt existing plaintext MFA secrets in-place
    from app.core.security import encrypt_mfa_secret

    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, mfa_secret FROM users WHERE mfa_secret IS NOT NULL")
    ).fetchall()

    for row in rows:
        user_id, plaintext_secret = row
        # Skip if already looks like Fernet ciphertext (starts with 'gAAAAA')
        if plaintext_secret and not plaintext_secret.startswith("gAAAAA"):
            encrypted = encrypt_mfa_secret(plaintext_secret)
            conn.execute(
                sa.text("UPDATE users SET mfa_secret = :secret WHERE id = :uid"),
                {"secret": encrypted, "uid": user_id},
            )


def downgrade() -> None:
    # Decrypt secrets back to plaintext
    from app.core.security import decrypt_mfa_secret

    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, mfa_secret FROM users WHERE mfa_secret IS NOT NULL")
    ).fetchall()

    for row in rows:
        user_id, encrypted_secret = row
        if encrypted_secret and encrypted_secret.startswith("gAAAAA"):
            plaintext = decrypt_mfa_secret(encrypted_secret)
            conn.execute(
                sa.text("UPDATE users SET mfa_secret = :secret WHERE id = :uid"),
                {"secret": plaintext, "uid": user_id},
            )

    # Shrink column back
    op.alter_column(
        "users",
        "mfa_secret",
        type_=sa.String(64),
        existing_type=sa.String(255),
        existing_nullable=True,
    )
