"""Custom report model for user-defined report builder configurations."""

import uuid
from typing import Any

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class CustomReport(Base, TimestampMixin):
    """User-defined custom report with data source, fields, filters, sorting, and grouping."""

    __tablename__ = "custom_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Data source: programs | clients | partners | tasks | milestones | documents | communications
    data_source: Mapped[str] = mapped_column(String(50), nullable=False)

    # JSON arrays / objects defining the report structure
    # fields: list[{"key": str, "label": str, "type": str, "expression"?: str}]
    fields: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)

    # filters: list[{"field": str, "operator": str, "value": any}]
    filters: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)

    # sorting: list[{"field": str, "direction": "asc"|"desc"}]
    sorting: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)

    # grouping: list[str] — field keys to group by
    grouping: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)

    # Whether this report can be used as a template by other users
    is_template: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<CustomReport(id={self.id}, name={self.name}, source={self.data_source})>"
