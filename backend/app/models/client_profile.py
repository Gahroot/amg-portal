import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ClientProfile(Base):
    """Client profile with compliance workflow."""

    __tablename__ = "client_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identity
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    jurisdiction: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tax_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Contact
    primary_email: Mapped[str] = mapped_column(String(255), nullable=False)
    secondary_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Preferences
    communication_preference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sensitivities: Mapped[str | None] = mapped_column(Text, nullable=True)
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Workflow
    compliance_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending_review"
    )
    approval_status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    compliance_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    compliance_reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    compliance_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Assignment
    assigned_rm_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    # Intelligence
    intelligence_file: Mapped[dict[str, str] | None] = mapped_column(JSON, nullable=True)

    # CRM Integration
    external_crm_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Provisioning
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, unique=True
    )
    welcome_email_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    portal_access_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Audit
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
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

    # Relationships
    creator = relationship(
        "User", foreign_keys=[created_by], back_populates="client_profiles_created"
    )
    user = relationship("User", foreign_keys=[user_id], back_populates="client_profile")
    compliance_reviewer = relationship("User", foreign_keys=[compliance_reviewed_by])
    approver = relationship("User", foreign_keys=[approved_by])
    assigned_rm = relationship("User", foreign_keys=[assigned_rm_id])
    family_members = relationship(
        "FamilyMember", back_populates="client_profile", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ClientProfile(id={self.id}, legal_name={self.legal_name})>"
