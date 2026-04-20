"""Add saved_filters table for filter presets.

Revision ID: add_saved_filters
Revises: add_bookmarks
Create Date: 2026-03-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_saved_filters"
down_revision: str | Sequence[str] | None = "add_bookmarks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "saved_filters",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(30), nullable=False),
        sa.Column("filter_config", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
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
        sa.UniqueConstraint("user_id", "name", "entity_type", name="uq_saved_filter"),
    )
    op.create_index("ix_saved_filters_user_entity", "saved_filters", ["user_id", "entity_type"])


def downgrade() -> None:
    op.drop_index("ix_saved_filters_user_entity", table_name="saved_filters")
    op.drop_table("saved_filters")
