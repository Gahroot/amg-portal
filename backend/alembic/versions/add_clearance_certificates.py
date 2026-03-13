"""Add compliance clearance certificates

Revision ID: add_clearance_certificates
Revises:
Create Date: 2025-01-11

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_clearance_certificates"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create certificate_templates table
    op.create_table(
        "certificate_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("template_type", sa.String(50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("placeholders", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_certificate_templates_type", "certificate_templates", ["template_type"])

    # Create clearance_certificates table
    op.create_table(
        "clearance_certificates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("certificate_number", sa.String(50), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("populated_data", postgresql.JSONB(), nullable=True),
        sa.Column("certificate_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("pdf_path", sa.String(500), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("certificate_number"),
        sa.ForeignKeyConstraint(["template_id"], ["certificate_templates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_clearance_certificates_program", "clearance_certificates", ["program_id"])
    op.create_index("ix_clearance_certificates_client", "clearance_certificates", ["client_id"])
    op.create_index("ix_clearance_certificates_status", "clearance_certificates", ["status"])
    op.create_index(
        "ix_clearance_certificates_type", "clearance_certificates", ["certificate_type"]
    )

    # Create clearance_certificate_history table
    op.create_table(
        "clearance_certificate_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("certificate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("from_status", sa.String(20), nullable=True),
        sa.Column("to_status", sa.String(20), nullable=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_name", sa.String(255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["certificate_id"], ["clearance_certificates.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index(
        "ix_certificate_history_certificate", "clearance_certificate_history", ["certificate_id"]
    )
    op.create_index(
        "ix_certificate_history_created", "clearance_certificate_history", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_certificate_history_created", table_name="clearance_certificate_history")
    op.drop_index("ix_certificate_history_certificate", table_name="clearance_certificate_history")
    op.drop_table("clearance_certificate_history")

    op.drop_index("ix_clearance_certificates_type", table_name="clearance_certificates")
    op.drop_index("ix_clearance_certificates_status", table_name="clearance_certificates")
    op.drop_index("ix_clearance_certificates_client", table_name="clearance_certificates")
    op.drop_index("ix_clearance_certificates_program", table_name="clearance_certificates")
    op.drop_table("clearance_certificates")

    op.drop_index("ix_certificate_templates_type", table_name="certificate_templates")
    op.drop_table("certificate_templates")
