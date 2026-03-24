"""Family member and relationship models for client profiles."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class FamilyMember(Base, TimestampMixin):
    """Family member associated with a client profile."""

    __tablename__ = "family_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False)
    date_of_birth: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    occupation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_primary_contact: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Relationships
    client_profile = relationship("ClientProfile", back_populates="family_members")
    outgoing_relationships = relationship(
        "FamilyRelationship",
        foreign_keys="FamilyRelationship.from_member_id",
        back_populates="from_member",
        cascade="all, delete-orphan",
    )
    incoming_relationships = relationship(
        "FamilyRelationship",
        foreign_keys="FamilyRelationship.to_member_id",
        back_populates="to_member",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<FamilyMember(id={self.id}, name={self.name}, "
            f"relationship={self.relationship_type})>"
        )


class FamilyRelationship(Base):
    """Relationship between two family members."""

    __tablename__ = "family_relationships"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    from_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("family_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    to_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("family_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    from_member = relationship(
        "FamilyMember",
        foreign_keys=[from_member_id],
        back_populates="outgoing_relationships",
    )
    to_member = relationship(
        "FamilyMember",
        foreign_keys=[to_member_id],
        back_populates="incoming_relationships",
    )

    def __repr__(self) -> str:
        return (
            f"<FamilyRelationship(from={self.from_member_id}, "
            f"to={self.to_member_id}, type={self.relationship_type})>"
        )
