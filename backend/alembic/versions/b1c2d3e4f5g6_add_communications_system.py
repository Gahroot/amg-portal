"""add_communications_system

Revision ID: b1c2d3e4f5g6
Revises: af5b149103d2
Create Date: 2026-03-05 13:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5g6"
down_revision: str | Sequence[str] | None = "af5b149103d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create conversations table
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("conversation_type", sa.String(50), nullable=False, server_default="rm_client"),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["client_profiles.id"], ondelete="SET NULL"),
        sa.Column("partner_assignment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["partner_assignment_id"],
            ["partner_assignments.id"],
            ondelete="SET NULL",
        ),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column(
            "participant_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Index("ix_conversations_client_id", "client_id"),
        sa.Index("ix_conversations_partner_assignment_id", "partner_assignment_id"),
        sa.Index("ix_conversations_participant_ids", "participant_ids", postgresql_using="gin"),
        sa.Index("ix_conversations_last_activity_at", "last_activity_at"),
    )

    # Create communications table
    op.create_table(
        "communications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="SET NULL"),
        sa.Column("channel", sa.String(50), nullable=False, server_default="in_portal"),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="SET NULL"),
        sa.Column("recipients", postgresql.JSONB(), nullable=True),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("attachment_ids", postgresql.JSONB(), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["client_profiles.id"], ondelete="SET NULL"),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="SET NULL"),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["partner_id"], ["partner_profiles.id"], ondelete="SET NULL"),
        sa.Column("read_receipts", postgresql.JSONB(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Index("ix_communications_conversation_id", "conversation_id"),
        sa.Index("ix_communications_sender_id", "sender_id"),
        sa.Index("ix_communications_client_id", "client_id"),
        sa.Index("ix_communications_program_id", "program_id"),
        sa.Index("ix_communications_partner_id", "partner_id"),
        sa.Index("ix_communications_status", "status"),
        sa.Index("ix_communications_created_at", "created_at"),
    )

    # Create communication_templates table
    op.create_table(
        "communication_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("template_type", sa.String(50), nullable=False, server_default="custom"),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("variable_definitions", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Index("ix_communication_templates_template_type", "template_type"),
        sa.Index("ix_communication_templates_is_active", "is_active"),
    )

    # Create notifications table
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.Column("notification_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("action_url", sa.String(1000), nullable=True),
        sa.Column("action_label", sa.String(100), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="normal"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("email_delivered", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Index("ix_notifications_user_id", "user_id"),
        sa.Index("ix_notifications_user_id_is_read", "user_id", "is_read"),
        sa.Index("ix_notifications_notification_type", "notification_type"),
        sa.Index("ix_notifications_created_at", "created_at"),
        sa.Index("ix_notifications_entity", "entity_type", "entity_id"),
    )

    # Create notification_preferences table
    op.create_table(
        "notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.Column("digest_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("digest_frequency", sa.String(20), nullable=False, server_default="daily"),
        sa.Column("notification_type_preferences", postgresql.JSONB(), nullable=True),
        sa.Column("channel_preferences", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Create decision_requests table
    op.create_table(
        "decision_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["client_profiles.id"], ondelete="CASCADE"),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="SET NULL"),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("response_type", sa.String(50), nullable=False, server_default="choice"),
        sa.Column("options", postgresql.JSONB(), nullable=True),
        sa.Column("deadline_date", sa.Date(), nullable=True),
        sa.Column("deadline_time", sa.Time(), nullable=True),
        sa.Column("consequence_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("response", postgresql.JSONB(), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("responded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["responded_by"], ["users.id"], ondelete="SET NULL"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Index("ix_decision_requests_client_id", "client_id"),
        sa.Index("ix_decision_requests_program_id", "program_id"),
        sa.Index("ix_decision_requests_status", "status"),
        sa.Index("ix_decision_requests_created_by", "created_by"),
        sa.Index("ix_decision_requests_deadline", "deadline_date", "status"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("decision_requests")
    op.drop_table("notification_preferences")
    op.drop_table("notifications")
    op.drop_table("communication_templates")
    op.drop_table("communications")
    op.drop_table("conversations")
