"""Add indexes on notifications(user_id, is_read, push_queued, email_queued)

Revision ID: notif_indexes_01
Revises: f8a2c3d4e5b6
Create Date: 2026-04-02 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "notif_indexes_01"
down_revision: str | None = "f8a2c3d4e5b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Composite index covering the dominant query pattern: user's unread notifications
    op.create_index(
        "ix_notifications_user_id_is_read",
        "notifications",
        ["user_id", "is_read"],
    )
    # Standalone index on user_id for queries that don't filter is_read
    # (e.g. mark-all-read bulk updates, per-user fetches without read filter)
    op.create_index(
        "ix_notifications_user_id",
        "notifications",
        ["user_id"],
    )
    # Indexes for background delivery job filtering by queue flags
    op.create_index(
        "ix_notifications_push_queued",
        "notifications",
        ["push_queued"],
    )
    op.create_index(
        "ix_notifications_email_queued",
        "notifications",
        ["email_queued"],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_email_queued", table_name="notifications")
    op.drop_index("ix_notifications_push_queued", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_index("ix_notifications_user_id_is_read", table_name="notifications")
