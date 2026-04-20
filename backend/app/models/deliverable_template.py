"""Deliverable template model — pre-formatted document templates for partners."""

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class DeliverableTemplate(Base, TimestampMixin):
    """A downloadable template file partners can use when creating deliverables."""

    __tablename__ = "deliverable_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Category buckets partners browse by
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # MIME type of stored file
    file_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Original filename shown to the user
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # MinIO object path
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Optional mapping to DeliverableType enum value for smart suggestions
    deliverable_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return (
            f"<DeliverableTemplate(id={self.id}, name={self.name!r}, category={self.category!r})>"
        )
