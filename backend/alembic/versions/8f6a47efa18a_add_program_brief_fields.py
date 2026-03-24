"""add_program_brief_fields

Revision ID: 8f6a47efa18a
Revises: ab4b71a8d1a4, add_budget_approval_routing, add_capability_refresh_fields,
         add_clearance_certificates, add_document_acknowledgments, add_program_archival,
         add_task_position, c2d3e4f5g6h7
Create Date: 2026-03-15

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8f6a47efa18a"
down_revision: tuple[str, ...] = (
    "ab4b71a8d1a4",
    "add_budget_approval_routing",
    "add_capability_refresh_fields",
    "add_clearance_certificates",
    "add_document_acknowledgments",
    "add_program_archival",
    "add_task_position",
    "c2d3e4f5g6h7",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("programs", sa.Column("brief_content", sa.Text(), nullable=True))
    op.add_column(
        "programs",
        sa.Column(
            "brief_visible_to_client",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "programs",
        sa.Column("brief_shared_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("programs", "brief_shared_at")
    op.drop_column("programs", "brief_visible_to_client")
    op.drop_column("programs", "brief_content")
