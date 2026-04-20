"""Add notification grouping fields.

Revision ID: add_notification_grouping
Revises: add_recent_items
Create Date: 2026-03-22

Adds:
- group_key column to notifications table for grouping related notifications
- grouping_mode column to notification_preferences table for user preference
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_notification_grouping"
down_revision = "add_recent_items"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add group_key column to notifications table
    op.add_column(
        "notifications",
        sa.Column("group_key", sa.String(200), nullable=True),
    )
    op.create_index(
        "ix_notifications_group_key",
        "notifications",
        ["group_key"],
        unique=False,
    )

    # Add grouping_mode column to notification_preferences table
    op.add_column(
        "notification_preferences",
        sa.Column(
            "grouping_mode",
            sa.String(20),
            nullable=True,
            server_default="type",
        ),
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_group_key", table_name="notifications")
    op.drop_column("notifications", "group_key")
    op.drop_column("notification_preferences", "grouping_mode")
