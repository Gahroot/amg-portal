"""add_quiet_hours_to_notification_preferences

Revision ID: add_quiet_hours_notif
Revises: b1c2d3e4f5g6
Create Date: 2026-03-12
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_quiet_hours_notif"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "notification_preferences",
        sa.Column("quiet_hours_enabled", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("quiet_hours_start", sa.Time(), nullable=True),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("quiet_hours_end", sa.Time(), nullable=True),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("timezone", sa.String(50), nullable=False, server_default="UTC"),
    )


def downgrade() -> None:
    op.drop_column("notification_preferences", "timezone")
    op.drop_column("notification_preferences", "quiet_hours_end")
    op.drop_column("notification_preferences", "quiet_hours_start")
    op.drop_column("notification_preferences", "quiet_hours_enabled")
