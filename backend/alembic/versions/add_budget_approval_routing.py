"""Add budget approval routing engine

Revision ID: add_budget_approval_routing
Revises: ddc5d4fef8cd
Create Date: 2025-01-11

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_budget_approval_routing"
down_revision: str | None = "ddc5d4fef8cd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create approval_chains table
    op.create_table(
        "approval_chains",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_approval_chains_name", "approval_chains", ["name"])

    # Create approval_chain_steps table
    op.create_table(
        "approval_chain_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approval_chain_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("required_role", sa.String(50), nullable=False),
        sa.Column("specific_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_parallel", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("timeout_hours", sa.Integer(), nullable=True),
        sa.Column(
            "auto_approve_on_timeout",
            sa.Boolean(),
            nullable=False,
            server_default="false",
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["approval_chain_id"], ["approval_chains.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["specific_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_approval_chain_steps_chain",
        "approval_chain_steps",
        ["approval_chain_id", "step_number"],
    )

    # Create approval_thresholds table
    op.create_table(
        "approval_thresholds",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("min_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("max_amount", sa.Numeric(15, 2), nullable=True),
        sa.Column("approval_chain_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["approval_chain_id"], ["approval_chains.id"], ondelete="RESTRICT"),
    )
    op.create_index(
        "ix_approval_thresholds_amount",
        "approval_thresholds",
        ["min_amount", "max_amount"],
    )

    # Create budget_approval_requests table
    op.create_table(
        "budget_approval_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("requested_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("budget_impact", sa.Numeric(15, 2), nullable=False),
        sa.Column("current_budget", sa.Numeric(15, 2), nullable=False),
        sa.Column("projected_budget", sa.Numeric(15, 2), nullable=False),
        sa.Column("threshold_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approval_chain_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("current_step", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("final_decision_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("final_comments", sa.Text(), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["threshold_id"], ["approval_thresholds.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["approval_chain_id"], ["approval_chains.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_budget_approval_requests_program", "budget_approval_requests", ["program_id"]
    )
    op.create_index("ix_budget_approval_requests_status", "budget_approval_requests", ["status"])

    # Create budget_approval_steps table
    op.create_table(
        "budget_approval_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chain_step_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("assigned_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_role", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("decision", sa.String(20), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("decided_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_timeout", sa.Boolean(), nullable=False, server_default="false"),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["request_id"], ["budget_approval_requests.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["chain_step_id"], ["approval_chain_steps.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["assigned_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["decided_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_budget_approval_steps_request", "budget_approval_steps", ["request_id"])

    # Create budget_approval_history table
    op.create_table(
        "budget_approval_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=True),
        sa.Column("from_status", sa.String(50), nullable=True),
        sa.Column("to_status", sa.String(50), nullable=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_name", sa.String(255), nullable=False),
        sa.Column("actor_role", sa.String(50), nullable=False),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["request_id"], ["budget_approval_requests.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_budget_approval_history_request", "budget_approval_history", ["request_id"])
    op.create_index("ix_budget_approval_history_created", "budget_approval_history", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_budget_approval_history_created", table_name="budget_approval_history")
    op.drop_index("ix_budget_approval_history_request", table_name="budget_approval_history")
    op.drop_table("budget_approval_history")

    op.drop_index("ix_budget_approval_steps_request", table_name="budget_approval_steps")
    op.drop_table("budget_approval_steps")

    op.drop_index("ix_budget_approval_requests_status", table_name="budget_approval_requests")
    op.drop_index("ix_budget_approval_requests_program", table_name="budget_approval_requests")
    op.drop_table("budget_approval_requests")

    op.drop_index("ix_approval_thresholds_amount", table_name="approval_thresholds")
    op.drop_table("approval_thresholds")

    op.drop_index("ix_approval_chain_steps_chain", table_name="approval_chain_steps")
    op.drop_table("approval_chain_steps")

    op.drop_index("ix_approval_chains_name", table_name="approval_chains")
    op.drop_table("approval_chains")
