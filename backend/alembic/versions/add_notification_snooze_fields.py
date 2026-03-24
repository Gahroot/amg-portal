"""Add snooze fields to notification model.

Revision ID: add_notification_snooze_fields
Revises: add_notification_grouping
Create Date: 2026-03-22

Adds:
- snoozed_until column to notifications table (datetime, nullable)
- snooze_count column to notifications table (integer, default 0)
"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_notification_snooze_fields"
down_revision = "add_notification_grouping"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add snoozed_until column to notifications table
    op.add_column(
        "notifications",
        sa.Column(
            "snoozed_until",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    # Add snooze_count column to notifications table
    op.add_column(
        "notifications",
        sa.Column(
            "snooze_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    # Create index for faster lookups of snoozed notifications
    op.create_index(
        "ix_notifications_snoozed_until",
        "notifications",
        ["snoozed_until"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_snoozed_until", table_name="notifications")
    op.drop_column("notifications", "snooze_count")
    op.drop_column("notifications", "snoozed_until")
