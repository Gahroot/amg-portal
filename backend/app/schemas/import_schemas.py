"""Schemas for data import wizard."""

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255, Str500, Str2000, TextStr


class ImportEntityType(StrEnum):
    """Supported entity types for import."""

    CLIENTS = "clients"
    PARTNERS = "partners"
    PROGRAMS = "programs"
    TASKS = "tasks"


class ImportStatus(StrEnum):
    """Status of an import job."""

    PENDING = "pending"
    VALIDATING = "validating"
    MAPPING = "mapping"
    PREVIEW = "preview"
    IMPORTING = "importing"
    COMPLETED = "completed"
    FAILED = "failed"


class ColumnMapping(BaseModel):
    """Mapping from a source column to a target field."""

    source_column: Str255
    target_field: Str100
    # Optional transform: "uppercase", "lowercase", "date:YYYY-MM-DD", etc.
    transform: Str100 | None = None


class ImportError(BaseModel):
    """An error found during import validation."""

    row_number: int
    column: Str255 | None = None
    field: Str100 | None = None
    error_type: Str50  # "required", "format", "duplicate", "reference", "value"
    message: Str2000
    value: Any | None = None


class ImportWarning(BaseModel):
    """A warning found during import validation (non-blocking)."""

    row_number: int
    column: Str255 | None = None
    field: Str100 | None = None
    warning_type: Str50  # "duplicate_match", "similar_existing", "missing_optional"
    message: Str2000
    value: Any | None = None
    existing_id: UUID | None = None
    existing_name: Str255 | None = None


class ImportPreviewRow(BaseModel):
    """A single row preview with validation status."""

    row_number: int
    data: dict[str, Any]
    mapped_data: dict[str, Any]
    is_valid: bool
    errors: list[ImportError] = []
    warnings: list[ImportWarning] = []


# --- Field Definitions ---


class ImportFieldDefinition(BaseModel):
    """Definition of an importable field."""

    name: Str100
    display_name: Str255
    description: Str500 | None = None
    required: bool = False
    field_type: Str50  # "string", "email", "phone", "date", "number", "enum", "uuid"
    enum_values: list[str] | None = None
    default_value: Any | None = None
    validation_regex: Str500 | None = None
    example_values: list[str] = []


class ImportTemplateResponse(BaseModel):
    """Template for a specific entity type."""

    entity_type: ImportEntityType
    fields: list[ImportFieldDefinition]
    example_rows: list[dict[str, Any]]
    csv_headers: list[str]


# --- Request/Response Schemas ---


class ImportUploadResponse(BaseModel):
    """Response after uploading a file."""

    import_id: Str100
    filename: Str255
    row_count: int
    columns: list[str]
    detected_mappings: dict[str, str] | None = None  # Auto-detected column -> field mappings
    status: ImportStatus


class ImportMapColumnsRequest(BaseModel):
    """Request to set column mappings."""

    import_id: Str100
    mappings: list[ColumnMapping]
    default_values: dict[str, Any] | None = None


class ImportValidateRequest(BaseModel):
    """Request to validate import data."""

    import_id: Str100
    skip_duplicates: bool = False


class ImportValidateResponse(BaseModel):
    """Response after validation."""

    import_id: Str100
    status: ImportStatus
    total_rows: int
    valid_rows: int
    invalid_rows: int
    rows_with_warnings: int
    errors: list[ImportError]
    warnings: list[ImportWarning]
    preview_rows: list[ImportPreviewRow]  # First N rows for preview


class ImportConfirmRequest(BaseModel):
    """Request to confirm and execute the import."""

    import_id: Str100
    skip_invalid_rows: bool = True
    skip_warnings: bool = False


class ImportConfirmResponse(BaseModel):
    """Response after import execution."""

    import_id: Str100
    status: ImportStatus
    total_rows: int
    imported_rows: int
    skipped_rows: int
    failed_rows: int
    created_ids: list[UUID]  # IDs of successfully created entities
    errors: list[ImportError]


class ImportErrorReportResponse(BaseModel):
    """Downloadable error report."""

    import_id: Str100
    filename: Str255
    content_type: Str100
    content: TextStr  # Base64-encoded CSV content


class ImportJobResponse(BaseModel):
    """Full import job status."""

    import_id: Str100
    entity_type: ImportEntityType
    filename: Str255
    status: ImportStatus
    created_at: datetime
    updated_at: datetime
    total_rows: int | None = None
    valid_rows: int | None = None
    invalid_rows: int | None = None
    imported_rows: int | None = None
    errors: list[ImportError] = []
    warnings: list[ImportWarning] = []
    mappings: list[ColumnMapping] = []

    model_config = ConfigDict(from_attributes=True)


class ImportJobListResponse(BaseModel):
    """List of import jobs."""

    jobs: list[ImportJobResponse]
    total: int


# --- Entity-Specific Row Data ---


class ClientImportRow(BaseModel):
    """Data for a single client import row."""

    legal_name: Str255
    display_name: Str255 | None = None
    entity_type: Str100 | None = None
    jurisdiction: Str100 | None = None
    tax_id: Str100 | None = None
    primary_email: Str255
    secondary_email: Str255 | None = None
    phone: Str50 | None = None
    address: Str2000 | None = None
    communication_preference: Str50 | None = None
    sensitivities: Str2000 | None = None
    special_instructions: Str2000 | None = None
    birth_date: date | None = None
    assigned_rm_email: Str255 | None = None  # For RM assignment by email


class PartnerImportRow(BaseModel):
    """Data for a single partner import row."""

    firm_name: Str255
    contact_name: Str255
    contact_email: Str255
    contact_phone: Str50 | None = None
    capabilities: Str2000 | None = None  # Comma-separated
    geographies: Str2000 | None = None  # Comma-separated
    notes: Str2000 | None = None


class ProgramImportRow(BaseModel):
    """Data for a single program import row."""

    title: Str255
    client_email: Str255  # Reference by client email
    objectives: Str2000 | None = None
    scope: Str2000 | None = None
    budget_envelope: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: Str50 | None = None


class TaskImportRow(BaseModel):
    """Data for a single task import row."""

    title: Str255
    program_title: Str255 | None = None  # Reference by program title
    milestone_title: Str255 | None = None  # Reference by milestone title within program
    description: Str2000 | None = None
    due_date: date | None = None
    assigned_to_email: Str255 | None = None  # Reference by user email
    priority: Str50 | None = None
    status: Str50 | None = None
