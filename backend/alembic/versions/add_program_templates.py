"""Add program_templates table.

Revision ID: add_program_templates
Revises: add_client_dates
Create Date: 2026-03-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision = "add_program_templates"
down_revision = "add_client_dates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "program_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(100), nullable=False, index=True),
        sa.Column("milestones_template", JSONB, nullable=True),
        sa.Column("estimated_duration_days", sa.Integer, nullable=True),
        sa.Column(
            "is_system_template",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "is_active",
            sa.Boolean,
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("program_templates")
