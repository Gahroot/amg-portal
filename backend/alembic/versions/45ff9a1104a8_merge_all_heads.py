"""merge_all_heads

Revision ID: 45ff9a1104a8
Revises: add_api_keys, add_calendar_feed_tokens,
    add_deliverable_templates, add_partner_webhooks,
    add_portal_feedback, add_saved_filters,
    add_table_views, add_tax_documents
Create Date: 2026-03-24 09:23:06.319927

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "45ff9a1104a8"
down_revision: str | Sequence[str] | None = (
    "add_api_keys",
    "add_calendar_feed_tokens",
    "add_deliverable_templates",
    "add_partner_webhooks",
    "add_portal_feedback",
    "add_saved_filters",
    "add_table_views",
    "add_tax_documents",
)  # noqa: E501
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
