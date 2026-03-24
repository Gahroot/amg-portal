import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import ProgramStatus


class Program(Base, TimestampMixin):
    __tablename__ = "programs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    objectives: Mapped[str | None] = mapped_column(Text, nullable=True)
    scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    budget_envelope: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[ProgramStatus] = mapped_column(
        String(20), nullable=False, default=ProgramStatus.intake
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Emergency activation fields
    emergency_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    retrospective_due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Client-brief fields
    brief_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    brief_visible_to_client: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    brief_shared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    client = relationship("Client", back_populates="programs")
    milestones = relationship("Milestone", back_populates="program", cascade="all, delete-orphan")
    approvals = relationship(
        "ProgramApproval", back_populates="program", cascade="all, delete-orphan"
    )
    travel_bookings = relationship(
        "TravelBooking", back_populates="program", cascade="all, delete-orphan"
    )
    invoices = relationship("Invoice", back_populates="program")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<Program(id={self.id}, title={self.title})>"
