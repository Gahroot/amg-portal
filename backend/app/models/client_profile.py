import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import JSON, JSONB, UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.crypto import blind_index
from app.db.base import Base, TimestampMixin
from app.db.encrypted_type import EncryptedBytes


class ClientProfile(Base, TimestampMixin):
    """Client profile with compliance workflow."""

    __tablename__ = "client_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identity
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    jurisdiction: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # tax_id is stored AES-GCM encrypted in ``tax_id_enc``; the plain-str API is
    # preserved via a hybrid property so existing call-sites keep working. Equality
    # lookups MUST use ``tax_id_bidx == blind_index(value)`` — the plaintext is
    # never in the index, so a ``tax_id == "..."`` query would always miss.
    tax_id_enc: Mapped[bytes | None] = mapped_column(
        "tax_id",
        EncryptedBytes(table="client_profiles", column="tax_id"),
        nullable=True,
        key="tax_id_enc",
    )
    tax_id_bidx: Mapped[bytes | None] = mapped_column(LargeBinary(16), nullable=True, index=True)

    # Contact
    primary_email: Mapped[str] = mapped_column(String(255), nullable=False)
    secondary_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Preferences
    communication_preference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sensitivities: Mapped[str | None] = mapped_column(Text, nullable=True)
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Communication Preferences
    preferred_channels: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    contact_hours_start: Mapped[str | None] = mapped_column(String(10), nullable=True)
    contact_hours_end: Mapped[str | None] = mapped_column(String(10), nullable=True)
    contact_timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    language_preference: Mapped[str | None] = mapped_column(String(10), nullable=True)
    do_not_contact: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    opt_out_marketing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

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

    # Security
    security_profile_level: Mapped[str] = mapped_column(
        String(50), nullable=False, default="standard", server_default="standard"
    )

    # Intelligence
    intelligence_file: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Provisioning
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, unique=True
    )
    welcome_email_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    portal_access_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Compliance certificate (auto-generated on MD approval)
    compliance_certificate_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clearance_certificates.id"),
        nullable=True,
    )
    compliance_certificate_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Birthday & important dates
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    important_dates: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    birthday_reminders_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Audit
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
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
    compliance_certificate = relationship(
        "ClearanceCertificate", foreign_keys=[compliance_certificate_id]
    )

    def __init__(self, **kwargs: Any) -> None:
        """Accept ``tax_id=<str>`` in the constructor and route it through the
        setter so the encrypted column + blind index get populated together.

        SQLA's default declarative ``__init__`` only recognises mapped columns
        as kwargs; the hybrid property ``tax_id`` isn't a mapped column, so we
        peel it off before handing the rest to the base constructor.
        """
        tax_id_val = kwargs.pop("tax_id", None)
        super().__init__(**kwargs)
        if tax_id_val is not None:
            self.tax_id = tax_id_val

    @hybrid_property
    def tax_id(self) -> str | None:
        """Plaintext tax_id view over the encrypted storage column.

        Returns ``None`` when unset. Setting ``tax_id`` updates both the encrypted
        payload and the blind index in lockstep so equality lookups stay consistent.
        """
        if self.tax_id_enc is None:
            return None
        return self.tax_id_enc.decode("utf-8")

    @tax_id.inplace.setter
    def _tax_id_setter(self, value: str | None) -> None:
        if value is None or value == "":
            self.tax_id_enc = None
            self.tax_id_bidx = None
            return
        self.tax_id_enc = value.encode("utf-8")
        self.tax_id_bidx = blind_index(value)

    def __repr__(self) -> str:
        return f"<ClientProfile(id={self.id}, legal_name={self.legal_name})>"
