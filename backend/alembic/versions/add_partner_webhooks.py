"""Add webhooks and webhook_deliveries tables for partner webhook configuration.

Revision ID: add_partner_webhooks
Revises: add_partner_payments
Create Date: 2026-03-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "add_partner_webhooks"
down_revision: str = "add_partner_payments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create webhooks table
    op.create_table(
        "webhooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("partner_profiles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("secret", sa.String(100), nullable=False),
        sa.Column("events", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # Create index on partner_id and is_active for active webhook queries
    op.create_index(
        "ix_webhooks_partner_active",
        "webhooks",
        ["partner_id", "is_active"],
    )

    # Create webhook_deliveries table
    op.create_table(
        "webhook_deliveries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "webhook_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("webhooks.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("response_body", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("attempt_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # Create index on webhook_id and created_at for delivery log queries
    op.create_index(
        "ix_webhook_deliveries_webhook_created",
        "webhook_deliveries",
        ["webhook_id", "created_at"],
    )

    # Create index on success for filtering failed deliveries
    op.create_index(
        "ix_webhook_deliveries_success",
        "webhook_deliveries",
        ["success"],
    )


def downgrade() -> None:
    op.drop_index("ix_webhook_deliveries_success", table_name="webhook_deliveries")
    op.drop_index("ix_webhook_deliveries_webhook_created", table_name="webhook_deliveries")
    op.drop_table("webhook_deliveries")
    op.drop_index("ix_webhooks_partner_active", table_name="webhooks")
    op.drop_table("webhooks")
