"""Add escalation_rules table.

Revision ID: add_escalation_rules
Revises: a3b4c5d6e7f8, add_communication_logs, a1b2c3d4e5f6
Create Date: 2026-03-18 14:00:00.000000
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "add_escalation_rules"
down_revision = ("a3b4c5d6e7f8", "add_communication_logs", "a1b2c3d4e5f6")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "escalation_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("trigger_type", sa.String(30), nullable=False),
        sa.Column("trigger_conditions", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("escalation_level", sa.String(20), nullable=False),
        sa.Column("auto_assign_to_role", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_escalation_rules_trigger_type", "escalation_rules", ["trigger_type"])


def downgrade() -> None:
    op.drop_index("ix_escalation_rules_trigger_type", table_name="escalation_rules")
    op.drop_table("escalation_rules")
