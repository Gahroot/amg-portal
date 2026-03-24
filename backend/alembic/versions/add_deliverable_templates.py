"""Add deliverable_templates table.

Revision ID: add_deliverable_templates
Revises: add_escalation_playbooks
Create Date: 2026-03-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_deliverable_templates"
down_revision: str | Sequence[str] | None = "add_escalation_playbooks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "deliverable_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("file_type", sa.String(100), nullable=True),
        sa.Column("file_name", sa.String(255), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("file_path", sa.String(500), nullable=True),
        sa.Column("deliverable_type", sa.String(50), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index("ix_deliverable_templates_category", "deliverable_templates", ["category"])
    op.create_index(
        "ix_deliverable_templates_deliverable_type",
        "deliverable_templates",
        ["deliverable_type"],
    )


def downgrade() -> None:
    op.drop_index("ix_deliverable_templates_deliverable_type", table_name="deliverable_templates")
    op.drop_index("ix_deliverable_templates_category", table_name="deliverable_templates")
    op.drop_table("deliverable_templates")
