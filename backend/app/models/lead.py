import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import ClientType, LeadSource, LeadStatus


class Lead(Base, TimestampMixin):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)

    status: Mapped[LeadStatus] = mapped_column(
        String(30), nullable=False, default=LeadStatus.new.value, index=True
    )
    source: Mapped[LeadSource] = mapped_column(
        String(30), nullable=False, default=LeadSource.other.value
    )
    source_details: Mapped[str | None] = mapped_column(String(500), nullable=True)

    estimated_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    estimated_client_type: Mapped[ClientType | None] = mapped_column(String(50), nullable=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    referred_by_partner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partner_profiles.id"), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    disqualified_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    converted_client_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id"), nullable=True
    )

    owner = relationship("User", foreign_keys=[owner_id])
    referred_by_partner = relationship("PartnerProfile", foreign_keys=[referred_by_partner_id])
    converted_client_profile = relationship(
        "ClientProfile", foreign_keys=[converted_client_profile_id]
    )
    opportunities = relationship("Opportunity", back_populates="lead", cascade="all, delete-orphan")
    activities = relationship("CrmActivity", back_populates="lead", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Lead(id={self.id}, full_name={self.full_name}, status={self.status})>"
