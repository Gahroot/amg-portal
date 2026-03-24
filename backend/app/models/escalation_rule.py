import uuid

from sqlalchemy import Boolean, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import EscalationLevel, EscalationTriggerType


class EscalationRule(Base, TimestampMixin):
    """Auto-trigger rules for escalation creation based on conditions."""

    __tablename__ = "escalation_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger_type: Mapped[EscalationTriggerType] = mapped_column(
        String(30), nullable=False, index=True
    )
    trigger_conditions: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    escalation_level: Mapped[EscalationLevel] = mapped_column(String(20), nullable=False)
    auto_assign_to_role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<EscalationRule(id={self.id}, name={self.name}, trigger_type={self.trigger_type})>"
