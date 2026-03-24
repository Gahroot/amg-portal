"""add_calendar_event_id_to_milestones

Adds calendar_event_id column to milestones table for storing the Google Calendar
event ID after pushing a milestone to Google Calendar.

Revision ID: add_calendar_event_id
Revises: add_communication_audits, add_partner_governance, add_status_to_communication_template
Create Date: 2026-03-20

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_calendar_event_id"
down_revision: str | Sequence[str] | None = (
    "add_communication_audits",
    "add_partner_governance",
    "add_status_to_communication_template",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "milestones",
        sa.Column("calendar_event_id", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("milestones", "calendar_event_id")
