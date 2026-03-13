"""merge_multiple_heads

Revision ID: 0b71f652cf57
Revises: see down_revision tuple
Create Date: 2026-03-12 16:48:01.145243

"""
from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = '0b71f652cf57'
down_revision: str | Sequence[str] | None = (
    'add_budget_approval_routing',
    'add_capability_review_access_audit',
    'add_clearance_certificates',
    'add_envelopes_table',
    'add_nps_surveys',
    'add_quiet_hours_notif',
    'add_task_position',
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
