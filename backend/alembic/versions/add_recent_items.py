"""Add recent_items table for tracking user's recently viewed items

Revision ID: add_recent_items
Revises: add_two_person_delete
Create Date: 2026-03-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "add_recent_items"
down_revision: str | Sequence[str] | None = "add_two_person_delete"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recent_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("item_type", sa.String(20), nullable=False),
        sa.Column("item_id", sa.UUID(), nullable=False),
        sa.Column("item_title", sa.String(255), nullable=False),
        sa.Column("item_subtitle", sa.String(255), nullable=True),
        sa.Column("viewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_recent_items_user_type", "recent_items", ["user_id", "item_type"])
    op.create_index("ix_recent_items_user_viewed", "recent_items", ["user_id", "viewed_at"])


def downgrade() -> None:
    op.drop_index("ix_recent_items_user_viewed", table_name="recent_items")
    op.drop_index("ix_recent_items_user_type", table_name="recent_items")
    op.drop_table("recent_items")
