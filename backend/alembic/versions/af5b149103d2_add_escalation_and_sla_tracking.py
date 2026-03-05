"""add_escalation_and_sla_tracking

Revision ID: af5b149103d2
Revises: 6bce34dcf2df
Create Date: 2026-03-05 12:09:55.253689

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "af5b149103d2"
down_revision: str | Sequence[str] | None = "6bce34dcf2df"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create escalations table
    op.create_table(
        "escalations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("level", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"]),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("triggered_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["triggered_by"], ["users.id"]),
        sa.Column("risk_factors", postgresql.JSONB(), nullable=True),
        sa.Column("escalation_chain", postgresql.JSONB(), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
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
        sa.Index("ix_escalations_owner_id", "owner_id"),
        sa.Index("ix_escalations_level", "level"),
        sa.Index("ix_escalations_program_id", "program_id"),
        sa.Index("ix_escalations_client_id", "client_id"),
        sa.Index("ix_escalations_status_level", "status", "level"),
        sa.Index("ix_escalations_entity", "entity_type", "entity_id"),
        sa.Index("ix_escalations_program_client", "program_id", "client_id"),
    )

    # Create sla_trackers table
    op.create_table(
        "sla_trackers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("communication_type", sa.String(30), nullable=False),
        sa.Column("sla_hours", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("breach_status", sa.String(20), nullable=False, server_default="within_sla"),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"]),
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
        sa.Index("ix_sla_trackers_assigned_to", "assigned_to"),
        sa.Index("ix_sla_trackers_breach_status", "breach_status"),
        sa.Index("ix_sla_trackers_entity", "entity_type", "entity_id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("sla_trackers")
    op.drop_table("escalations")
