"""Add indexes on notifications(user_id, is_read, push_queued, email_queued)

Revision ID: notif_indexes_01
Revises: f8a2c3d4e5b6
Create Date: 2026-04-02 00:00:00.000000

"""

from collections.abc import Sequence

from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "notif_indexes_01"
down_revision: str | None = "f8a2c3d4e5b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_exists(conn, table: str, column: str) -> bool:  # type: ignore[no-untyped-def]
    result = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    )
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # These indexes may already exist from the table creation migration
    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_notifications_user_id_is_read "
            "ON notifications (user_id, is_read)"
        )
    )
    conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id)")
    )

    # These columns may not exist yet if added by a later migration
    if _column_exists(conn, "notifications", "push_queued"):
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_notifications_push_queued "
                "ON notifications (push_queued)"
            )
        )
    if _column_exists(conn, "notifications", "email_queued"):
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_notifications_email_queued "
                "ON notifications (email_queued)"
            )
        )


def downgrade() -> None:
    op.drop_index("ix_notifications_email_queued", table_name="notifications")
    op.drop_index("ix_notifications_push_queued", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_index("ix_notifications_user_id_is_read", table_name="notifications")
