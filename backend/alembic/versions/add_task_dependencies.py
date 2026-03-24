"""add task dependencies

Revision ID: add_task_dependencies
Revises: add_client_dates
Create Date: 2026-03-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_task_dependencies"
down_revision: str | None = "add_client_dates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "depends_on",
            ARRAY(UUID(as_uuid=True)),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("tasks", "depends_on")
