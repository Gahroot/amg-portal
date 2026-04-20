"""Service for custom report builder — query execution, preview, and export."""

import csv
import io
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.communication import Communication
from app.models.custom_report import CustomReport
from app.models.document import Document
from app.models.milestone import Milestone
from app.models.partner import PartnerProfile
from app.models.program import Program
from app.models.task import Task
from app.schemas.custom_report import (
    CustomReportCreate,
    CustomReportUpdate,
    ReportField,
    ReportFilter,
    ReportPreviewResponse,
    ReportSort,
)

# ---------------------------------------------------------------------------
# Data source field catalogue
# ---------------------------------------------------------------------------

DATA_SOURCE_FIELDS: dict[str, list[dict[str, Any]]] = {
    "programs": [
        {"key": "id", "label": "ID", "type": "text"},
        {"key": "title", "label": "Title", "type": "text"},
        {"key": "status", "label": "Status", "type": "status"},
        {"key": "rag_status", "label": "RAG Status", "type": "rag"},
        {"key": "start_date", "label": "Start Date", "type": "date"},
        {"key": "end_date", "label": "End Date", "type": "date"},
        {"key": "budget_envelope", "label": "Budget", "type": "number"},
        {"key": "objectives", "label": "Objectives", "type": "text"},
        {"key": "client_name", "label": "Client", "type": "text"},
        {"key": "created_at", "label": "Created At", "type": "date"},
    ],
    "clients": [
        {"key": "id", "label": "ID", "type": "text"},
        {"key": "name", "label": "Name", "type": "text"},
        {"key": "client_type", "label": "Client Type", "type": "status"},
        {"key": "status", "label": "Status", "type": "status"},
        {"key": "notes", "label": "Notes", "type": "text"},
        {"key": "created_at", "label": "Created At", "type": "date"},
    ],
    "partners": [
        {"key": "id", "label": "ID", "type": "text"},
        {"key": "firm_name", "label": "Firm Name", "type": "text"},
        {"key": "contact_name", "label": "Contact Name", "type": "text"},
        {"key": "contact_email", "label": "Contact Email", "type": "text"},
        {"key": "status", "label": "Status", "type": "status"},
        {"key": "performance_rating", "label": "Performance Rating", "type": "number"},
        {"key": "total_assignments", "label": "Total Assignments", "type": "number"},
        {"key": "completed_assignments", "label": "Completed Assignments", "type": "number"},
        {"key": "availability_status", "label": "Availability", "type": "status"},
        {"key": "created_at", "label": "Created At", "type": "date"},
    ],
    "tasks": [
        {"key": "id", "label": "ID", "type": "text"},
        {"key": "title", "label": "Title", "type": "text"},
        {"key": "status", "label": "Status", "type": "status"},
        {"key": "priority", "label": "Priority", "type": "status"},
        {"key": "due_date", "label": "Due Date", "type": "date"},
        {"key": "description", "label": "Description", "type": "text"},
        {"key": "created_at", "label": "Created At", "type": "date"},
    ],
    "milestones": [
        {"key": "id", "label": "ID", "type": "text"},
        {"key": "title", "label": "Title", "type": "text"},
        {"key": "status", "label": "Status", "type": "status"},
        {"key": "due_date", "label": "Due Date", "type": "date"},
        {"key": "description", "label": "Description", "type": "text"},
        {"key": "position", "label": "Position", "type": "number"},
        {"key": "created_at", "label": "Created At", "type": "date"},
    ],
    "documents": [
        {"key": "id", "label": "ID", "type": "text"},
        {"key": "file_name", "label": "File Name", "type": "text"},
        {"key": "category", "label": "Category", "type": "status"},
        {"key": "description", "label": "Description", "type": "text"},
        {"key": "file_size", "label": "File Size (bytes)", "type": "number"},
        {"key": "content_type", "label": "Content Type", "type": "text"},
        {"key": "entity_type", "label": "Entity Type", "type": "status"},
        {"key": "version", "label": "Version", "type": "number"},
        {"key": "created_at", "label": "Uploaded At", "type": "date"},
    ],
    "communications": [
        {"key": "id", "label": "ID", "type": "text"},
        {"key": "channel", "label": "Channel", "type": "status"},
        {"key": "status", "label": "Status", "type": "status"},
        {"key": "subject", "label": "Subject", "type": "text"},
        {"key": "body_text", "label": "Body", "type": "text"},
        {"key": "sent_at", "label": "Sent At", "type": "date"},
        {"key": "created_at", "label": "Created At", "type": "date"},
    ],
}


# ---------------------------------------------------------------------------
# Model mapping helpers
# ---------------------------------------------------------------------------


def _model_for_source(data_source: str) -> type:
    mapping = {
        "programs": Program,
        "clients": Client,
        "partners": PartnerProfile,
        "tasks": Task,
        "milestones": Milestone,
        "documents": Document,
        "communications": Communication,
    }
    return mapping[data_source]


