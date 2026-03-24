"""Add document_requests table.

Revision ID: a1b2c3d4e5f6
Revises: ddc5d4fef8cd
Create Date: 2026-03-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "ddc5d4fef8cd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("client_profiles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "requested_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=False,
        ),
        sa.Column("document_type", sa.String(50), nullable=False, server_default="other"),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="pending", index=True
        ),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "fulfilled_document_id",
            UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
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
    op.drop_table("document_requests")
