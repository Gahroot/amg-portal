"""Deliverable template model — pre-formatted document templates for partners."""

import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base, TimestampMixin


class DeliverableTemplate(Base, TimestampMixin):
    """A downloadable template file partners can use when creating deliverables."""

    __tablename__ = "deliverable_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    # Category buckets partners browse by
    category = Column(String(100), nullable=False, index=True)
    # MIME type of stored file
    file_type = Column(String(100), nullable=True)
    # Original filename shown to the user
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)
    # MinIO object path
    file_path = Column(String(500), nullable=True)
    # Optional mapping to DeliverableType enum value for smart suggestions
    deliverable_type = Column(String(50), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return (
            f"<DeliverableTemplate(id={self.id}, name={self.name!r},"
            f" category={self.category!r})>"
        )
