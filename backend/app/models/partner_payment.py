"""Partner payment records — payments made to partner firms for completed work."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class PartnerPayment(Base, TimestampMixin):
    """A payment record for a partner, tied to an assignment."""

    __tablename__ = "partner_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assignment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_assignments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False, default="bank_transfer")
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # who recorded this payment internally
    recorded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    partner = relationship("PartnerProfile", foreign_keys=[partner_id])
    assignment = relationship("PartnerAssignment", foreign_keys=[assignment_id])
    recorder = relationship("User", foreign_keys=[recorded_by])

    def __repr__(self) -> str:
        return f"<PartnerPayment(id={self.id}, partner_id={self.partner_id}, amount={self.amount})>"
