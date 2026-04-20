"""Saved filter presets for list views."""

import uuid
from typing import Any

from sqlalchemy import JSON, Boolean, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class SavedFilter(Base, TimestampMixin):
    """A user's saved filter preset for programs, clients, partners, etc."""

    __tablename__ = "saved_filters"
    __table_args__ = (
        UniqueConstraint("user_id", "name", "entity_type", name="uq_saved_filter"),
        Index("ix_saved_filters_user_entity", "user_id", "entity_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # "programs" | "clients" | "partners" | "communication_logs"
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    filter_config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user = relationship("User", backref="saved_filters")

    def __repr__(self) -> str:
        return (
            f"<SavedFilter(user_id={self.user_id}, "
            f"name={self.name}, entity_type={self.entity_type})>"
        )
