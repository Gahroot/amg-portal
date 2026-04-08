"""Add document_shares table for secure, time-limited document sharing.

Revision ID: add_document_shares
Revises: add_escalation_templates, add_approval_comments, add_escalation_playbooks,
         add_milestone_reminder_preferences, add_pulse_surveys
Create Date: 2026-03-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "add_document_shares"
down_revision: tuple[str, ...] = (
    "add_escalation_templates",
    "add_approval_comments",
    "add_escalation_playbooks",
    "add_milestone_reminder_preferences",
    "add_pulse_surveys",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "document_shares",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "document_id",
            sa.UUID(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "shared_by",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("shared_with_email", sa.String(length=255), nullable=False),
        sa.Column("access_level", sa.String(length=20), nullable=False, server_default="view"),
        sa.Column("share_token", sa.String(length=64), nullable=False),
        sa.Column("verification_code_hash", sa.String(length=255), nullable=True),
        sa.Column("verification_code_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("access_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "revoked_by",
            sa.UUID(),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("share_token"),
    )
    op.create_index("ix_document_shares_document_id", "document_shares", ["document_id"])
    op.create_index("ix_document_shares_share_token", "document_shares", ["share_token"])
    op.create_index("ix_document_shares_shared_with_email", "document_shares", ["shared_with_email"])


def downgrade() -> None:
    op.drop_index("ix_document_shares_shared_with_email", table_name="document_shares")
    op.drop_index("ix_document_shares_share_token", table_name="document_shares")
    op.drop_index("ix_document_shares_document_id", table_name="document_shares")
    op.drop_table("document_shares")
