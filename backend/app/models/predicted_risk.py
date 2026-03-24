"""PredictedRisk model — persisted risk predictions for programs and milestones."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PredictedRisk(Base):
    """Persisted risk prediction for a program, computed on-demand and stored for trending."""

    __tablename__ = "predicted_risks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("programs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    milestone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("milestones.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Core risk signals
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    # low / medium / high / critical
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)

    # Task completion metrics
    task_completion_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    blocked_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overdue_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Milestone velocity
    milestone_velocity: Mapped[float | None] = mapped_column(Float, nullable=True)
    # avg days between completions over sliding window; None when < 2 completed milestones
    milestone_velocity_trend: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # "improving" | "stable" | "degrading"

    # Schedule deviation
    days_remaining: Mapped[int | None] = mapped_column(Integer, nullable=True)
    schedule_variance: Mapped[float | None] = mapped_column(Float, nullable=True)
    # positive = ahead, negative = behind
    behind_schedule: Mapped[bool] = mapped_column(
        # True when velocity anomaly detected via z-score
        String(5),
        nullable=False,
        default="false",
    )

    # Anomaly detection results
    anomaly_flags: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    # {"velocity_anomaly": True, "completion_rate_anomaly": False, ...}

    # Narrative
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )

    # Relationships
    program = relationship("Program", foreign_keys=[program_id])
    milestone = relationship("Milestone", foreign_keys=[milestone_id])

    def __repr__(self) -> str:
        return f"<PredictedRisk(program_id={self.program_id}, risk_score={self.risk_score})>"
