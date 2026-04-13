import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import OpportunityStage


class Opportunity(Base, TimestampMixin):
    __tablename__ = "opportunities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    stage: Mapped[OpportunityStage] = mapped_column(
        String(30),
        nullable=False,
        default=OpportunityStage.qualifying.value,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    probability: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    expected_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    program_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    next_step: Mapped[str | None] = mapped_column(String(500), nullable=True)
    next_step_at: Mapped[date | None] = mapped_column(Date, nullable=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True
    )
    client_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )

    won_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lost_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lost_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    owner = relationship("User", foreign_keys=[owner_id])
    lead = relationship("Lead", back_populates="opportunities")
    client_profile = relationship("ClientProfile", foreign_keys=[client_profile_id])
    activities = relationship(
        "CrmActivity", back_populates="opportunity", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Opportunity(id={self.id}, title={self.title}, stage={self.stage})>"
