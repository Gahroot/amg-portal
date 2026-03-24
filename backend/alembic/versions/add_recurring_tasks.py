"""Add recurring task templates and link to tasks.

Revision ID: add_recurring_tasks
Revises: add_client_dates
Create Date: 2026-03-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "add_recurring_tasks"
down_revision = "add_client_dates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recurring_task_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("rrule", sa.String(500), nullable=False),
        sa.Column("milestone_id", UUID(as_uuid=True), nullable=True),
        sa.Column("assignee_id", UUID(as_uuid=True), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("task_title_template", sa.String(255), nullable=False),
        sa.Column("task_description", sa.Text, nullable=True),
        sa.Column("next_due_date", sa.Date, nullable=True),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["milestone_id"],
            ["milestones.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["assignee_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
    )

    op.create_index(
        "ix_recurring_task_templates_next_due_date",
        "recurring_task_templates",
        ["next_due_date"],
    )
    op.create_index(
        "ix_recurring_task_templates_is_active",
        "recurring_task_templates",
        ["is_active"],
    )
    op.create_index(
        "ix_recurring_task_templates_milestone_id",
        "recurring_task_templates",
        ["milestone_id"],
    )

    op.add_column(
        "tasks",
        sa.Column("recurring_template_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tasks_recurring_template_id",
        "tasks",
        "recurring_task_templates",
        ["recurring_template_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_tasks_recurring_template_id",
        "tasks",
        ["recurring_template_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_recurring_template_id", table_name="tasks")
    op.drop_constraint("fk_tasks_recurring_template_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "recurring_template_id")

    op.drop_index("ix_recurring_task_templates_milestone_id", table_name="recurring_task_templates")
    op.drop_index("ix_recurring_task_templates_is_active", table_name="recurring_task_templates")
    op.drop_index(
        "ix_recurring_task_templates_next_due_date", table_name="recurring_task_templates"
    )
    op.drop_table("recurring_task_templates")
