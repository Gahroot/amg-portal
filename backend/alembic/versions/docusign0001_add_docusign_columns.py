"""add_docusign_columns

Revision ID: docusign0001
Revises: e45aa52d6fb7
Create Date: 2026-03-31 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "docusign0001"
down_revision: str | Sequence[str] | None = "e45aa52d6fb7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("envelope_id", sa.String(length=100), nullable=True))
    op.add_column("documents", sa.Column("docusign_status", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "docusign_status")
    op.drop_column("documents", "envelope_id")
