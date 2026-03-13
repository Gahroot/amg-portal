"""Calendar integration database tables."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "88e9f4f03bea"
down_revision: str | Sequence[str] | None = "ab4b71a8d1a4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create calendar_connections table
    op.create_table(
        "calendar_connections",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "user_id", sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("provider_user_id", sa.String(255), nullable=True),
        sa.Column("provider_email", sa.String(255), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column(
            "token_expires_at", sa.DateTime(timezone=True), nullable=True,
        ),
        sa.Column("calendar_id", sa.String(255), nullable=True),
        sa.Column("calendar_name", sa.String(255), nullable=True),
        sa.Column(
            "is_primary", sa.Boolean(),
            nullable=False, server_default=sa.text("false"),
        ),
        sa.Column(
            "is_active", sa.Boolean(),
            nullable=False, server_default=sa.text("true"),
        ),
        sa.Column(
            "sync_milestones", sa.Boolean(),
            nullable=False, server_default=sa.text("true"),
        ),
        sa.Column(
            "sync_tasks", sa.Boolean(),
            nullable=False, server_default=sa.text("false"),
        ),
        sa.Column("reminder_minutes", sa.Integer(), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_error", sa.Text(), nullable=True),
        sa.Column("extra_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Create calendar_events table
    op.create_table(
        "calendar_events",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "connection_id", sa.UUID(),
            sa.ForeignKey("calendar_connections.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "milestone_id", sa.UUID(),
            sa.ForeignKey("milestones.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("external_event_id", sa.String(255), nullable=False),
        sa.Column("event_url", sa.String(1000), nullable=True),
        sa.Column(
            "status", sa.String(20),
            nullable=False, server_default=sa.text("'confirmed'"),
        ),
        sa.Column(
            "last_synced_at", sa.DateTime(timezone=True), nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Create calendar_reminders table
    op.create_table(
        "calendar_reminders",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "milestone_id", sa.UUID(),
            sa.ForeignKey("milestones.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "user_id", sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("reminder_minutes", sa.Integer(), nullable=False),
        sa.Column(
            "notification_sent", sa.Boolean(),
            nullable=False, server_default=sa.text("false"),
        ),
        sa.Column(
            "notification_sent_at", sa.DateTime(timezone=True), nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Create calendar_availability table
    op.create_table(
        "calendar_availability",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "user_id", sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "connection_id", sa.UUID(),
            sa.ForeignKey("calendar_connections.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "is_busy", sa.Boolean(),
            nullable=False, server_default=sa.text("false"),
        ),
        sa.Column("busy_periods", sa.JSON(), nullable=True),
        sa.Column("cached_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("calendar_availability")
    op.drop_table("calendar_reminders")
    op.drop_table("calendar_events")
    op.drop_table("calendar_connections")
