"""Add assignment acceptance workflow fields and history table.

Adds offer_expires_at, declined_at, decline_reason to partner_assignments,
and creates the assignment_history audit table.

Revision ID: add_assignment_acceptance_workflow
Revises: add_document_shares, add_meeting_scheduler
Create Date: 2026-03-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_assignment_acceptance_workflow"
down_revision: tuple[str, str] = ("add_document_shares", "add_meeting_scheduler")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add new columns to partner_assignments
    op.add_column(
        "partner_assignments",
        sa.Column("offer_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "partner_assignments",
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "partner_assignments",
        sa.Column("decline_reason", sa.Text(), nullable=True),
    )

    # Create assignment_history table
    op.create_table(
        "assignment_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "assignment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("partner_assignments.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("event", sa.String(50), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
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
    op.create_index("ix_assignment_history_event", "assignment_history", ["event"])


def downgrade() -> None:
    op.drop_index("ix_assignment_history_event", table_name="assignment_history")
    op.drop_index("ix_assignment_history_assignment_id", table_name="assignment_history")
    op.drop_table("assignment_history")
    op.drop_column("partner_assignments", "decline_reason")
    op.drop_column("partner_assignments", "declined_at")
    op.drop_column("partner_assignments", "offer_expires_at")
