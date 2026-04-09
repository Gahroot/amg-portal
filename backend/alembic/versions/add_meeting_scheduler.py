"""add_meeting_scheduler

Revision ID: add_meeting_scheduler
Revises: add_doc_req_status_tracking,
    add_milestone_reminder_preferences,
    add_notification_snooze_fields, add_program_templates,
    add_pulse_surveys, add_recurring_tasks
Create Date: 2026-03-23 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_meeting_scheduler"
down_revision: str | Sequence[str] | None = (
    "add_doc_req_status_tracking",
    "add_milestone_reminder_preferences",
    "add_notification_snooze_fields",
    "add_program_templates",
    "add_pulse_surveys",
    "add_recurring_tasks",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── meeting_types ──────────────────────────────────────────────────────────
    op.create_table(
        "meeting_types",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(50), nullable=False, unique=True),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("duration_minutes", sa.Integer, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
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
    )
    op.create_index("ix_meeting_types_slug", "meeting_types", ["slug"])

    # ── rm_availability ────────────────────────────────────────────────────────
    op.create_table(
        "rm_availability",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("rm_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day_of_week", sa.Integer, nullable=False),
        sa.Column("start_time", sa.Time, nullable=False),
        sa.Column("end_time", sa.Time, nullable=False),
        sa.Column("buffer_minutes", sa.Integer, nullable=False, server_default="15"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
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
        sa.ForeignKeyConstraint(["rm_id"], ["users.id"]),
    )
    op.create_index("ix_rm_availability_rm_id", "rm_availability", ["rm_id"])

    # ── rm_blackouts ───────────────────────────────────────────────────────────
    op.create_table(
        "rm_blackouts",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("rm_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blackout_date", sa.Date, nullable=False),
        sa.Column("reason", sa.String(500), nullable=True),
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
        sa.ForeignKeyConstraint(["rm_id"], ["users.id"]),
    )
    op.create_index("ix_rm_blackouts_rm_id", "rm_blackouts", ["rm_id"])

    # ── meetings ───────────────────────────────────────────────────────────────
    op.create_table(
        "meetings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "meeting_type_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("rm_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "booked_by_user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(50), nullable=False, server_default="UTC"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("agenda", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("virtual_link", sa.String(1000), nullable=True),
        sa.Column(
            "cancelled_by_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("cancellation_reason", sa.String(500), nullable=True),
        sa.Column(
            "reschedule_of_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "scheduled_event_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
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
        sa.ForeignKeyConstraint(["meeting_type_id"], ["meeting_types.id"]),
        sa.ForeignKeyConstraint(["rm_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["booked_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["cancelled_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reschedule_of_id"], ["meetings.id"]),
        sa.ForeignKeyConstraint(["scheduled_event_id"], ["scheduled_events.id"]),
    )
    op.create_index("ix_meetings_rm_id", "meetings", ["rm_id"])
    op.create_index("ix_meetings_client_id", "meetings", ["client_id"])
    op.create_index("ix_meetings_meeting_type_id", "meetings", ["meeting_type_id"])
    op.create_index("ix_meetings_status", "meetings", ["status"])

    # Seed the three default meeting types
    op.execute(
        """
        INSERT INTO meeting_types
            (id, slug, label, duration_minutes,
             description, display_order)
        VALUES
          (gen_random_uuid(), 'quick_checkin', 'Quick Check-in',
           15, 'A brief 15-minute touch-base with your RM.', 0),
          (gen_random_uuid(), 'standard', 'Standard Meeting',
           30, 'A 30-minute meeting to discuss updates.', 1),
          (gen_random_uuid(), 'extended', 'Extended Discussion',
           60, 'A 60-minute in-depth strategic session.', 2)
        ON CONFLICT (slug) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("meetings")
    op.drop_table("rm_blackouts")
    op.drop_table("rm_availability")
    op.drop_table("meeting_types")
