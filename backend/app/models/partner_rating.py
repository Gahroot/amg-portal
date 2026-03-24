import uuid

from sqlalchemy import ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class PartnerRating(Base, TimestampMixin):
    __tablename__ = "partner_ratings"
    __table_args__ = (
        UniqueConstraint(
            "program_id",
            "partner_id",
            name="uq_program_partner_rating",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id"), nullable=False
    )
    partner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("partner_profiles.id"),
        nullable=False,
    )
    rated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    quality_score: Mapped[int] = mapped_column(Integer, nullable=False)
    timeliness_score: Mapped[int] = mapped_column(Integer, nullable=False)
    communication_score: Mapped[int] = mapped_column(Integer, nullable=False)
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    program = relationship("Program")
    partner = relationship("PartnerProfile")
    rater = relationship("User", foreign_keys=[rated_by])
