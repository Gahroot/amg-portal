"""add_brief_pdf_path to partner_assignments

Revision ID: add_brief_pdf_path
Revises: add_invoices
Create Date: 2026-03-20 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_brief_pdf_path"
down_revision: str | Sequence[str] | None = "add_invoices"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "partner_assignments",
        sa.Column("brief_pdf_path", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("partner_assignments", "brief_pdf_path")
