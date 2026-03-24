"""Add status tracking fields to document_requests table.

Adds in_progress_at, processing_at, completed_at, cancelled_at timestamps,
estimated_completion, rm_notes, and client_notes to support the full
Requested → In Progress → Received → Processing → Complete status flow.

Revision ID: add_doc_req_status_tracking
Revises: a1b2c3d4e5f6
Create Date: 2026-03-23
"""

import sqlalchemy as sa

from alembic import op

revision = "add_doc_req_status_tracking"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "document_requests",
        sa.Column("in_progress_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "document_requests",
        sa.Column("processing_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "document_requests",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "document_requests",
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "document_requests",
        sa.Column("estimated_completion", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "document_requests",
        sa.Column("rm_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "document_requests",
        sa.Column("client_notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("document_requests", "client_notes")
    op.drop_column("document_requests", "rm_notes")
    op.drop_column("document_requests", "estimated_completion")
    op.drop_column("document_requests", "cancelled_at")
    op.drop_column("document_requests", "completed_at")
    op.drop_column("document_requests", "processing_at")
    op.drop_column("document_requests", "in_progress_at")
