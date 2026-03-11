"""add_partner_capability_matrix

Revision ID: ab4b71a8d1a4
Revises: d3e4f5a6b7c8
Create Date: 2026-03-11 16:12:11.891393

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ab4b71a8d1a4"
down_revision: str | None = "d3e4f5a6b7c8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Service categories table
    op.create_table(
        "service_categories",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("required_capabilities", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Partner capabilities table
    op.create_table(
        "partner_capabilities",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("partner_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("capability_name", sa.String(100), nullable=False),
        sa.Column("proficiency_level", sa.String(20), nullable=False),
        sa.Column("years_experience", sa.Numeric(5, 1), nullable=True),
        sa.Column("verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "verified_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_partner_capabilities_partner_id",
        "partner_capabilities",
        ["partner_id"],
    )

    # Partner qualifications table
    op.create_table(
        "partner_qualifications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("partner_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("qualification_level", sa.String(20), nullable=False),
        sa.Column("approval_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "approved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "approved_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_partner_qualifications_partner_id",
        "partner_qualifications",
        ["partner_id"],
    )

    # Partner certifications table
    op.create_table(
        "partner_certifications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("partner_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("issuing_body", sa.String(200), nullable=False),
        sa.Column("certificate_number", sa.String(100), nullable=True),
        sa.Column("issue_date", sa.Date, nullable=True),
        sa.Column("expiry_date", sa.Date, nullable=True),
        sa.Column("document_url", sa.String(500), nullable=True),
        sa.Column(
            "verification_status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "verified_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_partner_certifications_partner_id",
        "partner_certifications",
        ["partner_id"],
    )

    # Partner onboarding table
    op.create_table(
        "partner_onboarding",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("partner_profiles.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "current_stage",
            sa.String(30),
            nullable=False,
            server_default="profile_setup",
        ),
        sa.Column("checklist_items", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column("completed_stages", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column(
            "assigned_coordinator",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("partner_onboarding")
    op.drop_index("ix_partner_certifications_partner_id", "partner_certifications")
    op.drop_table("partner_certifications")
    op.drop_index("ix_partner_qualifications_partner_id", "partner_qualifications")
    op.drop_table("partner_qualifications")
    op.drop_index("ix_partner_capabilities_partner_id", "partner_capabilities")
    op.drop_table("partner_capabilities")
    op.drop_table("service_categories")
