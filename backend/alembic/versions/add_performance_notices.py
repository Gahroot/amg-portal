"""Add performance notices table for formal partner SLA/quality notices.

Revision ID: add_performance_notices
Revises: add_nps_surveys
Create Date: 2026-03-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_performance_notices"
down_revision: str | Sequence[str] | None = "add_nps_surveys"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "performance_notices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("issued_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notice_type", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(50), nullable=False, server_default="formal_notice"),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("required_action", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["partner_id"], ["partner_profiles.id"]),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"]),
        sa.ForeignKeyConstraint(["issued_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_performance_notices_partner_id",
        "performance_notices",
        ["partner_id"],
    )
    op.create_index(
        "ix_performance_notices_program_id",
        "performance_notices",
        ["program_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_performance_notices_program_id", table_name="performance_notices")
    op.drop_index("ix_performance_notices_partner_id", table_name="performance_notices")
    op.drop_table("performance_notices")
