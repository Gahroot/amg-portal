"""Saved table view model for storing and sharing table configurations."""

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class TableView(Base, TimestampMixin):
    """Saved table view configuration.

    Stores user's table configurations including filters, sorting,
    column visibility, and column sizing. Views can be shared
    with team members.
    """

    __tablename__ = "table_views"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # User who created this view
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Unique identifier for the table (e.g., "clients-table", "programs-table")
    table_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # Human-readable name for the view
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Optional description
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Filter configuration as JSON
    # Example: {"status": ["active"], "search": "john", "date_range": {"from": "...", "to": "..."}}
    filters: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    # Sort configuration as JSON array
    # Example: [{"id": "name", "desc": false}, {"id": "created_at", "desc": true}]
    sort: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    # Column visibility state
    # Example: {"name": true, "email": true, "status": false}
    columns: Mapped[dict[str, bool]] = mapped_column(JSONB, nullable=False, default=dict)
    # Column order as array of column IDs
    # Example: ["name", "email", "status", "created_at"]
    column_order: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    # Column sizing state
    # Example: {"name": 200, "email": 250, "status": 120}
    column_sizes: Mapped[dict[str, int]] = mapped_column(JSONB, nullable=False, default=dict)
    # Whether this view is shared with team members
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    # Whether this is the default view for this table for the user
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="table_views")

    # Table args for composite indexes
    __table_args__ = (
        Index(
            "ix_table_views_user_table",
            "user_id",
            "table_id",
        ),
        Index(
            "ix_table_views_shared_table",
            "is_shared",
            "table_id",
        ),
    )

    def __repr__(self) -> str:
        return f"<TableView(id={self.id}, table_id={self.table_id}, name={self.name})>"
