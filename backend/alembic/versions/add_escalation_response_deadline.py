"""add_escalation_response_deadline

Revision ID: esc_response_deadline_01
Revises: ddc5d4fef8cd
Create Date: 2026-03-23 00:00:00.000000

Standalone migration: adds response_deadline and parent_escalation_id columns
to the escalations table. Uses down_revision=None because multiple heads exist.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "esc_response_deadline_01"
down_revision: str | Sequence[str] | None = "ddc5d4fef8cd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "escalations",
        sa.Column(
            "response_deadline",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "escalations",
        sa.Column(
            "parent_escalation_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_escalations_parent_escalation_id",
        "escalations",
        "escalations",
        ["parent_escalation_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_escalations_parent_escalation_id", "escalations", type_="foreignkey")
    op.drop_column("escalations", "parent_escalation_id")
    op.drop_column("escalations", "response_deadline")
