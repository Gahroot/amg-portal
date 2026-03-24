"""Add bookmarks table for pinning frequently accessed entities.

Revision ID: add_bookmarks
Revises: add_recent_items
Create Date: 2026-03-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_bookmarks"
down_revision: str | Sequence[str] | None = "add_recent_items"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "bookmarks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_type", sa.String(20), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_title", sa.String(255), nullable=False),
        sa.Column("entity_subtitle", sa.String(255), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "entity_type", "entity_id", name="uq_bookmark"),
    )
    op.create_index("ix_bookmarks_user_type", "bookmarks", ["user_id", "entity_type"])
    op.create_index("ix_bookmarks_user_order", "bookmarks", ["user_id", "display_order"])


def downgrade() -> None:
    op.drop_index("ix_bookmarks_user_order", table_name="bookmarks")
    op.drop_index("ix_bookmarks_user_type", table_name="bookmarks")
    op.drop_table("bookmarks")
