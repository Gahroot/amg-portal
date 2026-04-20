"""add audit chain columns (Phase 1.12)

Revision ID: add_audit_chain_cols
Revises: widen_audit_action
Create Date: 2026-04-20 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "add_audit_chain_cols"
down_revision: str | Sequence[str] | None = "widen_audit_action"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add prev_hash / row_hash / hmac / day_bucket columns.

    The columns land as NULLABLE first so pre-existing rows can be backfilled
    with crude genesis values (a deterministic SHA-256 of the row id) — just
    enough to mark them as "pre-chain, do not verify".  After backfill we
    tighten ``row_hash``/``hmac``/``day_bucket`` to NOT NULL so the SQLA model
    contract is enforced by the DB.

    ``AUDIT_CHAIN_START_AT`` in config tells verify_day which rows to ignore.
    The pgcrypto ``digest()`` function is created if missing; ``CREATE
    EXTENSION IF NOT EXISTS`` is idempotent and cheap.
    """
    # pgcrypto gives us digest() in SQL; required for the backfill.
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.add_column(
        "audit_logs",
        sa.Column("prev_hash", sa.LargeBinary(length=32), nullable=True),
    )
    op.add_column(
        "audit_logs",
        sa.Column("row_hash", sa.LargeBinary(length=32), nullable=True),
    )
    op.add_column(
        "audit_logs",
        sa.Column("hmac", sa.LargeBinary(length=32), nullable=True),
    )
    op.add_column(
        "audit_logs",
        sa.Column("day_bucket", sa.Date(), nullable=True),
    )

    # Backfill existing rows with genesis-placeholder values so we can tighten
    # the constraints.  These rows are marked as "before the real chain" by
    # AUDIT_CHAIN_START_AT in config — verification skips them.
    op.execute(
        """
        UPDATE audit_logs
        SET day_bucket = COALESCE(day_bucket, (created_at AT TIME ZONE 'UTC')::date),
            row_hash   = COALESCE(row_hash,  digest(id::text, 'sha256')),
            hmac       = COALESCE(hmac,      digest(id::text || '|hmac', 'sha256'))
        WHERE row_hash IS NULL OR hmac IS NULL OR day_bucket IS NULL
        """
    )

    op.alter_column("audit_logs", "row_hash", existing_type=sa.LargeBinary(32), nullable=False)
    op.alter_column("audit_logs", "hmac", existing_type=sa.LargeBinary(32), nullable=False)
    op.alter_column("audit_logs", "day_bucket", existing_type=sa.Date(), nullable=False)

    op.create_index(
        "ix_audit_logs_day_bucket",
        "audit_logs",
        ["day_bucket"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_audit_logs_day_bucket", table_name="audit_logs")
    op.drop_column("audit_logs", "day_bucket")
    op.drop_column("audit_logs", "hmac")
    op.drop_column("audit_logs", "row_hash")
    op.drop_column("audit_logs", "prev_hash")
