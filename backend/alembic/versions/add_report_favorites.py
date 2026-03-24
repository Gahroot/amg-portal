"""Add report_favorites JSON field to users table

Revision ID: add_report_favorites
Revises: add_document_expiry, a1b2c3d4e5f6
Create Date: 2026-03-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_report_favorites"
down_revision: tuple[str, ...] = ("add_document_expiry", "a1b2c3d4e5f6")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "report_favorites",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "report_favorites")
