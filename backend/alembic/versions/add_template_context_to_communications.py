"""add_template_context_to_communications

Revision ID: c2d3e4f5g6h7
Revises: b1c2d3e4f5g6
Create Date: 2026-03-15 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c2d3e4f5g6h7"
down_revision: str | Sequence[str] | None = "b1c2d3e4f5g6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add template_context JSON column to communications table."""
    op.add_column(
        "communications",
        sa.Column("template_context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    """Remove template_context column from communications table."""
    op.drop_column("communications", "template_context")
