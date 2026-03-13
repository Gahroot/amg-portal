"""Add client_profile_id to clearance_certificates and make client_id nullable

Revision ID: a1b2c3d4e5f6
Revises: 6e2b7519b293
Create Date: 2026-03-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "6e2b7519b293"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Make client_id nullable for certificates generated from client profiles
    op.alter_column(
        "clearance_certificates",
        "client_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )

    # Add client_profile_id FK for compliance-workflow-generated certificates
    op.add_column(
        "clearance_certificates",
        sa.Column("client_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_clearance_certificates_client_profile",
        "clearance_certificates",
        "client_profiles",
        ["client_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_clearance_certificates_client_profile",
        "clearance_certificates",
        ["client_profile_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_clearance_certificates_client_profile",
        table_name="clearance_certificates",
    )
    op.drop_constraint(
        "fk_clearance_certificates_client_profile",
        "clearance_certificates",
        type_="foreignkey",
    )
    op.drop_column("clearance_certificates", "client_profile_id")

    op.alter_column(
        "clearance_certificates",
        "client_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
