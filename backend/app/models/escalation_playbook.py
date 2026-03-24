"""Escalation playbook models — resolution templates and execution tracking."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class EscalationPlaybook(Base, TimestampMixin):
    """Template defining step-by-step resolution guidance for an escalation type."""

    __tablename__ = "escalation_playbooks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    escalation_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # steps: [{order, title, description, time_estimate_minutes, resources: [{label, url}]}]
    steps: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False, default=list)
    # success_criteria: [str]
    success_criteria: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    # escalation_paths: [{condition, action, contact_role}]
    escalation_paths: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<EscalationPlaybook(id={self.id}, type={self.escalation_type}, name={self.name})>"


class PlaybookExecution(Base, TimestampMixin):
    """Tracks playbook execution for a specific escalation instance."""

    __tablename__ = "playbook_executions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playbook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("escalation_playbooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    escalation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("escalations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        unique=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="in_progress", index=True
    )
    # step_states: [{step_order, completed, skipped, skip_reason, notes, completed_at}]
    step_states: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    started_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    completed_steps: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_steps: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<PlaybookExecution(id={self.id}, escalation={self.escalation_id}, "
            f"status={self.status})>"
        )

    def compute_progress(self) -> dict[str, object]:
        """Return progress summary."""
        if self.total_steps == 0:
            return {"completed": 0, "skipped": 0, "total": 0, "percentage": 0}
        completed = sum(1 for s in self.step_states if s.get("completed"))
        skipped = sum(1 for s in self.step_states if s.get("skipped"))
        acted = completed + skipped
        return {
            "completed": completed,
            "skipped": skipped,
            "total": self.total_steps,
            "percentage": round(acted / self.total_steps * 100),
        }
