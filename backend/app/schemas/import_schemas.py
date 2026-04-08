"""Schemas for data import wizard."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ImportEntityType(str, Enum):
    """Supported entity types for import."""

    CLIENTS = "clients"
    PARTNERS = "partners"
    PROGRAMS = "programs"
    TASKS = "tasks"


class ImportStatus(str, Enum):
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

    source_column: str
    target_field: str
    transform: str | None = None  # Optional transform: "uppercase", "lowercase", "date:YYYY-MM-DD", etc.


class ImportError(BaseModel):
    """An error found during import validation."""

    row_number: int
    column: str | None = None
    field: str | None = None
    error_type: str  # "required", "format", "duplicate", "reference", "value"
    message: str
    value: Any | None = None


class ImportWarning(BaseModel):
    """A warning found during import validation (non-blocking)."""

    row_number: int
    column: str | None = None
    field: str | None = None
    warning_type: str  # "duplicate_match", "similar_existing", "missing_optional"
    message: str
    value: Any | None = None
    existing_id: UUID | None = None
    existing_name: str | None = None


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

    name: str
    display_name: str
    description: str | None = None
    required: bool = False
    field_type: str  # "string", "email", "phone", "date", "number", "enum", "uuid"
    enum_values: list[str] | None = None
    default_value: Any | None = None
    validation_regex: str | None = None
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

    import_id: str
    filename: str
    row_count: int
    columns: list[str]
    detected_mappings: dict[str, str] | None = None  # Auto-detected column -> field mappings
    status: ImportStatus


class ImportMapColumnsRequest(BaseModel):
    """Request to set column mappings."""

    import_id: str
    mappings: list[ColumnMapping]
    default_values: dict[str, Any] | None = None


class ImportValidateRequest(BaseModel):
    """Request to validate import data."""

    import_id: str
    skip_duplicates: bool = False


class ImportValidateResponse(BaseModel):
    """Response after validation."""

    import_id: str
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

    import_id: str
    skip_invalid_rows: bool = True
    skip_warnings: bool = False


class ImportConfirmResponse(BaseModel):
    """Response after import execution."""

    import_id: str
    status: ImportStatus
    total_rows: int
    imported_rows: int
    skipped_rows: int
    failed_rows: int
    created_ids: list[UUID]  # IDs of successfully created entities
    errors: list[ImportError]


class ImportErrorReportResponse(BaseModel):
    """Downloadable error report."""

    import_id: str
    filename: str
    content_type: str
    content: str  # Base64-encoded CSV content


class ImportJobResponse(BaseModel):
    """Full import job status."""

    import_id: str
    entity_type: ImportEntityType
    filename: str
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

    legal_name: str
    display_name: str | None = None
    entity_type: str | None = None
    jurisdiction: str | None = None
    tax_id: str | None = None
    primary_email: str
    secondary_email: str | None = None
    phone: str | None = None
    address: str | None = None
    communication_preference: str | None = None
    sensitivities: str | None = None
    special_instructions: str | None = None
    birth_date: date | None = None
    assigned_rm_email: str | None = None  # For RM assignment by email


class PartnerImportRow(BaseModel):
    """Data for a single partner import row."""

    firm_name: str
    contact_name: str
    contact_email: str
    contact_phone: str | None = None
    capabilities: str | None = None  # Comma-separated
    geographies: str | None = None  # Comma-separated
    notes: str | None = None


class ProgramImportRow(BaseModel):
    """Data for a single program import row."""

    title: str
    client_email: str  # Reference by client email
    objectives: str | None = None
    scope: str | None = None
    budget_envelope: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None


class TaskImportRow(BaseModel):
    """Data for a single task import row."""

    title: str
    program_title: str | None = None  # Reference by program title
    milestone_title: str | None = None  # Reference by milestone title within program
    description: str | None = None
    due_date: date | None = None
    assigned_to_email: str | None = None  # Reference by user email
    priority: str | None = None
    status: str | None = None
