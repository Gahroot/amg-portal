"""Add pulse survey system for one-click satisfaction feedback.

Revision ID: add_pulse_surveys
Revises: add_nps_surveys
Create Date: 2026-03-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_pulse_surveys"
down_revision = "add_nps_surveys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create pulse_surveys table
    op.create_table(
        "pulse_surveys",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("response_type", sa.String(20), nullable=False),
        sa.Column("allow_comment", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("trigger_type", sa.String(30), nullable=False, server_default="random"),
        sa.Column("active_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("max_responses", sa.Integer, nullable=True),
        sa.Column(
            "min_days_between_shows", sa.Integer, nullable=False, server_default="14"
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
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
    )

    # Create pulse_survey_responses table
    op.create_table(
        "pulse_survey_responses",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "survey_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pulse_surveys.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "client_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("client_profiles.id"),
            nullable=False,
        ),
        sa.Column("response_value", sa.String(20), nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("trigger_context", postgresql.JSON, nullable=True),
        sa.Column(
            "responded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Indexes
    op.create_index("ix_pulse_surveys_status", "pulse_surveys", ["status"])
    op.create_index(
        "ix_pulse_survey_responses_survey_id", "pulse_survey_responses", ["survey_id"]
    )
    op.create_index(
        "ix_pulse_survey_responses_client_profile_id",
        "pulse_survey_responses",
        ["client_profile_id"],
    )
    op.create_index(
        "ix_pulse_survey_responses_responded_at",
        "pulse_survey_responses",
        ["responded_at"],
    )

    # Unique constraint: one response per client per survey
    op.create_unique_constraint(
        "uq_pulse_survey_responses_survey_client",
        "pulse_survey_responses",
        ["survey_id", "client_profile_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_pulse_survey_responses_survey_client", "pulse_survey_responses", type_="unique"
    )
    op.drop_index(
        "ix_pulse_survey_responses_responded_at", "pulse_survey_responses"
    )
    op.drop_index(
        "ix_pulse_survey_responses_client_profile_id", "pulse_survey_responses"
    )
    op.drop_index(
        "ix_pulse_survey_responses_survey_id", "pulse_survey_responses"
    )
    op.drop_index("ix_pulse_surveys_status", "pulse_surveys")
    op.drop_table("pulse_survey_responses")
    op.drop_table("pulse_surveys")
