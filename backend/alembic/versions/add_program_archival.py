"""Add archived_at to programs table for data retention / archival.

Revision ID: add_program_archival
Revises: add_last_login_at
Create Date: 2026-03-15 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_program_archival"
down_revision: str | None = "add_last_login_at"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "programs",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("programs", "archived_at")
