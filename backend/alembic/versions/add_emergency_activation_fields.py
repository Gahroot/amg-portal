"""Add emergency_reason and retrospective_due_at to programs.

Revision ID: add_emergency_activation_fields
Revises: add_debrief_notes_to_program_closure
Create Date: 2026-03-15

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_emergency_activation_fields"
down_revision: str | Sequence[str] | None = "add_debrief_notes_to_program_closure"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "programs",
        sa.Column("emergency_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "programs",
        sa.Column(
            "retrospective_due_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("programs", "retrospective_due_at")
    op.drop_column("programs", "emergency_reason")
