"""add audit_checkpoints table (Phase 1.13)

Revision ID: add_audit_checkpoint
Revises: add_audit_chain_cols
Create Date: 2026-04-20 10:05:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "add_audit_checkpoint"
down_revision: str | Sequence[str] | None = "add_audit_chain_cols"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_checkpoints",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("merkle_root", sa.LargeBinary(length=32), nullable=False),
        sa.Column("signature", sa.LargeBinary(length=64), nullable=False),
        sa.Column("tsa_token", sa.LargeBinary(), nullable=True),
        sa.Column("tsa_error", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("day", name="uq_audit_checkpoints_day"),
    )
    op.create_index(
        "ix_audit_checkpoints_day",
        "audit_checkpoints",
        ["day"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_audit_checkpoints_day", table_name="audit_checkpoints")
    op.drop_table("audit_checkpoints")
