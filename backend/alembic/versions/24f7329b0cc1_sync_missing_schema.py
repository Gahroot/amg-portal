"""sync_missing_schema

Revision ID: 24f7329b0cc1
Revises: add_security_profile_level
Create Date: 2026-03-16 09:30:45.001273

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "24f7329b0cc1"
down_revision: str | Sequence[str] | None = "add_security_profile_level"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_exists(table: str, column: str) -> bool:
    """Check if a column already exists (for idempotency)."""
    from sqlalchemy import inspect as sa_inspect

    bind = op.get_bind()
    inspector = sa_inspect(bind)
    columns = [c["name"] for c in inspector.get_columns(table)]
    return column in columns


def _table_exists(table: str) -> bool:
    """Check if a table already exists."""
    from sqlalchemy import inspect as sa_inspect

    bind = op.get_bind()
    inspector = sa_inspect(bind)
    return table in inspector.get_table_names()


def upgrade() -> None:  # noqa: PLR0912, PLR0915
    """Add missing columns and tables to sync DB with models."""

    # --- New tables ---
    if not _table_exists("document_acknowledgments"):
        op.create_table(
            "document_acknowledgments",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("document_id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("signer_name", sa.String(length=255), nullable=False),
            sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_document_acknowledgments_document_id",
            "document_acknowledgments",
            ["document_id"],
        )
        op.create_index(
            "ix_document_acknowledgments_user_id",
            "document_acknowledgments",
            ["user_id"],
        )

    if not _table_exists("family_members"):
        op.create_table(
            "family_members",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("client_profile_id", sa.UUID(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("relationship_type", sa.String(length=50), nullable=False),
            sa.Column("date_of_birth", sa.DateTime(timezone=True), nullable=True),
            sa.Column("occupation", sa.String(length=255), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("is_primary_contact", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["client_profile_id"], ["client_profiles.id"], ondelete="CASCADE"
            ),  # noqa: E501
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_family_members_client_profile_id",
            "family_members",
            ["client_profile_id"],
        )

    if not _table_exists("family_relationships"):
        op.create_table(
            "family_relationships",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("from_member_id", sa.UUID(), nullable=False),
            sa.Column("to_member_id", sa.UUID(), nullable=False),
            sa.Column("relationship_type", sa.String(length=50), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["from_member_id"], ["family_members.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["to_member_id"], ["family_members.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_family_relationships_from_member_id",
            "family_relationships",
            ["from_member_id"],
        )
        op.create_index(
            "ix_family_relationships_to_member_id",
            "family_relationships",
            ["to_member_id"],
        )

    if not _table_exists("performance_notices"):
        op.create_table(
            "performance_notices",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("partner_id", sa.UUID(), nullable=False),
            sa.Column("program_id", sa.UUID(), nullable=True),
            sa.Column("issued_by", sa.UUID(), nullable=False),
            sa.Column("notice_type", sa.String(length=50), nullable=False),
            sa.Column("severity", sa.String(length=50), nullable=False),
            sa.Column("title", sa.String(length=500), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("required_action", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["issued_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["partner_id"], ["partner_profiles.id"]),
            sa.ForeignKeyConstraint(["program_id"], ["programs.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_performance_notices_partner_id", "performance_notices", ["partner_id"])
        op.create_index("ix_performance_notices_program_id", "performance_notices", ["program_id"])

    if not _table_exists("travel_bookings"):
        op.create_table(
            "travel_bookings",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("program_id", sa.UUID(), nullable=False),
            sa.Column("booking_ref", sa.String(length=100), nullable=False),
            sa.Column("vendor", sa.String(length=255), nullable=False),
            sa.Column("type", sa.String(length=30), nullable=False),
            sa.Column("departure_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("arrival_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("passengers", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("details", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("source", sa.String(length=20), nullable=False),
            sa.Column("raw_data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("created_by", sa.UUID(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["program_id"], ["programs.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_travel_bookings_program_id", "travel_bookings", ["program_id"])

    # --- Missing columns on existing tables ---
    if not _column_exists("users", "last_login_at"):
        op.add_column(
            "users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True)
        )  # noqa: E501
    if not _column_exists("users", "google_calendar_token"):
        op.add_column(
            "users",
            sa.Column(
                "google_calendar_token", postgresql.JSON(astext_type=sa.Text()), nullable=True
            ),
        )  # noqa: E501
    if not _column_exists("users", "outlook_calendar_token"):
        op.add_column(
            "users",
            sa.Column(
                "outlook_calendar_token", postgresql.JSON(astext_type=sa.Text()), nullable=True
            ),
        )  # noqa: E501
    if not _column_exists("users", "calendar_last_synced_at"):
        op.add_column(
            "users", sa.Column("calendar_last_synced_at", sa.DateTime(timezone=True), nullable=True)
        )  # noqa: E501

    if not _column_exists("client_profiles", "security_profile_level"):
        op.add_column(
            "client_profiles",
            sa.Column(
                "security_profile_level",
                sa.String(length=50),
                server_default="standard",
                nullable=False,
            ),
        )  # noqa: E501

    if not _column_exists("communications", "template_context"):
        op.add_column("communications", sa.Column("template_context", sa.JSON(), nullable=True))

    if not _column_exists("partner_profiles", "last_refreshed_at"):
        op.add_column(
            "partner_profiles",
            sa.Column("last_refreshed_at", sa.DateTime(timezone=True), nullable=True),
        )  # noqa: E501
    if not _column_exists("partner_profiles", "refresh_due_at"):
        op.add_column(
            "partner_profiles",
            sa.Column("refresh_due_at", sa.DateTime(timezone=True), nullable=True),
        )  # noqa: E501

    if not _column_exists("program_closures", "debrief_notes"):
        op.add_column("program_closures", sa.Column("debrief_notes", sa.Text(), nullable=True))
    if not _column_exists("program_closures", "debrief_notes_at"):
        op.add_column(
            "program_closures",
            sa.Column("debrief_notes_at", sa.DateTime(timezone=True), nullable=True),
        )  # noqa: E501
    if not _column_exists("program_closures", "debrief_notes_by"):
        op.add_column("program_closures", sa.Column("debrief_notes_by", sa.UUID(), nullable=True))
        op.create_foreign_key(
            "fk_program_closures_debrief_notes_by",
            "program_closures",
            "users",
            ["debrief_notes_by"],
            ["id"],
        )  # noqa: E501
    if not _column_exists("program_closures", "debrief_notes_by_name"):
        op.add_column(
            "program_closures",
            sa.Column("debrief_notes_by_name", sa.String(length=255), nullable=True),
        )  # noqa: E501

    if not _column_exists("programs", "archived_at"):
        op.add_column(
            "programs", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True)
        )  # noqa: E501
    if not _column_exists("programs", "emergency_reason"):
        op.add_column("programs", sa.Column("emergency_reason", sa.Text(), nullable=True))
    if not _column_exists("programs", "retrospective_due_at"):
        op.add_column(
            "programs", sa.Column("retrospective_due_at", sa.DateTime(timezone=True), nullable=True)
        )  # noqa: E501
    if not _column_exists("programs", "brief_content"):
        op.add_column("programs", sa.Column("brief_content", sa.Text(), nullable=True))
    if not _column_exists("programs", "brief_visible_to_client"):
        op.add_column(
            "programs",
            sa.Column(
                "brief_visible_to_client", sa.Boolean(), server_default="false", nullable=False
            ),
        )  # noqa: E501
    if not _column_exists("programs", "brief_shared_at"):
        op.add_column(
            "programs", sa.Column("brief_shared_at", sa.DateTime(timezone=True), nullable=True)
        )  # noqa: E501

    # deletion_requests: add missing timestamp columns
    if not _column_exists("deletion_requests", "requested_at"):
        op.add_column(
            "deletion_requests",
            sa.Column("requested_at", sa.DateTime(timezone=True), nullable=True),
        )  # noqa: E501
    if not _column_exists("deletion_requests", "approved_at"):
        op.add_column(
            "deletion_requests", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True)
        )  # noqa: E501
    if not _column_exists("deletion_requests", "executed_at"):
        op.add_column(
            "deletion_requests", sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True)
        )  # noqa: E501


def downgrade() -> None:
    """Remove added columns and tables."""
    op.drop_column("users", "calendar_last_synced_at")
    op.drop_column("users", "outlook_calendar_token")
    op.drop_column("users", "google_calendar_token")
    op.drop_column("users", "last_login_at")
    op.drop_column("client_profiles", "security_profile_level")
    op.drop_column("communications", "template_context")
    op.drop_column("partner_profiles", "refresh_due_at")
    op.drop_column("partner_profiles", "last_refreshed_at")
    op.drop_column("program_closures", "debrief_notes_by_name")
    op.drop_constraint(
        "fk_program_closures_debrief_notes_by", "program_closures", type_="foreignkey"
    )  # noqa: E501
    op.drop_column("program_closures", "debrief_notes_by")
    op.drop_column("program_closures", "debrief_notes_at")
    op.drop_column("program_closures", "debrief_notes")
    op.drop_column("programs", "brief_shared_at")
    op.drop_column("programs", "brief_visible_to_client")
    op.drop_column("programs", "brief_content")
    op.drop_column("programs", "retrospective_due_at")
    op.drop_column("programs", "emergency_reason")
    op.drop_column("programs", "archived_at")
    op.drop_column("deletion_requests", "executed_at")
    op.drop_column("deletion_requests", "approved_at")
    op.drop_column("deletion_requests", "requested_at")
    op.drop_table("travel_bookings")
    op.drop_table("performance_notices")
    op.drop_index("ix_family_relationships_to_member_id", table_name="family_relationships")
    op.drop_index("ix_family_relationships_from_member_id", table_name="family_relationships")
    op.drop_table("family_relationships")
    op.drop_index("ix_family_members_client_profile_id", table_name="family_members")
    op.drop_table("family_members")
    op.drop_index("ix_document_acknowledgments_user_id", table_name="document_acknowledgments")
    op.drop_index("ix_document_acknowledgments_document_id", table_name="document_acknowledgments")
    op.drop_table("document_acknowledgments")
