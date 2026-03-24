"""Add capability review and access audit tables

Revision ID: add_capability_review_access_audit
Revises: f5a6b7c8d9e0
Create Date: 2024-01-15 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_capability_review_access_audit"
down_revision: str | None = "f5a6b7c8d9e0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create capability_reviews table
    op.create_table(
        "capability_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("review_year", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("scheduled_date", sa.Date(), nullable=True),
        sa.Column("completed_date", sa.Date(), nullable=True),
        sa.Column("capabilities_reviewed", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("certifications_reviewed", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("qualifications_reviewed", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("findings", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recommendations", sa.Text(), nullable=True),
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["partner_id"],
            ["partner_profiles.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_capability_reviews_partner_year",
        "capability_reviews",
        ["partner_id", "review_year"],
        unique=True,
    )
    op.create_index("ix_capability_reviews_status", "capability_reviews", ["status"])

    # Create access_audits table
    op.create_table(
        "access_audits",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("audit_period", sa.String(20), nullable=False),
        sa.Column("quarter", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("auditor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("users_reviewed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("permissions_verified", sa.Integer(), server_default="0", nullable=False),
        sa.Column("anomalies_found", sa.Integer(), server_default="0", nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("recommendations", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["auditor_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_access_audits_quarter_year",
        "access_audits",
        ["quarter", "year"],
        unique=True,
    )
    op.create_index("ix_access_audits_status", "access_audits", ["status"])

    # Create access_audit_findings table
    op.create_table(
        "access_audit_findings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("audit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("finding_type", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("remediation_notes", sa.Text(), nullable=True),
        sa.Column("remediated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("remediated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("waived_reason", sa.Text(), nullable=True),
        sa.Column("waived_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("waived_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["audit_id"],
            ["access_audits.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["remediated_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["acknowledged_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["waived_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_access_audit_findings_audit_id", "access_audit_findings", ["audit_id"])
    op.create_index("ix_access_audit_findings_status", "access_audit_findings", ["status"])
    op.create_index("ix_access_audit_findings_severity", "access_audit_findings", ["severity"])


def downgrade() -> None:
    op.drop_index("ix_access_audit_findings_severity", table_name="access_audit_findings")
    op.drop_index("ix_access_audit_findings_status", table_name="access_audit_findings")
    op.drop_index("ix_access_audit_findings_audit_id", table_name="access_audit_findings")
    op.drop_table("access_audit_findings")

    op.drop_index("ix_access_audits_status", table_name="access_audits")
    op.drop_index("ix_access_audits_quarter_year", table_name="access_audits")
    op.drop_table("access_audits")

    op.drop_index("ix_capability_reviews_status", table_name="capability_reviews")
    op.drop_index("ix_capability_reviews_partner_year", table_name="capability_reviews")
    op.drop_table("capability_reviews")
