"""Add external_crm_id to client_profiles.

Revision ID: 26c8826e1798
Revises: a1b2c3d4e5f6
Create Date: 2026-03-13 00:00:00.000000
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "26c8826e1798"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "client_profiles",
        sa.Column("external_crm_id", sa.String(255), nullable=True),
    )
    op.create_index(
        "ix_client_profiles_external_crm_id",
        "client_profiles",
        ["external_crm_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_client_profiles_external_crm_id", table_name="client_profiles")
    op.drop_column("client_profiles", "external_crm_id")
