"""Add quiet hours fields to notification_preferences.

Revision ID: add_quiet_hours_fields
Revises: add_compliance_certificate_to_profile
Create Date: 2026-03-22

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_quiet_hours_fields"
down_revision: str | Sequence[str] | None = "add_compliance_certificate_to_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add quiet hours fields to notification_preferences table."""
    op.add_column(
        "notification_preferences",
        sa.Column(
            "quiet_hours_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("quiet_hours_start", sa.Time(), nullable=True),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("quiet_hours_end", sa.Time(), nullable=True),
    )
    op.add_column(
        "notification_preferences",
        sa.Column(
            "timezone",
            sa.String(50),
            nullable=False,
            server_default="UTC",
        ),
    )


def downgrade() -> None:
    """Remove quiet hours fields from notification_preferences table."""
    op.drop_column("notification_preferences", "timezone")
    op.drop_column("notification_preferences", "quiet_hours_end")
    op.drop_column("notification_preferences", "quiet_hours_start")
    op.drop_column("notification_preferences", "quiet_hours_enabled")
