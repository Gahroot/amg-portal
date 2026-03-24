"""Add capability refresh tracking fields to partner_profiles.

Revision ID: add_capability_refresh_fields
Revises: add_emergency_activation_fields
Create Date: 2026-03-15

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_capability_refresh_fields"
down_revision: str | Sequence[str] | None = "add_emergency_activation_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add last_refreshed_at and refresh_due_at to partner_profiles."""
    op.add_column(
        "partner_profiles",
        sa.Column("last_refreshed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "partner_profiles",
        sa.Column("refresh_due_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Remove capability refresh fields from partner_profiles."""
    op.drop_column("partner_profiles", "refresh_due_at")
    op.drop_column("partner_profiles", "last_refreshed_at")
