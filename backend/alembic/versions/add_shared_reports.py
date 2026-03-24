"""Add shared_reports table for token-based public report access.

Revision ID: add_shared_reports
Revises: add_report_favorites
Create Date: 2026-03-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "add_shared_reports"
down_revision: str | Sequence[str] | None = "add_report_favorites"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "shared_reports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("report_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=True),
        sa.Column("share_token", sa.String(length=64), nullable=False),
        sa.Column(
            "created_by",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("access_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("allow_download", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("share_token"),
    )
    op.create_index("ix_shared_reports_share_token", "shared_reports", ["share_token"])


def downgrade() -> None:
    op.drop_index("ix_shared_reports_share_token", table_name="shared_reports")
    op.drop_table("shared_reports")
