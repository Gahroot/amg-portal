"""merge_multiple_heads

Revision ID: bca21ac73c26
Revises: 52aacd4f3335, notif_indexes_01
Create Date: 2026-04-03 16:17:21.231384

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "bca21ac73c26"
down_revision: str | Sequence[str] | None = ("52aacd4f3335", "notif_indexes_01")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
