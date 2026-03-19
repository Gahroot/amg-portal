"""Add partner_governance table for governance actions tracking.

Revision ID: add_partner_governance
Revises: add_performance_notices
Create Date: 2026-03-19

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_partner_governance"
down_revision: str | Sequence[str] | None = "add_performance_notices"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "partner_governance",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("evidence", postgresql.JSON(), nullable=True),
        sa.Column(
            "effective_date",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expiry_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("issued_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["partner_id"], ["partner_profiles.id"]),
        sa.ForeignKeyConstraint(["issued_by"], ["users.id"]),
    )
    op.create_index(
        "ix_partner_governance_partner_id",
        "partner_governance",
        ["partner_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_partner_governance_partner_id", table_name="partner_governance")
    op.drop_table("partner_governance")
