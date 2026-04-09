"""Add NPS survey system for quarterly client satisfaction.

Revision ID: add_nps_surveys
Revises: add_two_person_delete
Create Date: 2025-01-11
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_nps_surveys"
down_revision = "add_two_person_delete"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create nps_surveys table
    op.create_table(
        "nps_surveys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),  # noqa: E501
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("quarter", sa.Integer, nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, default="draft"),
        sa.Column("questions", postgresql.JSON, nullable=False, default={}),
        sa.Column("distribution_method", sa.String(20), nullable=False, default="email"),
        sa.Column("reminder_enabled", sa.Boolean, nullable=False, default=True),
        sa.Column("reminder_days", sa.Integer, nullable=False, default=7),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("target_client_types", postgresql.JSON, nullable=True),
        sa.Column("target_client_ids", postgresql.JSON, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),  # noqa: E501
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, default=sa.text("now()")),  # noqa: E501
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, default=sa.text("now()")),  # noqa: E501
    )

    # Create nps_responses table
    op.create_table(
        "nps_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),  # noqa: E501
        sa.Column("survey_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("nps_surveys.id", ondelete="CASCADE"), nullable=False),  # noqa: E501
        sa.Column("client_profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("client_profiles.id"), nullable=False),  # noqa: E501
        sa.Column("score", sa.Integer, nullable=False),
        sa.Column("score_category", sa.String(20), nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("custom_responses", postgresql.JSON, nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=False, default=sa.text("now()")),  # noqa: E501
        sa.Column("response_channel", sa.String(20), nullable=False, default="portal"),
        sa.Column("follow_up_required", sa.Boolean, nullable=False, default=False),
        sa.Column("follow_up_completed", sa.Boolean, nullable=False, default=False),
    )

    # Create nps_follow_ups table
    op.create_table(
        "nps_follow_ups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),  # noqa: E501
        sa.Column("survey_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("nps_surveys.id", ondelete="CASCADE"), nullable=False),  # noqa: E501
        sa.Column("response_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("nps_responses.id", ondelete="CASCADE"), nullable=False),  # noqa: E501
        sa.Column("client_profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("client_profiles.id"), nullable=False),  # noqa: E501
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),  # noqa: E501
        sa.Column("priority", sa.String(20), nullable=False, default="medium"),
        sa.Column("status", sa.String(20), nullable=False, default="pending"),
        sa.Column("action_type", sa.String(50), nullable=False, default="personal_reach_out"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("resolution_notes", sa.Text, nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, default=sa.text("now()")),  # noqa: E501
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, default=sa.text("now()")),  # noqa: E501
    )

    # Create indexes
    op.create_index("ix_nps_surveys_status", "nps_surveys", ["status"])
    op.create_index("ix_nps_surveys_quarter_year", "nps_surveys", ["year", "quarter"])
    op.create_index("ix_nps_responses_survey_id", "nps_responses", ["survey_id"])
    op.create_index("ix_nps_responses_client_profile_id", "nps_responses", ["client_profile_id"])
    op.create_index("ix_nps_responses_score_category", "nps_responses", ["score_category"])
    op.create_index("ix_nps_follow_ups_survey_id", "nps_follow_ups", ["survey_id"])
    op.create_index("ix_nps_follow_ups_assigned_to", "nps_follow_ups", ["assigned_to"])
    op.create_index("ix_nps_follow_ups_status", "nps_follow_ups", ["status"])
    op.create_index("ix_nps_follow_ups_priority", "nps_follow_ups", ["priority"])

    # Create unique constraint for one response per client per survey
    op.create_unique_constraint(
        "uq_nps_responses_survey_client",
        "nps_responses",
        ["survey_id", "client_profile_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_nps_responses_survey_client", "nps_responses", type_="unique")
    op.drop_index("ix_nps_follow_ups_priority", "nps_follow_ups")
    op.drop_index("ix_nps_follow_ups_status", "nps_follow_ups")
    op.drop_index("ix_nps_follow_ups_assigned_to", "nps_follow_ups")
    op.drop_index("ix_nps_follow_ups_survey_id", "nps_follow_ups")
    op.drop_index("ix_nps_responses_score_category", "nps_responses")
    op.drop_index("ix_nps_responses_client_profile_id", "nps_responses")
    op.drop_index("ix_nps_responses_survey_id", "nps_responses")
    op.drop_index("ix_nps_surveys_quarter_year", "nps_surveys")
    op.drop_index("ix_nps_surveys_status", "nps_surveys")
    op.drop_table("nps_follow_ups")
    op.drop_table("nps_responses")
    op.drop_table("nps_surveys")
