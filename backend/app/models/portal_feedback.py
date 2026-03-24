"""Portal feedback model for user feedback submission from any page."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class FeedbackStatus:
    """Feedback status constants."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class FeedbackType:
    """Feedback type constants."""

    BUG_REPORT = "bug_report"
    FEATURE_REQUEST = "feature_request"
    GENERAL_FEEDBACK = "general_feedback"
    QUESTION = "question"


class PortalFeedback(Base, TimestampMixin):
    """User feedback submitted from the portal.

    Allows users to submit bug reports, feature requests, general feedback,
    or questions from any page via the floating feedback widget.
    """

    __tablename__ = "portal_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # User who submitted the feedback
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Feedback classification
    feedback_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Values: bug_report, feature_request, general_feedback, question

    # Content
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional context
    page_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    screenshot_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Contact info for follow-up
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Status tracking
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=FeedbackStatus.OPEN)
    # Values: open, in_progress, resolved, closed

    # Priority (set by product team)
    priority: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Values: low, medium, high, urgent

    # Assignment
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Resolution
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Additional metadata (browser info, screen size, etc.)
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Internal notes (not visible to user)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    assignee = relationship("User", foreign_keys=[assigned_to])
    resolver = relationship("User", foreign_keys=[resolved_by])

    def __repr__(self) -> str:
        return f"<PortalFeedback(id={self.id}, type={self.feedback_type}, status={self.status})>"
