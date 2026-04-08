"""Data import endpoints."""

import base64
import io
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import Response

from app.api.deps import DB, CurrentUser, RLSContext, require_coordinator_or_above
from app.core.exceptions import BadRequestException, NotFoundException
from app.schemas.import_schemas import (
    ColumnMapping,
    ImportConfirmRequest,
    ImportConfirmResponse,
    ImportEntityType,
    ImportErrorReportResponse,
    ImportJobListResponse,
    ImportJobResponse,
    ImportMapColumnsRequest,
    ImportTemplateResponse,
    ImportValidateRequest,
    ImportValidateResponse,
)
from app.services.import_service import import_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/templates/{entity_type}",
    response_model=ImportTemplateResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def get_import_template(
    entity_type: ImportEntityType,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ImportTemplateResponse:
    """Get import template for a specific entity type.

    Returns field definitions, example rows, and CSV headers for the template.
    """
    return await import_service.get_template(entity_type)


@router.get(
    "/templates/{entity_type}/download",
    dependencies=[Depends(require_coordinator_or_above)],
)
async def download_import_template(
    entity_type: ImportEntityType,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Response:
    """Download a CSV template file for import.

    Returns a pre-filled CSV template with headers and example row.
    """
    import csv

    template = await import_service.get_template(entity_type)

    # Generate CSV content
    output = io.StringIO()
    writer = csv.writer(output)

    # Write headers
    writer.writerow(template.csv_headers)

    # Write example rows
    for row in template.example_rows:
        writer.writerow([row.get(h, "") for h in template.csv_headers])

    content = output.getvalue()
    filename = f"{entity_type.value}_import_template.csv"

    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post(
    "/upload",
    response_model=ImportJobResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def upload_import_file(
    entity_type: ImportEntityType,
    file: Annotated[UploadFile, File(...)],
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ImportJobResponse:
    """Upload a CSV or Excel file for import.

    The file is parsed and an import job is created with auto-detected column mappings.
    Next step: call /map-columns to confirm or adjust mappings.
    """
    if not file.filename:
        raise BadRequestException("No filename provided")

    # Validate file type
    lower_name = file.filename.lower()
    if not (lower_name.endswith(".csv") or lower_name.endswith((".xlsx", ".xls"))):
        raise BadRequestException(
            "Unsupported file format. Please upload a CSV or Excel file (.csv, .xlsx, .xls)"
        )

    # Read file content
    content = await file.read()

    # Validate file size (max 10MB)
    max_size = 10 * 1024 * 1024
    if len(content) > max_size:
        raise BadRequestException(f"File too large. Maximum size is {max_size // (1024 * 1024)}MB")

    return await import_service.upload_file(content, file.filename, entity_type)


@router.post(
    "/map-columns",
    response_model=ImportJobResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def map_import_columns(
    request: ImportMapColumnsRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ImportJobResponse:
    """Set column mappings for an import job.

    Maps source columns to target fields. After mapping, call /validate to check the data.
    """
    mappings = [ColumnMapping(**m) for m in request.mappings]
    return await import_service.map_columns(
        request.import_id,
        mappings,
        request.default_values,
    )


@router.post(
    "/validate",
    response_model=ImportValidateResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def validate_import(
    request: ImportValidateRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ImportValidateResponse:
    """Validate import data.

    Checks for:
    - Required field validation
    - Format validation (email, phone, date, etc.)
    - Duplicate detection
    - Reference validation (e.g., client email exists)

    Returns a preview of valid/invalid rows with detailed error messages.
    """
    result = await import_service.validate(
        db,
        request.import_id,
        skip_duplicates=request.skip_duplicates,
    )
    return ImportValidateResponse(**result)


@router.post(
    "/confirm",
    response_model=ImportConfirmResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def confirm_import(
    request: ImportConfirmRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ImportConfirmResponse:
    """Execute the import after confirmation.

    Creates the entities in the database. Returns counts of imported, skipped, and failed rows.
    """
    result = await import_service.confirm_import(
        db,
        request.import_id,
        skip_invalid_rows=request.skip_invalid_rows,
        skip_warnings=request.skip_warnings,
        created_by_id=current_user.id,
    )
    return ImportConfirmResponse(**result)


@router.get(
    "/{import_id}",
    response_model=ImportJobResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def get_import_job(
    import_id: str,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ImportJobResponse:
    """Get import job details by ID."""
    job = await import_service.get_job(import_id)
    if not job:
        raise NotFoundException("Import job not found")
    return job


@router.get(
    "/{import_id}/errors",
    response_model=ImportErrorReportResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def get_import_error_report(
    import_id: str,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ImportErrorReportResponse:
    """Get a downloadable error report for an import job."""
    result = await import_service.get_error_report(import_id)
    return ImportErrorReportResponse(**result)


@router.get(
    "/{import_id}/errors/download",
    dependencies=[Depends(require_coordinator_or_above)],
)
async def download_import_error_report(
    import_id: str,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Response:
    """Download error report as CSV file."""
    result = await import_service.get_error_report(import_id)
    content = base64.b64decode(result["content"])

    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{result["filename"]}"',
        },
    )


@router.get(
    "/",
    response_model=ImportJobListResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def list_import_jobs(
    current_user: CurrentUser,
    _rls: RLSContext,
    limit: int = Query(20, ge=1, le=100),
) -> ImportJobListResponse:
    """List recent import jobs."""
    jobs = await import_service.list_jobs(limit)
    return ImportJobListResponse(jobs=jobs, total=len(jobs))
