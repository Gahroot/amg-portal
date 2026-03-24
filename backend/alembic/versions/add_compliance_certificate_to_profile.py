"""add compliance_certificate_id and compliance_certificate_path to client_profiles

Revision ID: add_compliance_certificate_to_profile
Revises: add_brief_pdf_path
Create Date: 2026-03-20 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_compliance_certificate_to_profile"
down_revision: str | Sequence[str] | None = "add_brief_pdf_path"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "client_profiles",
        sa.Column(
            "compliance_certificate_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("clearance_certificates.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "client_profiles",
        sa.Column("compliance_certificate_path", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("client_profiles", "compliance_certificate_path")
    op.drop_column("client_profiles", "compliance_certificate_id")
