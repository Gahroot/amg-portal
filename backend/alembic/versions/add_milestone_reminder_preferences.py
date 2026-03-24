"""Add milestone reminder preferences to notification_preferences.

Revision ID: add_milestone_reminder_preferences
Revises: add_notification_grouping
Create Date: 2026-03-23

Adds:
- milestone_reminder_days: JSONB array of days before due date to send reminders (default [7, 1])
- milestone_reminder_channels: JSONB array of channels to use (default ["email", "in_app"])
- milestone_reminder_program_overrides: JSONB dict for per-program overrides
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_milestone_reminder_preferences"
down_revision = "add_notification_grouping"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "notification_preferences",
        sa.Column(
            "milestone_reminder_days",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default="[7, 1]",
        ),
    )
    op.add_column(
        "notification_preferences",
        sa.Column(
            "milestone_reminder_channels",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default='["email", "in_app"]',
        ),
    )
    op.add_column(
        "notification_preferences",
        sa.Column(
            "milestone_reminder_program_overrides",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("notification_preferences", "milestone_reminder_program_overrides")
    op.drop_column("notification_preferences", "milestone_reminder_channels")
    op.drop_column("notification_preferences", "milestone_reminder_days")
