"""add_document_acknowledgments

Revision ID: add_document_acknowledgments
Revises: ddc5d4fef8cd
Create Date: 2026-03-15 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_document_acknowledgments"
down_revision: str | Sequence[str] | None = "ddc5d4fef8cd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "document_acknowledgments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("signer_name", sa.String(255), nullable=False),
        sa.Column(
            "acknowledged_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
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


def downgrade() -> None:
    op.drop_index("ix_document_acknowledgments_user_id", table_name="document_acknowledgments")
    op.drop_index(
        "ix_document_acknowledgments_document_id", table_name="document_acknowledgments"
    )
    op.drop_table("document_acknowledgments")
