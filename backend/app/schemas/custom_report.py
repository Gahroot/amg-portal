"""Schemas for custom report builder."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.base import Str50, Str255, Str500, Str2000

# ============================================================================
# Field / Filter / Sort / Group definitions
# ============================================================================

FieldType = Literal["text", "number", "date", "status", "rag", "boolean", "calculated"]
FilterOperator = Literal[
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "contains",
    "not_contains",
    "in",
    "not_in",
    "is_null",
    "is_not_null",
]
SortDirection = Literal["asc", "desc"]
DataSource = Literal[
    "programs", "clients", "partners", "tasks", "milestones", "documents", "communications"
]


class ReportField(BaseModel):
    """A selected field/column in the report."""

    key: Str255 = Field(..., description="Dot-notation field key, e.g. 'title' or 'client.name'")
    label: Str255 = Field(..., description="Display label for the column")
    type: FieldType = Field(default="text")
    expression: Str500 | None = Field(
        default=None,
        description="Formula for calculated fields",
    )


class ReportFilter(BaseModel):
    """A filter condition applied to the report data."""

    field: Str255
    operator: FilterOperator
    value: Any = None


class ReportSort(BaseModel):
    """A sort specification for the report."""

    field: Str255
    direction: SortDirection = "asc"


# ============================================================================
# Request / Response schemas
# ============================================================================


class CustomReportCreate(BaseModel):
    """Payload to create a new custom report."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Str2000 | None = None
    data_source: DataSource
    fields: list[ReportField] = Field(default_factory=list)
    filters: list[ReportFilter] = Field(default_factory=list)
    sorting: list[ReportSort] = Field(default_factory=list)
    grouping: list[str] = Field(default_factory=list)
    is_template: bool = False


class CustomReportUpdate(BaseModel):
    """Partial update for a custom report."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: Str2000 | None = None
    data_source: DataSource | None = None
    fields: list[ReportField] | None = None
    filters: list[ReportFilter] | None = None
    sorting: list[ReportSort] | None = None
    grouping: list[str] | None = None
    is_template: bool | None = None


class CustomReportResponse(BaseModel):
    """Full custom report representation."""

    id: UUID
    name: Str255
    description: Str2000 | None
    data_source: Str50
    fields: list[dict[str, Any]]
    filters: list[dict[str, Any]]
    sorting: list[dict[str, Any]]
    grouping: list[str]
    is_template: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CustomReportListResponse(BaseModel):
    """Paginated list of custom reports."""

    reports: list[CustomReportResponse]
    total: int


# ============================================================================
# Preview / Execute schemas
# ============================================================================


class ReportPreviewRequest(BaseModel):
    """Execute (or preview) a report definition and return rows."""

    data_source: DataSource
    fields: list[ReportField] = Field(default_factory=list)
    filters: list[ReportFilter] = Field(default_factory=list)
    sorting: list[ReportSort] = Field(default_factory=list)
    grouping: list[str] = Field(default_factory=list)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=200)


class ReportPreviewResponse(BaseModel):
    """Rows returned from a report preview/execute."""

    columns: list[dict[str, Any]]  # [{key, label, type}]
    rows: list[dict[str, Any]]
    total: int
    page: int
    page_size: int


# ============================================================================
# Export schema
# ============================================================================

ExportFormat = Literal["csv", "pdf", "excel"]


class ReportExportRequest(BaseModel):
    """Request to export a saved or ad-hoc report."""

    format: ExportFormat = "csv"
    # Optional override — if omitted the saved report's definition is used
    filters: list[ReportFilter] | None = None
