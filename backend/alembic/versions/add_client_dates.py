"""Add birth_date, important_dates, and birthday_reminders_enabled to client_profiles.

Revision ID: add_client_dates
Revises: add_predicted_risks
Create Date: 2026-03-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "add_client_dates"
down_revision = "add_predicted_risks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "client_profiles",
        sa.Column("birth_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "client_profiles",
        sa.Column("important_dates", JSONB, nullable=True),
    )
    op.add_column(
        "client_profiles",
        sa.Column(
            "birthday_reminders_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
    )


def downgrade() -> None:
    op.drop_column("client_profiles", "birthday_reminders_enabled")
    op.drop_column("client_profiles", "important_dates")
    op.drop_column("client_profiles", "birth_date")
