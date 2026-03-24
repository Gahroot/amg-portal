"""Add multi-device sync tables for preferences and read status.

Revision ID: add_multi_device_sync
Revises: add_bookmarks
Create Date: 2026-03-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_multi_device_sync"
down_revision: str | Sequence[str] | None = "add_bookmarks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create user_preferences table
    op.create_table(
        "user_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ui_preferences", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sync_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_preferences_user"),
    )
    op.create_index("ix_user_preferences_user_id", "user_preferences", ["user_id"])

    # Create read_statuses table
    op.create_table(
        "read_statuses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("device_id", sa.String(100), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "entity_type", "entity_id", name="uq_read_status_user_entity"
        ),
    )
    op.create_index("ix_read_statuses_user_id", "read_statuses", ["user_id"])

    # Create device_sessions table
    op.create_table(
        "device_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", sa.String(100), nullable=False),
        sa.Column("device_type", sa.String(20), nullable=False),
        sa.Column("device_name", sa.String(100), nullable=True),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("app_version", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "device_id", name="uq_device_session_user_device"),
    )
    op.create_index("ix_device_sessions_user_id", "device_sessions", ["user_id"])
    op.create_index("ix_device_sessions_device_id", "device_sessions", ["device_id"])

    # Create sync_queue table
    op.create_table(
        "sync_queue",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("client_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sync_queue_user_id", "sync_queue", ["user_id"])
    op.create_index("ix_sync_queue_device_id", "sync_queue", ["device_id"])
    # Partial index for pending items
    op.execute(
        "CREATE INDEX ix_sync_queue_pending ON sync_queue (user_id, synced_at) "
        "WHERE synced_at IS NULL"
    )


def downgrade() -> None:
    # Drop sync_queue table
    op.execute("DROP INDEX IF EXISTS ix_sync_queue_pending")
    op.drop_index("ix_sync_queue_device_id", table_name="sync_queue")
    op.drop_index("ix_sync_queue_user_id", table_name="sync_queue")
    op.drop_table("sync_queue")

    # Drop device_sessions table
    op.drop_index("ix_device_sessions_device_id", table_name="device_sessions")
    op.drop_index("ix_device_sessions_user_id", table_name="device_sessions")
    op.drop_table("device_sessions")

    # Drop read_statuses table
    op.drop_index("ix_read_statuses_user_id", table_name="read_statuses")
    op.drop_table("read_statuses")

    # Drop user_preferences table
    op.drop_index("ix_user_preferences_user_id", table_name="user_preferences")
    op.drop_table("user_preferences")