def _row_to_dict(row: Any, fields: list[ReportField], data_source: str) -> dict[str, Any]:
    """Convert a SQLAlchemy ORM instance to a plain dict for the requested fields."""
    result: dict[str, Any] = {}
    for field in fields:
        key = field.key
        # Handle virtual/joined keys
        if key == "client_name" and data_source == "programs":
            result[key] = getattr(row, "_client_name", None)
        else:
            raw = getattr(row, key, None)
            if isinstance(raw, (uuid.UUID,)):
                raw = str(raw)
            elif isinstance(raw, datetime):
                raw = raw.isoformat()
            result[key] = raw
    return result


# ---------------------------------------------------------------------------
# Filter application (in-memory on fetched rows for simplicity)
# ---------------------------------------------------------------------------


def _apply_filter(value: Any, operator: str, filter_value: Any) -> bool:  # noqa: PLR0911, PLR0912
    if operator == "is_null":
        return value is None
    if operator == "is_not_null":
        return value is not None
    if value is None:
        return False
    str_value = str(value).lower()
    str_filter = str(filter_value).lower() if filter_value is not None else ""
    if operator == "eq":
        return str_value == str_filter
    if operator == "neq":
        return str_value != str_filter
    if operator == "contains":
        return str_filter in str_value
    if operator == "not_contains":
        return str_filter not in str_value
    if operator == "in":
        items = [str(v).lower() for v in (filter_value if isinstance(filter_value, list) else [])]
        return str_value in items
    if operator == "not_in":
        items = [str(v).lower() for v in (filter_value if isinstance(filter_value, list) else [])]
        return str_value not in items
    # Numeric comparisons
    try:
        num_value = float(value)
        num_filter = float(filter_value)
        if operator == "gt":
            return num_value > num_filter
        if operator == "gte":
            return num_value >= num_filter
        if operator == "lt":
            return num_value < num_filter
        if operator == "lte":
            return num_value <= num_filter
    except (TypeError, ValueError):
        pass
    return False


def _filter_rows(
    rows: list[dict[str, Any]],
    filters: list[ReportFilter],
) -> list[dict[str, Any]]:
    for f in filters:
        rows = [r for r in rows if _apply_filter(r.get(f.field), f.operator, f.value)]
    return rows


def _sort_rows(
    rows: list[dict[str, Any]],
    sorting: list[ReportSort],
) -> list[dict[str, Any]]:
    for sort in reversed(sorting):
        rows = sorted(
            rows,
            key=lambda r: (r.get(sort.field) is None, r.get(sort.field)),
            reverse=(sort.direction == "desc"),
        )
    return rows


# ---------------------------------------------------------------------------
# Core query execution
# ---------------------------------------------------------------------------


async def _execute_query(
    db: AsyncSession,
    data_source: str,
    fields: list[ReportField],
    filters: list[ReportFilter],
    sorting: list[ReportSort],
    page: int,
    page_size: int,
) -> tuple[list[dict[str, Any]], int]:
    """Fetch data from the appropriate table and apply filters/sorting/pagination."""
    model = _model_for_source(data_source)

    from sqlalchemy.engine import Result  # noqa: PLC0415

    result: Result[Any] = await db.execute(select(model))
    rows_raw: list[Any] = list(result.scalars().all())

    # Attach client name for programs via a second query
    if data_source == "programs":
        client_ids = [r.client_id for r in rows_raw]
        if client_ids:
            client_stmt = select(Client).where(Client.id.in_(client_ids))
            client_result = await db.execute(client_stmt)
            client_map = {c.id: c.name for c in client_result.scalars().all()}
            for r in rows_raw:
                object.__setattr__(r, "_client_name", client_map.get(r.client_id))

    rows = [_row_to_dict(r, fields, data_source) for r in rows_raw]
    rows = _filter_rows(rows, filters)
    rows = _sort_rows(rows, sorting)

    total = len(rows)
    start = (page - 1) * page_size
    rows = rows[start : start + page_size]
    return rows, total


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------


