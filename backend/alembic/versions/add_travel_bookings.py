"""add_travel_bookings

Revision ID: add_travel_bookings
Revises: add_performance_notices
Create Date: 2026-03-15 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_travel_bookings"
down_revision: str | Sequence[str] | None = "add_performance_notices"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema: add travel_bookings table."""
    op.create_table(
        "travel_bookings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("program_id", sa.UUID(), nullable=False),
        sa.Column("booking_ref", sa.String(length=100), nullable=False),
        sa.Column("vendor", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("departure_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("arrival_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("passengers", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("details", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="confirmed"),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("raw_data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["program_id"],
            ["programs.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_travel_bookings_program_id"),
        "travel_bookings",
        ["program_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema: remove travel_bookings table."""
    op.drop_index(op.f("ix_travel_bookings_program_id"), table_name="travel_bookings")
    op.drop_table("travel_bookings")
