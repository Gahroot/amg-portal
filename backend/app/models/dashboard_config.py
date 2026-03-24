"""Dashboard configuration model for storing user widget layouts."""

import uuid
from typing import Any

from sqlalchemy import JSON, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class DashboardConfig(Base, TimestampMixin):
    """User's dashboard widget configuration."""

    __tablename__ = "dashboard_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    # Widget configuration stored as JSON array
    # Each item: {widget_id: str, instance_id: str, size: str, position: int, config: dict}
    widgets: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    # Layout mode: "grid" or "flex"
    layout_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="grid")
    # Number of columns (responsive: 1-4)
    columns: Mapped[int] = mapped_column(Integer, nullable=False, default=2)

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="dashboard_config")

    def __repr__(self) -> str:
        return f"<DashboardConfig(user_id={self.user_id}, widgets={len(self.widgets)})>"
