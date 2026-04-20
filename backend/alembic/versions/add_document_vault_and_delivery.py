"""Add document vault fields and delivery tracking

Revision ID: add_document_vault_and_delivery
Revises: add_escalation_rules
Create Date: 2026-03-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_document_vault_and_delivery"
down_revision: str | Sequence[str] | None = "add_escalation_rules"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add vault fields to documents table
    op.add_column(
        "documents",
        sa.Column("vault_status", sa.String(20), nullable=False, server_default="active"),
    )
    op.add_column(
        "documents",
        sa.Column("sealed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("documents", sa.Column("sealed_by", sa.UUID(), nullable=True))
    op.add_column(
        "documents",
        sa.Column("retention_policy", sa.String(50), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column(
            "chain_of_custody",
            postgresql.JSON(),
            nullable=False,
            server_default="[]",
        ),
    )
    op.create_foreign_key(
        "fk_documents_sealed_by_users",
        "documents",
        "users",
        ["sealed_by"],
        ["id"],
    )

    # Create document_deliveries table
    op.create_table(
        "document_deliveries",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("recipient_id", sa.UUID(), nullable=False),
        sa.Column("delivery_method", sa.String(20), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("viewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("secure_link_token", sa.String(255), nullable=True),
        sa.Column("secure_link_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_deliveries_document", "document_deliveries", ["document_id"])
    op.create_index("ix_document_deliveries_recipient", "document_deliveries", ["recipient_id"])
    op.create_index(
        "ix_document_deliveries_token",
        "document_deliveries",
        ["secure_link_token"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("document_deliveries")
    op.drop_constraint("fk_documents_sealed_by_users", "documents", type_="foreignkey")
    op.drop_column("documents", "chain_of_custody")
    op.drop_column("documents", "retention_policy")
    op.drop_column("documents", "sealed_by")
    op.drop_column("documents", "sealed_at")
    op.drop_column("documents", "vault_status")
