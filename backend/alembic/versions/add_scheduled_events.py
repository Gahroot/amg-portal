"""Add scheduled events table.

Revision ID: add_scheduled_events
Revises: add_message_digest_preferences
Create Date: 2026-03-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_scheduled_events"
down_revision: str | Sequence[str] | None = "add_message_digest_preferences"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema: add scheduled_events table."""
    op.create_table(
        "scheduled_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(50), nullable=False, server_default="UTC"),
        sa.Column("location", sa.String(500), nullable=True),
        sa.Column("virtual_link", sa.String(1000), nullable=True),
        sa.Column(
            "organizer_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"), nullable=False,
        ),
        sa.Column(
            "program_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("programs.id"), nullable=True,
        ),
        sa.Column(
            "client_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id"), nullable=True,
        ),
        sa.Column("attendee_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("recurrence_rule", sa.String(500), nullable=True),
        sa.Column("reminder_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
    )
    op.create_index("ix_scheduled_events_organizer_id", "scheduled_events", ["organizer_id"])
    op.create_index("ix_scheduled_events_program_id", "scheduled_events", ["program_id"])
    op.create_index("ix_scheduled_events_client_id", "scheduled_events", ["client_id"])
    op.create_index("ix_scheduled_events_start_time", "scheduled_events", ["start_time"])
    op.create_index("ix_scheduled_events_status", "scheduled_events", ["status"])


def downgrade() -> None:
    """Downgrade schema: remove scheduled_events table."""
    op.drop_index("ix_scheduled_events_status")
    op.drop_index("ix_scheduled_events_start_time")
    op.drop_index("ix_scheduled_events_client_id")
    op.drop_index("ix_scheduled_events_program_id")
    op.drop_index("ix_scheduled_events_organizer_id")
    op.drop_table("scheduled_events")
