import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import CommunicationType, SLABreachStatus


class SLATracker(Base, TimestampMixin):
    """SLA tracking for communications requiring timely response."""

    __tablename__ = "sla_trackers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)
    communication_type: Mapped[CommunicationType] = mapped_column(String(30), nullable=False)
    sla_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    breach_status: Mapped[SLABreachStatus] = mapped_column(
        String(20), nullable=False, default=SLABreachStatus.within_sla
    )
    assigned_to: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    __table_args__ = (
        Index("ix_sla_trackers_breach_status", "breach_status"),
        Index("ix_sla_trackers_entity", "entity_type", "entity_id"),
    )

    def __repr__(self) -> str:
        return f"<SLATracker(id={self.id}, breach_status={self.breach_status})>"
