"""add_status_to_communication_template

Revision ID: add_status_to_communication_template
Revises: c2d3e4f5g6h7
Create Date: 2026-03-20 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_status_to_communication_template"
down_revision: str | Sequence[str] | None = "c2d3e4f5g6h7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add approval workflow columns to communication_templates."""
    op.add_column(
        "communication_templates",
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
    )
    op.add_column(
        "communication_templates",
        sa.Column("rejection_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "communication_templates",
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "communication_templates",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_communication_templates_reviewed_by_users",
        "communication_templates",
        "users",
        ["reviewed_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Remove approval workflow columns from communication_templates."""
    op.drop_constraint(
        "fk_communication_templates_reviewed_by_users",
        "communication_templates",
        type_="foreignkey",
    )
    op.drop_column("communication_templates", "reviewed_at")
    op.drop_column("communication_templates", "reviewed_by")
    op.drop_column("communication_templates", "rejection_reason")
    op.drop_column("communication_templates", "status")
