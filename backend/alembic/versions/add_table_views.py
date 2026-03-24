"""Add table views for saving and sharing table configurations.

Revision ID: add_table_views
Revises: add_multi_device_sync
Create Date: 2026-03-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_table_views"
down_revision: str | Sequence[str] | None = "add_multi_device_sync"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create table_views table
    op.create_table(
        "table_views",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("table_id", sa.String(100), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("filters", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("sort", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("columns", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column(
            "column_order", postgresql.JSONB(), nullable=False, server_default="[]"
        ),
        sa.Column(
            "column_sizes", postgresql.JSONB(), nullable=False, server_default="{}"
        ),
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default="false"),
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
    )

    # Create indexes
    op.create_index("ix_table_views_user_id", "table_views", ["user_id"])
    op.create_index("ix_table_views_table_id", "table_views", ["table_id"])
    op.create_index("ix_table_views_is_shared", "table_views", ["is_shared"])
    op.create_index("ix_table_views_is_default", "table_views", ["is_default"])

    # Composite index for user + table queries
    op.create_index(
        "ix_table_views_user_table", "table_views", ["user_id", "table_id"]
    )

    # Composite index for shared views by table
    op.create_index(
        "ix_table_views_shared_table", "table_views", ["is_shared", "table_id"]
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_table_views_shared_table", table_name="table_views")
    op.drop_index("ix_table_views_user_table", table_name="table_views")
    op.drop_index("ix_table_views_is_default", table_name="table_views")
    op.drop_index("ix_table_views_is_shared", table_name="table_views")
    op.drop_index("ix_table_views_table_id", table_name="table_views")
    op.drop_index("ix_table_views_user_id", table_name="table_views")

    # Drop table
    op.drop_table("table_views")