class CustomReportService:
    # ------------------------------------------------------------------
    # Field catalogue
    # ------------------------------------------------------------------

    def get_available_fields(self, data_source: str) -> list[dict[str, Any]]:
        return DATA_SOURCE_FIELDS.get(data_source, [])

    def _default_fields(self, data_source: str) -> list[ReportField]:
        catalogue = self.get_available_fields(data_source)
        return [ReportField(key=f["key"], label=f["label"], type=f["type"]) for f in catalogue]

    def get_all_data_sources(self) -> list[dict[str, Any]]:
        return [
            {"key": "programs", "label": "Programs"},
            {"key": "clients", "label": "Clients"},
            {"key": "partners", "label": "Partners"},
            {"key": "tasks", "label": "Tasks"},
            {"key": "milestones", "label": "Milestones"},
            {"key": "documents", "label": "Documents"},
            {"key": "communications", "label": "Communications"},
        ]

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    async def create(
        self,
        db: AsyncSession,
        payload: CustomReportCreate,
        created_by: uuid.UUID,
    ) -> CustomReport:
        report = CustomReport(
            name=payload.name,
            description=payload.description,
            data_source=payload.data_source,
            fields=[f.model_dump() for f in payload.fields],
            filters=[f.model_dump() for f in payload.filters],
            sorting=[s.model_dump() for s in payload.sorting],
            grouping=payload.grouping,
            is_template=payload.is_template,
            created_by=created_by,
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)
        return report

    async def list_reports(
        self,
        db: AsyncSession,
        created_by: uuid.UUID,
        include_templates: bool = True,
    ) -> list[CustomReport]:
        stmt = select(CustomReport)
        if include_templates:
            from sqlalchemy import or_

            stmt = stmt.where(
                or_(CustomReport.created_by == created_by, CustomReport.is_template.is_(True))
            )
        else:
            stmt = stmt.where(CustomReport.created_by == created_by)
        stmt = stmt.order_by(CustomReport.created_at.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, db: AsyncSession, report_id: uuid.UUID) -> CustomReport | None:
        result = await db.execute(select(CustomReport).where(CustomReport.id == report_id))
        return result.scalar_one_or_none()

    async def update(
        self,
        db: AsyncSession,
        report: CustomReport,
        payload: CustomReportUpdate,
    ) -> CustomReport:
        if payload.name is not None:
            report.name = payload.name
        if payload.description is not None:
            report.description = payload.description
        if payload.data_source is not None:
            report.data_source = payload.data_source
        if payload.fields is not None:
            report.fields = [f.model_dump() for f in payload.fields]
        if payload.filters is not None:
            report.filters = [f.model_dump() for f in payload.filters]
        if payload.sorting is not None:
            report.sorting = [s.model_dump() for s in payload.sorting]
        if payload.grouping is not None:
            report.grouping = payload.grouping
        if payload.is_template is not None:
            report.is_template = payload.is_template
        await db.commit()
        await db.refresh(report)
        return report

    async def delete(self, db: AsyncSession, report: CustomReport) -> None:
        await db.delete(report)
        await db.commit()

    # ------------------------------------------------------------------
    # Preview / Execute
    # ------------------------------------------------------------------

    async def preview(
        self,
        db: AsyncSession,
        data_source: str,
        fields: list[ReportField],
        filters: list[ReportFilter],
        sorting: list[ReportSort],
        grouping: list[str],
        page: int,
        page_size: int,
    ) -> ReportPreviewResponse:
        # Default to all catalogue fields if none specified
        if not fields:
            fields = self._default_fields(data_source)

        rows, total = await _execute_query(
            db, data_source, fields, filters, sorting, page, page_size
        )

        columns = [{"key": f.key, "label": f.label, "type": f.type} for f in fields]

        return ReportPreviewResponse(
            columns=columns,
            rows=rows,
            total=total,
            page=page,
            page_size=page_size,
        )

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    async def export_csv(
        self,
        db: AsyncSession,
        report: CustomReport,
        filter_overrides: list[ReportFilter] | None = None,
    ) -> bytes:
        fields = [ReportField(**f) for f in report.fields] if report.fields else []
        filters = [ReportFilter(**f) for f in report.filters] if report.filters else []
        sorting = [ReportSort(**s) for s in report.sorting] if report.sorting else []
        if filter_overrides:
            filters = filter_overrides

        if not fields:
            fields = self._default_fields(report.data_source)

        rows, _ = await _execute_query(
            db, report.data_source, fields, filters, sorting, page=1, page_size=10_000
        )

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=[f.key for f in fields])
        writer.writerow({f.key: f.label for f in fields})
        writer.writerows(rows)
        return output.getvalue().encode("utf-8")

    async def export_pdf(
        self,
        db: AsyncSession,
        report: CustomReport,
        filter_overrides: list[ReportFilter] | None = None,
    ) -> bytes:
        """Generate a simple PDF export using the pdf_service."""
        from app.services.pdf_service import pdf_service

        fields = [ReportField(**f) for f in report.fields] if report.fields else []
        filters = [ReportFilter(**f) for f in report.filters] if report.filters else []
        sorting = [ReportSort(**s) for s in report.sorting] if report.sorting else []
        if filter_overrides:
            filters = filter_overrides

        if not fields:
            fields = self._default_fields(report.data_source)

        rows, total = await _execute_query(
            db, report.data_source, fields, filters, sorting, page=1, page_size=10_000
        )

        report_data: dict[str, Any] = {
            "name": report.name,
            "description": report.description,
            "data_source": report.data_source,
            "generated_at": datetime.now(UTC).isoformat(),
            "total_rows": total,
            "columns": [{"key": f.key, "label": f.label} for f in fields],
            "rows": rows,
        }
        return await pdf_service.generate_custom_report_pdf(report_data)


custom_report_service = CustomReportService()
