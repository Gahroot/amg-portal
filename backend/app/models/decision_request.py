"""Decision request model for client decision workflows."""

import uuid
from datetime import UTC, datetime, time
from typing import Any

from sqlalchemy import JSON, Date, DateTime, ForeignKey, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DecisionRequest(Base):
    """Structured decision request from client or coordinator."""

    __tablename__ = "decision_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id", ondelete="CASCADE"), nullable=False
    )
    program_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    # choice, text, yes_no, multi_choice
    response_type: Mapped[str] = mapped_column(String(50), nullable=False, default="choice")
    # Options for choice/multi_choice: [{"id": "opt1", "label": "Option 1", "description": "..."}]
    options: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    deadline_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    deadline_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    # What happens if no response
    consequence_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    # Response data: {"option_id": "opt1", "text": "Client's response", "responded_at": "..."}
    response: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    responded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False
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

    def __repr__(self) -> str:
        return f"<DecisionRequest(id={self.id}, title={self.title}, status={self.status})>"
