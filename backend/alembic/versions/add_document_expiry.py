"""add document expiry tracking fields

Revision ID: add_document_expiry
Revises: add_partner_capacity, add_program_templates,
    add_recurring_tasks, add_onboarding_completed,
    add_task_dependencies, add_quiet_hours_fields,
    add_bookmarks, add_notification_snooze_fields
Create Date: 2026-03-23 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "add_document_expiry"
down_revision: tuple[str, ...] = (
    "add_partner_capacity",
    "add_program_templates",
    "add_recurring_tasks",
    "add_onboarding_completed",
    "add_task_dependencies",
    "add_quiet_hours_fields",
    "add_bookmarks",
    "add_notification_snooze_fields",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add expiry tracking columns to documents table."""
    op.add_column(
        "documents",
        sa.Column("document_type", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("expiry_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column(
            "expiry_alert_sent",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
    )
    op.create_index(
        "ix_documents_expiry_date",
        "documents",
        ["expiry_date"],
    )


def downgrade() -> None:
    """Remove expiry tracking columns from documents table."""
    op.drop_index("ix_documents_expiry_date", table_name="documents")
    op.drop_column("documents", "expiry_alert_sent")
    op.drop_column("documents", "expiry_date")
    op.drop_column("documents", "document_type")
