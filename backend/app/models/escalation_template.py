import uuid

from sqlalchemy import Boolean, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class EscalationTemplate(Base, TimestampMixin):
    """Pre-defined escalation templates with suggested actions for common escalation scenarios."""

    __tablename__ = "escalation_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    description_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_actions: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    notification_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<EscalationTemplate(id={self.id}, name={self.name}, category={self.category})>"
