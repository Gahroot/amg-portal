"""Add custom_reports table.

Revision ID: add_custom_reports
Revises: add_program_templates
Create Date: 2026-03-23 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_custom_reports"
down_revision: str | None = "add_program_templates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "custom_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("data_source", sa.String(50), nullable=False),
        sa.Column("fields", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("filters", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("sorting", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("grouping", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("is_template", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("custom_reports")
