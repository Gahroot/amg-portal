"""Add report_schedules table.

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-03-09 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "f5a6b7c8d9e0"
down_revision: str | None = "e4f5a6b7c8d9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "report_schedules",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(100), nullable=True),
        sa.Column("frequency", sa.String(20), nullable=False),
        sa.Column(
            "next_run",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "recipients",
            postgresql.JSON(),
            nullable=False,
        ),
        sa.Column(
            "format",
            sa.String(10),
            nullable=False,
            server_default="pdf",
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "last_run",
            sa.DateTime(timezone=True),
            nullable=True,
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
            nullable=False,
        ),
    )

    op.create_index(
        "ix_report_schedules_next_run",
        "report_schedules",
        ["next_run"],
    )
    op.create_index(
        "ix_report_schedules_is_active",
        "report_schedules",
        ["is_active"],
    )


def downgrade() -> None:
    op.drop_index("ix_report_schedules_is_active")
    op.drop_index("ix_report_schedules_next_run")
    op.drop_table("report_schedules")
