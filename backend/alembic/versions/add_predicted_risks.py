"""Add predicted_risks table for risk prediction storage.

Revision ID: add_predicted_risks
Revises: add_communication_audits
Create Date: 2026-03-20
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision = "add_predicted_risks"
down_revision = "add_communication_audits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "predicted_risks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "program_id",
            UUID(as_uuid=True),
            sa.ForeignKey("programs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "milestone_id",
            UUID(as_uuid=True),
            sa.ForeignKey("milestones.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("risk_score", sa.Integer(), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False),
        sa.Column("task_completion_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_tasks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_tasks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("blocked_tasks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("overdue_tasks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("milestone_velocity", sa.Float(), nullable=True),
        sa.Column("milestone_velocity_trend", sa.String(20), nullable=True),
        sa.Column("days_remaining", sa.Integer(), nullable=True),
        sa.Column("schedule_variance", sa.Float(), nullable=True),
        sa.Column("behind_schedule", sa.String(5), nullable=False, server_default="false"),
        sa.Column("anomaly_flags", JSONB, nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_predicted_risks_program_id", "predicted_risks", ["program_id"])
    op.create_index("ix_predicted_risks_milestone_id", "predicted_risks", ["milestone_id"])
    op.create_index("ix_predicted_risks_computed_at", "predicted_risks", ["computed_at"])
    op.create_index("ix_predicted_risks_risk_score", "predicted_risks", ["risk_score"])


def downgrade() -> None:
    op.drop_index("ix_predicted_risks_risk_score", "predicted_risks")
    op.drop_index("ix_predicted_risks_computed_at", "predicted_risks")
    op.drop_index("ix_predicted_risks_milestone_id", "predicted_risks")
    op.drop_index("ix_predicted_risks_program_id", "predicted_risks")
    op.drop_table("predicted_risks")
