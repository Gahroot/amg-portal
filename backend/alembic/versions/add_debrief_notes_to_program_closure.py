"""Add debrief notes fields to program_closures table.

Revision ID: add_debrief_notes_to_program_closure
Revises: add_performance_notices
Create Date: 2026-03-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_debrief_notes_to_program_closure"
down_revision: str | Sequence[str] | None = "add_performance_notices"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "program_closures",
        sa.Column("debrief_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "program_closures",
        sa.Column("debrief_notes_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "program_closures",
        sa.Column(
            "debrief_notes_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "program_closures",
        sa.Column("debrief_notes_by_name", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("program_closures", "debrief_notes_by_name")
    op.drop_column("program_closures", "debrief_notes_by")
    op.drop_column("program_closures", "debrief_notes_at")
    op.drop_column("program_closures", "debrief_notes")
