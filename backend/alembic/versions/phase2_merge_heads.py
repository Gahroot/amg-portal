"""merge phase1 heads for phase 2

Revision ID: phase2_merge
Revises: enc_client_pii_01, restrict_audit_perms
Create Date: 2026-04-20 00:00:00.000000

Merges the two Phase 1 heads (column encryption + audit role restriction)
so Phase 2 migrations stack on a single chain.
"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "phase2_merge"
down_revision: str | Sequence[str] | None = (
    "enc_client_pii_01",
    "restrict_audit_perms",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
