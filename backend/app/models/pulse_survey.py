"""Pulse Survey models for lightweight one-click satisfaction feedback."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import PulseSurveyResponseType, PulseSurveyStatus, PulseSurveyTrigger


class PulseSurvey(Base, TimestampMixin):
    """Lightweight pulse survey for one-click satisfaction feedback between NPS cycles."""

    __tablename__ = "pulse_surveys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    response_type: Mapped[PulseSurveyResponseType] = mapped_column(String(20), nullable=False)
    allow_comment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Status
    status: Mapped[PulseSurveyStatus] = mapped_column(
        String(20), nullable=False, default=PulseSurveyStatus.draft
    )

    # Trigger
    trigger_type: Mapped[PulseSurveyTrigger] = mapped_column(
        String(30), nullable=False, default=PulseSurveyTrigger.random
    )

    # Timing
    active_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    active_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Limits
    max_responses: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Minimum days between showing pulse surveys to the same client (anti-fatigue)
    min_days_between_shows: Mapped[int] = mapped_column(Integer, nullable=False, default=14)

    # Audit
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    responses = relationship(
        "PulseSurveyResponse", back_populates="survey", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PulseSurvey(id={self.id}, title={self.title}, status={self.status})>"


class PulseSurveyResponse(Base):
    """Individual one-click response to a pulse survey."""

    __tablename__ = "pulse_survey_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # References
    survey_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pulse_surveys.id", ondelete="CASCADE"), nullable=False
    )
    client_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id"), nullable=False
    )

    # The response value — depends on response_type:
    #   emoji:   "happy" | "neutral" | "sad"
    #   stars:   "1" | "2" | "3" | "4" | "5"
    #   yes_no:  "yes" | "no"
    #   thumbs:  "up" | "down"
    response_value: Mapped[str] = mapped_column(String(20), nullable=False)

    # Optional free-text comment
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Context of what triggered the survey (e.g. {"deliverable_id": "..."})
    trigger_context: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Timestamp
    responded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    survey = relationship("PulseSurvey", back_populates="responses")
    client_profile = relationship("ClientProfile")

    def __repr__(self) -> str:
        return f"<PulseSurveyResponse(id={self.id}, value={self.response_value})>"
