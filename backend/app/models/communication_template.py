"""Communication template model for reusable message templates."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import TemplateType


class TemplateStatus(enum.StrEnum):
    draft = "draft"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class CommunicationTemplate(Base, TimestampMixin):
    """Reusable template for communications with variable substitution."""

    __tablename__ = "communication_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    template_type: Mapped[TemplateType] = mapped_column(
        String(50), nullable=False, default=TemplateType.custom
    )
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # Variable definitions: {"client_name": {"type": "string", "description": "Client's name"}}
    variable_definitions: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # System templates cannot be deleted
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Approval workflow status
    status: Mapped[TemplateStatus] = mapped_column(
        String(20), nullable=False, default=TemplateStatus.draft
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<CommunicationTemplate(id={self.id}, name={self.name}, type={self.template_type})>"
