"""Add deletion_requests table for two-person authorization workflow.

Revision ID: add_two_person_delete
Revises: add_capability_review_access_audit
Create Date: 2026-03-15
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_two_person_delete"
down_revision: str | None = "add_capability_review_access_audit"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "deletion_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column(
            "requested_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=False,
        ),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column(
            "approved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_deletion_requests_status", "deletion_requests", ["status"]
    )
    op.create_index(
        "ix_deletion_requests_entity",
        "deletion_requests",
        ["entity_type", "entity_id"],
    )
    op.create_index(
        "ix_deletion_requests_requested_by",
        "deletion_requests",
        ["requested_by"],
    )


def downgrade() -> None:
    op.drop_index("ix_deletion_requests_requested_by", table_name="deletion_requests")
    op.drop_index("ix_deletion_requests_entity", table_name="deletion_requests")
    op.drop_index("ix_deletion_requests_status", table_name="deletion_requests")
    op.drop_table("deletion_requests")
