"""Add partner_thresholds table for configurable performance alert thresholds.

Revision ID: add_partner_threshold
Revises: add_assignment_acceptance_workflow
Create Date: 2026-03-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_partner_threshold"
down_revision: str = "add_assignment_acceptance_workflow"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "partner_thresholds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("partner_profiles.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "sla_compliance_threshold",
            sa.Float(),
            nullable=False,
            server_default="90.0",
        ),
        sa.Column(
            "quality_score_threshold",
            sa.Float(),
            nullable=False,
            server_default="3.0",
        ),
        sa.Column(
            "overall_score_threshold",
            sa.Float(),
            nullable=False,
            server_default="3.0",
        ),
        sa.Column(
            "trend_window_weeks",
            sa.Integer(),
            nullable=False,
            server_default="4",
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
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
            onupdate=sa.func.now(),
        ),
        sa.UniqueConstraint("partner_id", name="uq_partner_threshold_partner_id"),
    )


def downgrade() -> None:
    op.drop_table("partner_thresholds")
