"""Add calendar_feed_tokens table

Revision ID: add_calendar_feed_tokens
Revises: ddc5d4fef8cd
Create Date: 2025-01-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_calendar_feed_tokens"
down_revision: str | None = "ddc5d4fef8cd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create calendar_feed_tokens table
    op.create_table(
        "calendar_feed_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes
    op.create_index("ix_calendar_feed_tokens_user_id", "calendar_feed_tokens", ["user_id"])
    op.create_index("ix_calendar_feed_tokens_token", "calendar_feed_tokens", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_calendar_feed_tokens_token", table_name="calendar_feed_tokens")
    op.drop_index("ix_calendar_feed_tokens_user_id", table_name="calendar_feed_tokens")
    op.drop_table("calendar_feed_tokens")
