"""Add communication approval workflow fields.

Revision ID: a3b4c5d6e7f8
Revises: 24f7329b0cc1
Create Date: 2026-03-18 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3b4c5d6e7f8"
down_revision: str | None = "24f7329b0cc1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "communications",
        sa.Column("approval_status", sa.String(50), nullable=False, server_default="draft"),
    )
    op.add_column(
        "communications",
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "communications",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "communications",
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
    )
    op.create_foreign_key(
        "fk_communications_reviewer_id",
        "communications",
        "users",
        ["reviewer_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_communications_reviewer_id", "communications", type_="foreignkey")
    op.drop_column("communications", "reviewer_notes")
    op.drop_column("communications", "reviewed_at")
    op.drop_column("communications", "reviewer_id")
    op.drop_column("communications", "approval_status")
