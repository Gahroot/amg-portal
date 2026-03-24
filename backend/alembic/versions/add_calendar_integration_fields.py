"""add_calendar_integration_fields

Revision ID: d4e5f6a7b8c9
Revises: add_travel_bookings
Create Date: 2026-03-15 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "add_travel_bookings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("google_calendar_token", sa.JSON(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("outlook_calendar_token", sa.JSON(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "calendar_last_synced_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "calendar_last_synced_at")
    op.drop_column("users", "outlook_calendar_token")
    op.drop_column("users", "google_calendar_token")
