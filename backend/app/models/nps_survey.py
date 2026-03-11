"""NPS (Net Promoter Score) Survey models for quarterly client satisfaction."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class NPSSurvey(Base):
    """NPS Survey definition for quarterly client satisfaction measurement."""

    __tablename__ = "nps_surveys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Survey identification
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    quarter: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3, or 4
    year: Mapped[int] = mapped_column(Integer, nullable=False)

    # Status
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")

    # Questions (stored as JSON array for flexibility)
    # Standard NPS question + optional custom questions
    questions: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Distribution settings
    distribution_method: Mapped[str] = mapped_column(
        String(20), nullable=False, default="email"
    )  # email, portal, both
    reminder_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reminder_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)

    # Timing
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Target audience
    target_client_types: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    target_client_ids: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # Audit
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    responses = relationship(
        "NPSResponse", back_populates="survey", cascade="all, delete-orphan"
    )
    follow_ups = relationship(
        "NPSFollowUp", back_populates="survey", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<NPSSurvey(id={self.id}, name={self.name}, Q{self.quarter}/{self.year})>"


class NPSResponse(Base):
    """Individual NPS response from a client."""

    __tablename__ = "nps_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Survey reference
    survey_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("nps_surveys.id", ondelete="CASCADE"), nullable=False
    )

    # Client reference
    client_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id"), nullable=False
    )

    # NPS Score (0-10)
    # 0-6 = Detractor, 7-8 = Passive, 9-10 = Promoter
    score: Mapped[int] = mapped_column(Integer, nullable=False)

    # Categorized score
    score_category: Mapped[str] = mapped_column(String(20), nullable=False)

    # Feedback
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Additional custom question responses (JSON)
    custom_responses: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Metadata
    responded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    response_channel: Mapped[str] = mapped_column(
        String(20), nullable=False, default="portal"
    )  # email, portal

    # Follow-up tracking
    follow_up_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    follow_up_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    survey = relationship("NPSSurvey", back_populates="responses")
    client_profile = relationship("ClientProfile")
    follow_up = relationship(
        "NPSFollowUp", back_populates="response", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<NPSResponse(id={self.id}, score={self.score}, category={self.score_category})>"


class NPSFollowUp(Base):
    """Follow-up action triggered by low NPS scores (detractors)."""

    __tablename__ = "nps_follow_ups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.UUID)

    # References
    survey_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("nps_surveys.id", ondelete="CASCADE"), nullable=False
    )
    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("nps_responses.id", ondelete="CASCADE"), nullable=False
    )
    client_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id"), nullable=False
    )

    # Assignment
    assigned_to: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Priority (based on score severity)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")

    # Status
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    # Action details
    action_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="personal_reach_out"
    )  # personal_reach_out, escalation, service_review, etc.
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Due date
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    survey = relationship("NPSSurvey", back_populates="follow_ups")
    response = relationship("NPSResponse", back_populates="follow_up")
    client_profile = relationship("ClientProfile")
    assignee = relationship("User", foreign_keys=[assigned_to])

    def __repr__(self) -> str:
        return f"<NPSFollowUp(id={self.id}, status={self.status}, priority={self.priority})>"
