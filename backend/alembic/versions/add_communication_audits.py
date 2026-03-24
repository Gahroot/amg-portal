"""Add communication audits table and client communication preferences.

Revision ID: add_communication_audits
Revises: add_scheduled_events
Create Date: 2026-03-18
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision = "add_communication_audits"
down_revision = "add_scheduled_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Communication audit trail table
    op.create_table(
        "communication_audits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "communication_id",
            UUID(as_uuid=True),
            sa.ForeignKey("communications.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "conversation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column(
            "actor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("details", JSONB, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_communication_audits_communication_id",
        "communication_audits",
        ["communication_id"],
    )
    op.create_index(
        "ix_communication_audits_conversation_id",
        "communication_audits",
        ["conversation_id"],
    )
    op.create_index(
        "ix_communication_audits_actor_id",
        "communication_audits",
        ["actor_id"],
    )
    op.create_index(
        "ix_communication_audits_created_at",
        "communication_audits",
        ["created_at"],
    )

    # Client communication preference columns on client_profiles
    op.add_column(
        "client_profiles",
        sa.Column("preferred_channels", JSONB, nullable=True),
    )
    op.add_column(
        "client_profiles",
        sa.Column("contact_hours_start", sa.String(10), nullable=True),
    )
    op.add_column(
        "client_profiles",
        sa.Column("contact_hours_end", sa.String(10), nullable=True),
    )
    op.add_column(
        "client_profiles",
        sa.Column("contact_timezone", sa.String(50), nullable=True),
    )
    op.add_column(
        "client_profiles",
        sa.Column("language_preference", sa.String(10), nullable=True),
    )
    op.add_column(
        "client_profiles",
        sa.Column(
            "do_not_contact",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "client_profiles",
        sa.Column(
            "opt_out_marketing",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("client_profiles", "opt_out_marketing")
    op.drop_column("client_profiles", "do_not_contact")
    op.drop_column("client_profiles", "language_preference")
    op.drop_column("client_profiles", "contact_timezone")
    op.drop_column("client_profiles", "contact_hours_end")
    op.drop_column("client_profiles", "contact_hours_start")
    op.drop_column("client_profiles", "preferred_channels")

    op.drop_index(
        "ix_communication_audits_created_at",
        "communication_audits",
    )
    op.drop_index(
        "ix_communication_audits_actor_id",
        "communication_audits",
    )
    op.drop_index(
        "ix_communication_audits_conversation_id",
        "communication_audits",
    )
    op.drop_index(
        "ix_communication_audits_communication_id",
        "communication_audits",
    )
    op.drop_table("communication_audits")
