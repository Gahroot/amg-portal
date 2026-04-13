"""add_crm_leads_opportunities

Revision ID: add_crm_leads_opportunities
Revises: add_notif_queue_cols
Create Date: 2026-04-13 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "add_crm_leads_opportunities"
down_revision: str | Sequence[str] | None = "add_notif_queue_cols"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add leads, opportunities, and crm_activities tables."""
    op.create_table(
        "leads",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("company", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="new"),
        sa.Column("source", sa.String(length=30), nullable=False, server_default="other"),
        sa.Column("source_details", sa.String(length=500), nullable=True),
        sa.Column("estimated_value", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("estimated_client_type", sa.String(length=50), nullable=True),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("referred_by_partner_id", sa.UUID(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("disqualified_reason", sa.String(length=500), nullable=True),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("converted_client_profile_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["referred_by_partner_id"], ["partner_profiles.id"]),
        sa.ForeignKeyConstraint(["converted_client_profile_id"], ["client_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_leads_email"), "leads", ["email"], unique=False)
    op.create_index(op.f("ix_leads_status"), "leads", ["status"], unique=False)
    op.create_index(op.f("ix_leads_owner_id"), "leads", ["owner_id"], unique=False)

    op.create_table(
        "opportunities",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "stage",
            sa.String(length=30),
            nullable=False,
            server_default="qualifying",
        ),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("value", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("probability", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("expected_close_date", sa.Date(), nullable=True),
        sa.Column("program_type", sa.String(length=100), nullable=True),
        sa.Column("next_step", sa.String(length=500), nullable=True),
        sa.Column("next_step_at", sa.Date(), nullable=True),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("lead_id", sa.UUID(), nullable=True),
        sa.Column("client_profile_id", sa.UUID(), nullable=True),
        sa.Column("won_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lost_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lost_reason", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["client_profile_id"], ["client_profiles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_opportunities_stage"), "opportunities", ["stage"], unique=False)
    op.create_index(op.f("ix_opportunities_owner_id"), "opportunities", ["owner_id"], unique=False)

    op.create_table(
        "crm_activities",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False, server_default="note"),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lead_id", sa.UUID(), nullable=True),
        sa.Column("opportunity_id", sa.UUID(), nullable=True),
        sa.Column("client_profile_id", sa.UUID(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["opportunity_id"], ["opportunities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_profile_id"], ["client_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_activities_lead_id"), "crm_activities", ["lead_id"], unique=False)
    op.create_index(
        op.f("ix_crm_activities_opportunity_id"),
        "crm_activities",
        ["opportunity_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_crm_activities_client_profile_id"),
        "crm_activities",
        ["client_profile_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_crm_activities_client_profile_id"), table_name="crm_activities")
    op.drop_index(op.f("ix_crm_activities_opportunity_id"), table_name="crm_activities")
    op.drop_index(op.f("ix_crm_activities_lead_id"), table_name="crm_activities")
    op.drop_table("crm_activities")
    op.drop_index(op.f("ix_opportunities_owner_id"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_stage"), table_name="opportunities")
    op.drop_table("opportunities")
    op.drop_index(op.f("ix_leads_owner_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_status"), table_name="leads")
    op.drop_index(op.f("ix_leads_email"), table_name="leads")
    op.drop_table("leads")
