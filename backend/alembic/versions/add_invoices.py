"""add_invoices

Revision ID: add_invoices
Revises: add_calendar_event_id, add_predicted_risks
Create Date: 2026-03-20 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_invoices"
down_revision: str | Sequence[str] | None = ("add_calendar_event_id", "add_predicted_risks")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema: add invoices table."""
    op.create_table(
        "invoices",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column("program_id", sa.UUID(), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invoices_client_id"), "invoices", ["client_id"], unique=False)
    op.create_index(op.f("ix_invoices_program_id"), "invoices", ["program_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema: remove invoices table."""
    op.drop_index(op.f("ix_invoices_program_id"), table_name="invoices")
    op.drop_index(op.f("ix_invoices_client_id"), table_name="invoices")
    op.drop_table("invoices")
