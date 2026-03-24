"""Add onboarding_completed JSON field to users table for tour tracking

Revision ID: add_onboarding_completed
Revises: add_recent_items
Create Date: 2026-03-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_onboarding_completed"
down_revision: str | Sequence[str] | None = "add_recent_items"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "onboarding_completed",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "onboarding_completed")
