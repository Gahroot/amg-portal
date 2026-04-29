"""add orphan tables (push, kyc, support, dashboard, partner_blocker)

Revision ID: add_orphan_tables
Revises: phase2_schema
Create Date: 2026-04-29 22:30:00.000000

ORM models for these tables exist in app/models/ but no migration was ever
written. They have been silently absent from production since the push-
notifications and KYC workflow features were merged. The notification fan-
out path on every create operation queries push_tokens; without the table,
every create endpoint that emits a notification 500s.

Tables added:
- push_tokens          (Expo push notification registration)
- kyc_verifications    (full KYC workflow per client)
- kyc_checks           (individual checks within a verification)
- kyc_alerts           (status/expiry alerts)
- kyc_reports          (compliance reports)
- dashboard_configs    (per-user widget layout)
- partner_blockers     (partner unavailability windows)
- support_conversations / support_messages /
  support_agent_statuses / support_offline_messages  (in-app support chat)

Idempotent: checks pg_tables before creating each table.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_orphan_tables"
down_revision: str | Sequence[str] | None = "phase2_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(table: str) -> bool:
    from sqlalchemy import inspect as sa_inspect

    bind = op.get_bind()
    return sa_inspect(bind).has_table(table)


def upgrade() -> None:
    if not _table_exists("push_tokens"):
        op.create_table(
            "push_tokens",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("token", sa.String(length=255), nullable=False, unique=True),
            sa.Column("platform", sa.String(length=20), nullable=False),
            sa.Column("device_name", sa.String(length=255), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
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
        op.create_index("ix_push_tokens_user_id", "push_tokens", ["user_id"])
        op.create_index("ix_push_tokens_token", "push_tokens", ["token"])

    if not _table_exists("kyc_verifications"):
        op.create_table(
            "kyc_verifications",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "client_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("clients.id"),
                nullable=False,
            ),
            sa.Column(
                "status",
                sa.String(length=20),
                nullable=False,
                server_default=sa.text("'draft'"),
            ),
            sa.Column(
                "verification_type",
                sa.String(length=20),
                nullable=False,
                server_default=sa.text("'standard'"),
            ),
            sa.Column("risk_level", sa.String(length=20), nullable=True),
            sa.Column("risk_assessment", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("expires_at", sa.Date(), nullable=True),
            sa.Column(
                "reviewed_by",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=True,
            ),
            sa.Column("review_notes", sa.Text(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column(
                "created_by",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
        )
        op.create_index(
            "ix_kyc_verifications_client_id", "kyc_verifications", ["client_id"]
        )
        op.create_index("ix_kyc_verifications_status", "kyc_verifications", ["status"])

    if not _table_exists("kyc_checks"):
        op.create_table(
            "kyc_checks",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "verification_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("kyc_verifications.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("check_type", sa.String(length=30), nullable=False),
            sa.Column(
                "status",
                sa.String(length=20),
                nullable=False,
                server_default=sa.text("'pending'"),
            ),
            sa.Column("provider", sa.String(length=100), nullable=True),
            sa.Column("external_reference", sa.String(length=255), nullable=True),
            sa.Column("result_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("risk_score", sa.Integer(), nullable=True),
            sa.Column("match_details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "checked_by",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=True,
            ),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
        )
        op.create_index("ix_kyc_checks_verification_id", "kyc_checks", ["verification_id"])

    if not _table_exists("kyc_alerts"):
        op.create_table(
            "kyc_alerts",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "client_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("clients.id"),
                nullable=False,
            ),
            sa.Column(
                "verification_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("kyc_verifications.id"),
                nullable=True,
            ),
            sa.Column(
                "kyc_document_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("kyc_documents.id"),
                nullable=True,
            ),
            sa.Column("alert_type", sa.String(length=30), nullable=False),
            sa.Column(
                "severity",
                sa.String(length=20),
                nullable=False,
                server_default=sa.text("'warning'"),
            ),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column(
                "is_read", sa.Integer(), nullable=False, server_default=sa.text("0")
            ),
            sa.Column(
                "is_resolved", sa.Integer(), nullable=False, server_default=sa.text("0")
            ),
            sa.Column(
                "resolved_by",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=True,
            ),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("resolution_notes", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
        )
        op.create_index("ix_kyc_alerts_client_id", "kyc_alerts", ["client_id"])

    if not _table_exists("kyc_reports"):
        op.create_table(
            "kyc_reports",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "client_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("clients.id"),
                nullable=True,
            ),
            sa.Column(
                "verification_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("kyc_verifications.id"),
                nullable=True,
            ),
            sa.Column("report_type", sa.String(length=30), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("period_start", sa.Date(), nullable=True),
            sa.Column("period_end", sa.Date(), nullable=True),
            sa.Column(
                "status",
                sa.String(length=20),
                nullable=False,
                server_default=sa.text("'pending'"),
            ),
            sa.Column("file_path", sa.String(length=500), nullable=True),
            sa.Column("file_name", sa.String(length=255), nullable=True),
            sa.Column("summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "generated_by",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=True,
            ),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
        )
        op.create_index("ix_kyc_reports_client_id", "kyc_reports", ["client_id"])

    if not _table_exists("dashboard_configs"):
        op.create_table(
            "dashboard_configs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
            ),
            sa.Column(
                "widgets", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")
            ),
            sa.Column(
                "layout_mode",
                sa.String(length=20),
                nullable=False,
                server_default=sa.text("'grid'"),
            ),
            sa.Column(
                "columns", sa.Integer(), nullable=False, server_default=sa.text("2")
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

    if not _table_exists("partner_blockers"):
        op.create_table(
            "partner_blockers",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "partner_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("partner_profiles.id"),
                nullable=False,
            ),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("reason", sa.String(length=255), nullable=True),
            sa.Column(
                "blocker_type",
                sa.String(length=50),
                nullable=False,
                server_default=sa.text("'other'"),
            ),
            sa.Column(
                "is_recurring", sa.Boolean(), nullable=False, server_default=sa.false()
            ),
            sa.Column("recurrence_type", sa.String(length=20), nullable=True),
            sa.Column("recurrence_days", sa.JSON(), nullable=True),
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
        op.create_index(
            "ix_partner_blockers_partner_id", "partner_blockers", ["partner_id"]
        )

    if not _table_exists("support_conversations"):
        op.create_table(
            "support_conversations",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "status",
                sa.String(length=50),
                nullable=False,
                server_default=sa.text("'open'"),
            ),
            sa.Column(
                "priority",
                sa.String(length=50),
                nullable=False,
                server_default=sa.text("'normal'"),
            ),
            sa.Column("subject", sa.String(length=500), nullable=True),
            sa.Column(
                "assigned_agent_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_message_preview", sa.Text(), nullable=True),
            sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "closed_by",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("satisfaction_rating", sa.Integer(), nullable=True),
            sa.Column("satisfaction_comment", sa.Text(), nullable=True),
            sa.Column("extra_data", sa.JSON(), nullable=True),
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

    if not _table_exists("support_messages"):
        op.create_table(
            "support_messages",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "conversation_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("support_conversations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "sender_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("sender_type", sa.String(length=50), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("attachment_ids", sa.JSON(), nullable=True),
            sa.Column(
                "is_internal", sa.Boolean(), nullable=False, server_default=sa.false()
            ),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("read_by_user_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("read_by_agent_at", sa.DateTime(timezone=True), nullable=True),
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
        op.create_index(
            "ix_support_messages_conversation_id",
            "support_messages",
            ["conversation_id"],
        )

    if not _table_exists("support_agent_statuses"):
        op.create_table(
            "support_agent_statuses",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
            ),
            sa.Column(
                "is_online", sa.Boolean(), nullable=False, server_default=sa.false()
            ),
            sa.Column(
                "status",
                sa.String(length=50),
                nullable=False,
                server_default=sa.text("'offline'"),
            ),
            sa.Column(
                "active_conversations",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column(
                "max_conversations",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("5"),
            ),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
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

    if not _table_exists("support_offline_messages"):
        op.create_table(
            "support_offline_messages",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("subject", sa.String(length=500), nullable=True),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column(
                "processed", sa.Boolean(), nullable=False, server_default=sa.false()
            ),
            sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "processed_by",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "created_conversation_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("support_conversations.id", ondelete="SET NULL"),
                nullable=True,
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


def downgrade() -> None:
    for table in (
        "support_offline_messages",
        "support_agent_statuses",
        "support_messages",
        "support_conversations",
        "partner_blockers",
        "dashboard_configs",
        "kyc_reports",
        "kyc_alerts",
        "kyc_checks",
        "kyc_verifications",
        "push_tokens",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
