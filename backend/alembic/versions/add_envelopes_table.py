"""add_envelopes_table

Revision ID: add_envelopes_table
Revises: 612587a645d0
Create Date: 2026-03-12 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_envelopes_table"
down_revision: str | Sequence[str] | None = "612587a645d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "envelopes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("document_id", UUID(as_uuid=True), nullable=True),
        sa.Column("envelope_id", sa.String(100), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="created"),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("recipients", JSON(), nullable=False, server_default="[]"),
        sa.Column("sender_name", sa.String(255), nullable=True),
        sa.Column("sender_email", sa.String(255), nullable=True),
        sa.Column("voided_reason", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.Index("ix_envelopes_document_id", "document_id"),
        sa.Index("ix_envelopes_envelope_id", "envelope_id"),
        sa.Index("ix_envelopes_status", "status"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("envelopes")
