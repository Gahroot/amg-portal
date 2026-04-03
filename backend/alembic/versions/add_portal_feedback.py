"""Add portal feedback table.

Revision ID: add_portal_feedback
Revises: ddc5d4fef8cd
Create Date: 2025-01-23

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_portal_feedback"
down_revision = "ddc5d4fef8cd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create portal_feedback table."""
    op.create_table(
        "portal_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        # User who submitted feedback
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,  # Allow NULL if user is deleted
        ),
        # Feedback type (bug, feature_request, general, question)
        sa.Column("feedback_type", sa.String(50), nullable=False),
        # Description of the feedback
        sa.Column("description", sa.Text(), nullable=False),
        # Page URL where feedback was submitted
        sa.Column("page_url", sa.String(500), nullable=True),
        # Screenshot URL (if captured)
        sa.Column("screenshot_url", sa.Text(), nullable=True),
        # Email for follow-up (can be different from user email)
        sa.Column("email", sa.String(255), nullable=True),
        # User agent string for debugging
        sa.Column("user_agent", sa.Text(), nullable=True),
        # Status tracking
        sa.Column("status", sa.String(50), nullable=False, server_default="open"),
        # Priority level
        sa.Column("priority", sa.String(20), nullable=True),
        # Staff assignment
        sa.Column(
            "assigned_to",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # Resolution tracking
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "resolved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # Resolution notes
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        # Internal notes
        sa.Column("internal_notes", sa.Text(), nullable=True),
        # Additional metadata (browser info, etc.)
        sa.Column(
            "extra_data",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
        ),
    )

    # Create indexes
    op.create_index("ix_portal_feedback_user_id", "portal_feedback", ["user_id"])
    op.create_index("ix_portal_feedback_status", "portal_feedback", ["status"])
    op.create_index("ix_portal_feedback_type", "portal_feedback", ["feedback_type"])
    op.create_index("ix_portal_feedback_created_at", "portal_feedback", ["created_at"])
    op.create_index(
        "ix_portal_feedback_assigned_to", "portal_feedback", ["assigned_to"]
    )


def downgrade() -> None:
    """Remove portal_feedback table."""
    op.drop_index("ix_portal_feedback_assigned_to", "portal_feedback")
    op.drop_index("ix_portal_feedback_created_at", "portal_feedback")
    op.drop_index("ix_portal_feedback_type", "portal_feedback")
    op.drop_index("ix_portal_feedback_status", "portal_feedback")
    op.drop_index("ix_portal_feedback_user_id", "portal_feedback")
    op.drop_table("portal_feedback")
