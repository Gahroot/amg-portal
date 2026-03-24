"""Custom report builder API endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import DB, CurrentUser, RLSContext, require_internal
from app.core.exceptions import ForbiddenException, NotFoundException
from app.schemas.custom_report import (
    CustomReportCreate,
    CustomReportListResponse,
    CustomReportResponse,
    CustomReportUpdate,
    ExportFormat,
    ReportExportRequest,
    ReportPreviewRequest,
    ReportPreviewResponse,
)
from app.services.custom_report_service import custom_report_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Data source catalogue
# ---------------------------------------------------------------------------


@router.get("/data-sources", dependencies=[Depends(require_internal)])
async def list_data_sources(
    _rls: RLSContext,
) -> list[dict[str, Any]]:
    """Return all available report data sources."""
    return custom_report_service.get_all_data_sources()


@router.get("/data-sources/{source}/fields", dependencies=[Depends(require_internal)])
async def list_source_fields(
    source: str,
    _rls: RLSContext,
) -> list[dict[str, Any]]:
    """Return available fields for a given data source."""
    fields = custom_report_service.get_available_fields(source)
    if not fields:
        raise NotFoundException(f"Unknown data source: {source}")
    return fields


# ---------------------------------------------------------------------------
# Preview (ad-hoc execution, no saved report required)
# ---------------------------------------------------------------------------


@router.post(
    "/preview",
    response_model=ReportPreviewResponse,
    dependencies=[Depends(require_internal)],
)
async def preview_report(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    payload: ReportPreviewRequest,
) -> ReportPreviewResponse:
    """Execute a report definition and return a paginated preview."""
    return await custom_report_service.preview(
        db=db,
        data_source=payload.data_source,
        fields=payload.fields,
        filters=payload.filters,
        sorting=payload.sorting,
        grouping=payload.grouping,
        page=payload.page,
        page_size=payload.page_size,
    )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.post(
    "/",
    response_model=CustomReportResponse,
    status_code=201,
    dependencies=[Depends(require_internal)],
)
async def create_report(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    payload: CustomReportCreate,
) -> CustomReportResponse:
    """Save a new custom report."""
    report = await custom_report_service.create(db, payload, current_user.id)
    return CustomReportResponse.model_validate(report)


@router.get(
    "/",
    response_model=CustomReportListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_reports(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    templates_only: bool = False,
) -> CustomReportListResponse:
    """List saved reports for the current user (plus shared templates)."""
    reports = await custom_report_service.list_reports(
        db,
        created_by=current_user.id,
        include_templates=not templates_only,
    )
    return CustomReportListResponse(
        reports=[CustomReportResponse.model_validate(r) for r in reports],
        total=len(reports),
    )


@router.get(
    "/{report_id}",
    response_model=CustomReportResponse,
    dependencies=[Depends(require_internal)],
)
async def get_report(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    report_id: uuid.UUID,
) -> CustomReportResponse:
    """Get a single custom report by ID."""
    report = await custom_report_service.get(db, report_id)
    if not report:
        raise NotFoundException("Custom report not found")
    # Allow access to own reports or templates
    if report.created_by != current_user.id and not report.is_template:
        raise ForbiddenException("You do not have access to this report")
    return CustomReportResponse.model_validate(report)


@router.patch(
    "/{report_id}",
    response_model=CustomReportResponse,
    dependencies=[Depends(require_internal)],
)
async def update_report(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    report_id: uuid.UUID,
    payload: CustomReportUpdate,
) -> CustomReportResponse:
    """Update an existing custom report."""
    report = await custom_report_service.get(db, report_id)
    if not report:
        raise NotFoundException("Custom report not found")
    if report.created_by != current_user.id:
        raise ForbiddenException("You can only edit your own reports")
    report = await custom_report_service.update(db, report, payload)
    return CustomReportResponse.model_validate(report)


@router.delete(
    "/{report_id}",
    status_code=204,
    dependencies=[Depends(require_internal)],
)
async def delete_report(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    report_id: uuid.UUID,
) -> None:
    """Delete a custom report."""
    report = await custom_report_service.get(db, report_id)
    if not report:
        raise NotFoundException("Custom report not found")
    if report.created_by != current_user.id:
        raise ForbiddenException("You can only delete your own reports")
    await custom_report_service.delete(db, report)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


@router.post(
    "/{report_id}/export",
    dependencies=[Depends(require_internal)],
)
async def export_report(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    report_id: uuid.UUID,
    payload: ReportExportRequest,
) -> StreamingResponse:
    """Export a saved report as CSV or PDF."""
    report = await custom_report_service.get(db, report_id)
    if not report:
        raise NotFoundException("Custom report not found")
    if report.created_by != current_user.id and not report.is_template:
        raise ForbiddenException("You do not have access to this report")

    fmt: ExportFormat = payload.format
    filter_overrides = payload.filters

    if fmt == "csv":
        data = await custom_report_service.export_csv(db, report, filter_overrides)
        filename = f"{report.name.replace(' ', '_')}.csv"
        return StreamingResponse(
            iter([data]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    elif fmt == "pdf":
        data = await custom_report_service.export_pdf(db, report, filter_overrides)
        filename = f"{report.name.replace(' ', '_')}.pdf"
        return StreamingResponse(
            iter([data]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    else:
        # Excel — generate CSV-compatible format with .xlsx extension
        # For a real Excel export, openpyxl would be used; here we fall back to CSV
        data = await custom_report_service.export_csv(db, report, filter_overrides)
        filename = f"{report.name.replace(' ', '_')}.csv"
        return StreamingResponse(
            iter([data]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
