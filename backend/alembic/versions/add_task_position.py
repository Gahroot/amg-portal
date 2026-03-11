"""add task position field

Revision ID: add_task_position
Revises: b1c2d3e4f5g6
Create Date: 2025-01-11

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_task_position"
down_revision: Union[str, None] = "b1c2d3e4f5g6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add position column to tasks
    op.add_column("tasks", sa.Column("position", sa.Integer(), nullable=False, server_default="0"))
    
    # Add indexes for better query performance on the task board
    op.create_index("ix_tasks_status", "tasks", ["status"])
    op.create_index("ix_tasks_assigned_to", "tasks", ["assigned_to"])


def downgrade() -> None:
    op.drop_index("ix_tasks_assigned_to", table_name="tasks")
    op.drop_index("ix_tasks_status", table_name="tasks")
    op.drop_column("tasks", "position")
