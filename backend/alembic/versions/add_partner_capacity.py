"""Add partner capacity fields and blocked dates table.

Revision ID: add_partner_capacity
Revises: add_partner_governance
Create Date: 2026-03-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_partner_capacity"
down_revision: str | Sequence[str] | None = "add_partner_governance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add max_concurrent_assignments to partner_profiles
    op.add_column(
        "partner_profiles",
        sa.Column(
            "max_concurrent_assignments",
            sa.Integer(),
            nullable=False,
            server_default="5",
        ),
    )

    # Create partner_blocked_dates table
    op.create_table(
        "partner_blocked_dates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocked_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(255), nullable=True),
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
        sa.ForeignKeyConstraint(["partner_id"], ["partner_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
    )
    op.create_index(
        "ix_partner_blocked_dates_partner_id",
        "partner_blocked_dates",
        ["partner_id"],
    )
    op.create_index(
        "ix_partner_blocked_dates_blocked_date",
        "partner_blocked_dates",
        ["blocked_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_partner_blocked_dates_blocked_date", table_name="partner_blocked_dates")
    op.drop_index("ix_partner_blocked_dates_partner_id", table_name="partner_blocked_dates")
    op.drop_table("partner_blocked_dates")
    op.drop_column("partner_profiles", "max_concurrent_assignments")
