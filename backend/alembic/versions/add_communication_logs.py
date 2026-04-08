"""add communication_logs table

Revision ID: add_communication_logs
Revises: add_travel_bookings
Create Date: 2026-03-18
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "add_communication_logs"
down_revision: str | Sequence[str] | None = "add_travel_bookings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "communication_logs",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("channel", sa.String(50), nullable=False),
        sa.Column("direction", sa.String(20), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("client_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("partner_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("program_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("logged_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attachments", sa.dialects.postgresql.JSON(), nullable=True),
        sa.Column("tags", sa.dialects.postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["client_profiles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["partner_id"], ["partner_profiles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["logged_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_communication_logs_client_id", "communication_logs", ["client_id"])
    op.create_index("ix_communication_logs_partner_id", "communication_logs", ["partner_id"])
    op.create_index("ix_communication_logs_program_id", "communication_logs", ["program_id"])
    op.create_index("ix_communication_logs_logged_by", "communication_logs", ["logged_by"])
    op.create_index("ix_communication_logs_channel", "communication_logs", ["channel"])
    op.create_index("ix_communication_logs_occurred_at", "communication_logs", ["occurred_at"])


def downgrade() -> None:
    op.drop_index("ix_communication_logs_occurred_at", table_name="communication_logs")
    op.drop_index("ix_communication_logs_channel", table_name="communication_logs")
    op.drop_index("ix_communication_logs_logged_by", table_name="communication_logs")
    op.drop_index("ix_communication_logs_program_id", table_name="communication_logs")
    op.drop_index("ix_communication_logs_partner_id", table_name="communication_logs")
    op.drop_index("ix_communication_logs_client_id", table_name="communication_logs")
    op.drop_table("communication_logs")
