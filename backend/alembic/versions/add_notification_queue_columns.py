"""Add missing columns to notifications and notification_preferences tables.

Revision ID: add_notif_queue_cols
Revises: bca21ac73c26
Create Date: 2026-04-07 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_notif_queue_cols"
down_revision: str | None = "bca21ac73c26"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # notifications: push_queued and email_queued
    op.add_column(
        "notifications",
        sa.Column("push_queued", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "notifications",
        sa.Column("email_queued", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_notifications_push_queued", "notifications", ["push_queued"])
    op.create_index("ix_notifications_email_queued", "notifications", ["email_queued"])

    # notification_preferences: granular_preferences
    op.add_column(
        "notification_preferences",
        sa.Column("granular_preferences", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("notification_preferences", "granular_preferences")
    op.drop_index("ix_notifications_email_queued", table_name="notifications")
    op.drop_index("ix_notifications_push_queued", table_name="notifications")
    op.drop_column("notifications", "email_queued")
    op.drop_column("notifications", "push_queued")
