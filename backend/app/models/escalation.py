import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import EscalationLevel, EscalationStatus


class Escalation(Base, TimestampMixin):
    """Escalation tracking for tasks, milestones, programs, and client-impacting issues."""

    __tablename__ = "escalations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    level: Mapped[EscalationLevel] = mapped_column(String(20), nullable=False, index=True)
    status: Mapped[EscalationStatus] = mapped_column(
        String(20), nullable=False, default=EscalationStatus.open
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    program_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    triggered_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    risk_factors: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    escalation_chain: Mapped[list[dict[str, object]] | None] = mapped_column(JSONB, nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    parent_escalation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("escalations.id"), nullable=True
    )

    __table_args__ = (
        Index("ix_escalations_status_level", "status", "level"),
        Index("ix_escalations_entity", "entity_type", "entity_id"),
        Index("ix_escalations_program_client", "program_id", "client_id"),
    )

    @property
    def is_overdue(self) -> bool:
        """Return True if response_deadline has passed and escalation is still active."""
        if self.response_deadline is None:
            return False
        if self.status in (EscalationStatus.resolved.value, EscalationStatus.closed.value):
            return False
        return datetime.now(UTC) > self.response_deadline

    def __repr__(self) -> str:
        return f"<Escalation(id={self.id}, level={self.level}, status={self.status})>"
