import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

DEFAULT_CHECKLIST = [
    {
        "key": "deliverables_approved",
        "label": "All deliverables approved",
        "completed": False,
    },
    {
        "key": "partner_ratings_submitted",
        "label": "Partner ratings submitted",
        "completed": False,
    },
    {
        "key": "final_report_generated",
        "label": "Final report generated",
        "completed": False,
    },
    {
        "key": "client_signoff",
        "label": "Client sign-off received",
        "completed": False,
    },
    {
        "key": "financials_reconciled",
        "label": "Financials reconciled",
        "completed": False,
    },
]


class ProgramClosure(Base):
    __tablename__ = "program_closures"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("programs.id"),
        unique=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="initiated")
    checklist: Mapped[list[dict[str, object]]] = mapped_column(
        JSON, nullable=False, default=lambda: list(DEFAULT_CHECKLIST)
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    initiated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    program = relationship("Program")
    initiator = relationship("User", foreign_keys=[initiated_by])
