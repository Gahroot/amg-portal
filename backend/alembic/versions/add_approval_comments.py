"""add_approval_comments

Adds the approval_comments table for threaded comment history on approval items.

Revision ID: add_approval_comments
Revises: add_shared_reports
Create Date: 2026-03-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_approval_comments"
down_revision: str | Sequence[str] | None = "add_shared_reports"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "approval_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("approval_comments.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "author_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_internal", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "mentioned_user_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=False)),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )

    op.create_index("ix_approval_comments_entity_type", "approval_comments", ["entity_type"])
    op.create_index("ix_approval_comments_entity_id", "approval_comments", ["entity_id"])
    op.create_index("ix_approval_comments_parent_id", "approval_comments", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_approval_comments_parent_id", table_name="approval_comments")
    op.drop_index("ix_approval_comments_entity_id", table_name="approval_comments")
    op.drop_index("ix_approval_comments_entity_type", table_name="approval_comments")
    op.drop_table("approval_comments")
