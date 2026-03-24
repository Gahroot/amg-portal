"""add_security_profile_level

Revision ID: add_security_profile_level
Revises: 8f6a47efa18a, d4e5f6a7b8c9
Create Date: 2026-03-15 12:00:00.000000

Adds security_profile_level column to client_profiles to support the
Phase 2 Security & Intelligence Feeds integration.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_security_profile_level"
down_revision: str | Sequence[str] | None = ("8f6a47efa18a", "d4e5f6a7b8c9")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "client_profiles",
        sa.Column(
            "security_profile_level",
            sa.String(length=50),
            nullable=False,
            server_default="standard",
        ),
    )


def downgrade() -> None:
    op.drop_column("client_profiles", "security_profile_level")
