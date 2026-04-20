"""Add escalation_playbooks and playbook_executions tables.

Revision ID: add_escalation_playbooks
Revises: add_custom_reports, add_shared_reports
Create Date: 2026-03-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_escalation_playbooks"
down_revision: str | Sequence[str] | None = (
    "add_custom_reports",
    "add_shared_reports",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create escalation_playbooks and playbook_executions tables."""
    op.create_table(
        "escalation_playbooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("escalation_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "steps", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"
        ),  # noqa: E501
        sa.Column(
            "success_criteria",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),  # noqa: E501
        sa.Column(
            "escalation_paths",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),  # noqa: E501
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
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
    op.create_index(
        "ix_escalation_playbooks_escalation_type",
        "escalation_playbooks",
        ["escalation_type"],
    )

    op.create_table(
        "playbook_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "playbook_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("escalation_playbooks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "escalation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("escalations.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="in_progress"),
        sa.Column(
            "step_states",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),  # noqa: E501
        sa.Column(
            "started_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("completed_steps", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_steps", sa.Integer, nullable=False, server_default="0"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index(
        "ix_playbook_executions_playbook_id",
        "playbook_executions",
        ["playbook_id"],
    )
    op.create_index(
        "ix_playbook_executions_escalation_id",
        "playbook_executions",
        ["escalation_id"],
    )
    op.create_index(
        "ix_playbook_executions_status",
        "playbook_executions",
        ["status"],
    )


def downgrade() -> None:
    """Drop escalation_playbooks and playbook_executions tables."""
    op.drop_table("playbook_executions")
    op.drop_table("escalation_playbooks")
