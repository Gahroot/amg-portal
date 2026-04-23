"""Template handling, validation, preview, and DB reference loaders for imports."""

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.client_profile import ClientProfile
from app.models.partner import PartnerProfile
from app.models.program import Program
from app.models.user import User
from app.schemas.import_schemas import (
    ColumnMapping,
    ImportEntityType,
    ImportJobResponse,
    ImportStatus,
    ImportTemplateResponse,
)
from app.services.duplicate_detection_service import (
    FUZZY_SEARCH_LIMIT,
    _compute_match,
    _normalize_email,
    _normalize_name,
    _normalize_phone,
)
from app.services.import_parsers import (
    FIELD_DEFINITIONS,
    auto_detect_mappings,
    parse_csv,
    parse_excel,
    validate_row,
)

# In-memory storage for import jobs (in production, use Redis or database)
_import_jobs: dict[str, dict[str, Any]] = {}


class ImportValidationService:
    """Template handling, upload, column mapping, validation, and DB reference loaders."""

    async def get_template(self, entity_type: ImportEntityType) -> ImportTemplateResponse:
        """Get import template for an entity type."""
        fields = FIELD_DEFINITIONS.get(entity_type, [])
        csv_headers = [f.display_name for f in fields]
        example_rows = [
            {f.display_name: f.example_values[0] if f.example_values else "" for f in fields}
        ]

        return ImportTemplateResponse(
            entity_type=entity_type,
            fields=fields,
            example_rows=example_rows,
            csv_headers=csv_headers,
        )

    async def upload_file(
        self,
        content: bytes,
        filename: str,
        entity_type: ImportEntityType,
    ) -> ImportJobResponse:
        """Upload and parse an import file."""
        lower_name = filename.lower()
        loop = asyncio.get_running_loop()
        if lower_name.endswith(".csv"):
            columns, rows = await loop.run_in_executor(None, parse_csv, content)
        elif lower_name.endswith((".xlsx", ".xls")):
            columns, rows = await loop.run_in_executor(None, parse_excel, content)
        else:
            raise BadRequestException("Unsupported file format. Please upload a CSV or Excel file.")

        if not rows:
            raise BadRequestException("File contains no data rows")

        detected_mappings = auto_detect_mappings(columns, entity_type)

        import_id = str(uuid.uuid4())
        job_data: dict[str, Any] = {
            "import_id": import_id,
            "entity_type": entity_type,
            "filename": filename,
            "status": ImportStatus.PENDING,
            "columns": columns,
            "raw_rows": rows,
            "detected_mappings": detected_mappings,
            "mappings": [],
            "default_values": {},
            "errors": [],
            "warnings": [],
            "preview_rows": [],
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
        }
        _import_jobs[import_id] = job_data

        return ImportJobResponse(
            import_id=import_id,
            entity_type=entity_type,
            filename=filename,
            status=ImportStatus.PENDING,
            created_at=job_data["created_at"],
            updated_at=job_data["updated_at"],
            total_rows=len(rows),
            mappings=[],
        )

    async def map_columns(
        self,
        import_id: str,
        mappings: list[ColumnMapping],
        default_values: dict[str, Any] | None = None,
    ) -> ImportJobResponse:
        """Set column mappings for an import job."""
        job = _import_jobs.get(import_id)
        if not job:
            raise NotFoundException("Import job not found")

        job["mappings"] = [
            {
                "source_column": m.source_column,
                "target_field": m.target_field,
                "transform": m.transform,
            }
            for m in mappings
        ]
        job["default_values"] = default_values or {}
        job["status"] = ImportStatus.MAPPING
        job["updated_at"] = datetime.now(UTC)

        return ImportJobResponse(
            import_id=import_id,
            entity_type=job["entity_type"],
            filename=job["filename"],
            status=ImportStatus.MAPPING,
            created_at=job["created_at"],
            updated_at=job["updated_at"],
            total_rows=len(job["raw_rows"]),
            mappings=mappings,
        )

    async def validate(  # noqa: PLR0912, PLR0915
        self,
        db: AsyncSession,
        import_id: str,
        skip_duplicates: bool = False,
    ) -> dict[str, Any]:
        """Validate import data and return preview."""
        job = _import_jobs.get(import_id)
        if not job:
            raise NotFoundException("Import job not found")

        job["status"] = ImportStatus.VALIDATING
        job["errors"] = []
        job["warnings"] = []
        job["updated_at"] = datetime.now(UTC)

        entity_type = job["entity_type"]
        field_defs = FIELD_DEFINITIONS.get(entity_type, [])

        # Build mapping/transform lookups
        mapping_lookup: dict[str, str] = {}
        transform_lookup: dict[str, str | None] = {}
        for m in job["mappings"]:
            mapping_lookup[m["source_column"]] = m["target_field"]
            transform_lookup[m["source_column"]] = m.get("transform")

        preview_rows: list[dict[str, Any]] = []
        valid_count = 0
        invalid_count = 0
        warning_count = 0

        # Load reference data concurrently
        existing_clients, existing_programs, existing_users = await asyncio.gather(
            self._load_client_emails(db),
            self._load_program_titles(db),
            self._load_user_emails(db),
        )

        # Pre-load duplicate-check candidates once (avoids N+1 when entity_type==CLIENTS)
        dup_candidates: list[ClientProfile] = []
        if entity_type == ImportEntityType.CLIENTS and not skip_duplicates:
            dup_candidates = await self._load_dup_candidates(db, job["raw_rows"], job["mappings"])

        for row_num, raw_row in enumerate(job["raw_rows"], start=1):
            mapped_data, row_errors, row_warnings = validate_row(
                row_num=row_num,
                raw_row=raw_row,
                columns=job["columns"],
                mapping_lookup=mapping_lookup,
                transform_lookup=transform_lookup,
                default_values=job.get("default_values", {}),
                field_defs=field_defs,
            )

            # Reference / duplicate checks (require DB access)
            if entity_type == ImportEntityType.CLIENTS:
                legal_name = mapped_data.get("legal_name")
                primary_email = mapped_data.get("primary_email")
                phone = mapped_data.get("phone")
                has_name = not skip_duplicates and legal_name
                if has_name or primary_email:
                    matches = [
                        _compute_match(c, legal_name, primary_email, phone) for c in dup_candidates
                    ]
                    duplicates = sorted(
                        (m for m in matches if m is not None),
                        key=lambda m: m.similarity_score,
                        reverse=True,
                    )[:10]
                    for dup in duplicates:
                        row_warnings.append(
                            {
                                "row_number": row_num,
                                "field": "legal_name",
                                "warning_type": "duplicate_match",
                                "message": (
                                    f"Potential duplicate: {dup.legal_name} "
                                    f"({int(dup.similarity_score * 100)}% match)"
                                ),
                                "value": legal_name,
                                "existing_id": dup.client_id,
                                "existing_name": dup.legal_name,
                            }
                        )

                rm_email = mapped_data.get("assigned_rm_email")
                if rm_email and rm_email not in existing_users:
                    row_errors.append(
                        {
                            "row_number": row_num,
                            "field": "assigned_rm_email",
                            "error_type": "reference",
                            "message": f"Relationship manager not found: {rm_email}",
                            "value": rm_email,
                        }
                    )

            elif entity_type == ImportEntityType.PROGRAMS:
                client_email = mapped_data.get("client_email")
                if client_email and client_email not in existing_clients:
                    row_errors.append(
                        {
                            "row_number": row_num,
                            "field": "client_email",
                            "error_type": "reference",
                            "message": f"Client not found with email: {client_email}",
                            "value": client_email,
                        }
                    )

            elif entity_type == ImportEntityType.TASKS:
                program_title = mapped_data.get("program_title")
                if program_title and program_title not in existing_programs:
                    row_warnings.append(
                        {
                            "row_number": row_num,
                            "field": "program_title",
                            "warning_type": "reference",
                            "message": (
                                f"Program not found: {program_title}. "
                                "Task will be created without program association."
                            ),
                            "value": program_title,
                        }
                    )

                assignee_email = mapped_data.get("assigned_to_email")
                if assignee_email and assignee_email not in existing_users:
                    row_errors.append(
                        {
                            "row_number": row_num,
                            "field": "assigned_to_email",
                            "error_type": "reference",
                            "message": f"User not found: {assignee_email}",
                            "value": assignee_email,
                        }
                    )

            is_valid = len(row_errors) == 0
            if is_valid:
                valid_count += 1
            else:
                invalid_count += 1
            if row_warnings:
                warning_count += 1

            job["errors"].extend(row_errors)
            job["warnings"].extend(row_warnings)

            if len(preview_rows) < 100:
                preview_rows.append(
                    {
                        "row_number": row_num,
                        "data": raw_row,
                        "mapped_data": mapped_data,
                        "is_valid": is_valid,
                        "errors": row_errors,
                        "warnings": row_warnings,
                    }
                )

        job["preview_rows"] = preview_rows
        job["status"] = ImportStatus.PREVIEW
        job["valid_rows"] = valid_count
        job["invalid_rows"] = invalid_count
        job["rows_with_warnings"] = warning_count
        job["updated_at"] = datetime.now(UTC)

        return {
            "import_id": import_id,
            "status": job["status"],
            "total_rows": len(job["raw_rows"]),
            "valid_rows": valid_count,
            "invalid_rows": invalid_count,
            "rows_with_warnings": warning_count,
            "errors": job["errors"],
            "warnings": job["warnings"],
            "preview_rows": preview_rows,
        }

    # --- DB reference loaders ---

    async def _load_client_emails(self, db: AsyncSession) -> set[str]:
        """Load all client emails for reference validation."""
        result = await db.execute(select(ClientProfile.primary_email))
        return {row[0].lower() for row in result.fetchall()}

    async def _load_partner_emails(self, db: AsyncSession) -> set[str]:
        """Load all partner emails for reference validation."""
        result = await db.execute(select(PartnerProfile.contact_email))
        return {row[0].lower() for row in result.fetchall()}

    async def _load_program_titles(self, db: AsyncSession) -> set[str]:
        """Load all program titles for reference validation."""
        result = await db.execute(select(Program.title))
        return {row[0] for row in result.fetchall()}

    async def _load_user_emails(self, db: AsyncSession) -> set[str]:
        """Load all user emails for reference validation."""
        result = await db.execute(select(User.email))
        return {row[0].lower() for row in result.fetchall()}

    async def _load_client_email_to_id(self, db: AsyncSession) -> dict[str, uuid.UUID]:
        """Load client email-to-ID mapping."""
        result = await db.execute(select(ClientProfile.id, ClientProfile.primary_email))
        return {row[1].lower(): row[0] for row in result.fetchall()}

    async def _load_user_email_to_id(self, db: AsyncSession) -> dict[str, uuid.UUID]:
        """Load user email-to-ID mapping."""
        result = await db.execute(select(User.id, User.email))
        return {row[1].lower(): row[0] for row in result.fetchall()}

    async def _load_dup_candidates(  # noqa: PLR0912
        self,
        db: AsyncSession,
        raw_rows: list[dict[str, str]],
        mappings: list[dict[str, Any]],
    ) -> list[ClientProfile]:
        """Batch-load client duplicate candidates for all rows in the import."""
        mapping_lookup = {m["source_column"]: m["target_field"] for m in mappings}

        names: list[str] = []
        emails: list[str] = []
        phones: list[str] = []

        for raw_row in raw_rows:
            for col, value in raw_row.items():
                field = mapping_lookup.get(col)
                if not field or not value:
                    continue
                v = str(value).strip()
                if not v:
                    continue
                if field == "legal_name":
                    names.append(v)
                elif field == "primary_email":
                    emails.append(v)
                elif field == "phone":
                    phones.append(v)

        conditions = []

        for email in emails:
            norm = _normalize_email(email)
            local_part = norm.split("@")[0]
            conditions.append(ClientProfile.primary_email.ilike(norm))
            if local_part:
                conditions.append(ClientProfile.primary_email.ilike(f"{local_part}@%"))
                conditions.append(ClientProfile.secondary_email.ilike(f"{local_part}@%"))

        for name in names:
            first_token = _normalize_name(name).split()
            if first_token and len(first_token[0]) >= 3:
                t = first_token[0]
                conditions.append(ClientProfile.legal_name.ilike(f"%{t}%"))
                conditions.append(ClientProfile.display_name.ilike(f"%{t}%"))

        for phone in phones:
            norm = _normalize_phone(phone)
            if norm and len(norm) >= 7:
                conditions.append(ClientProfile.phone.ilike(f"%{norm[-7:]}"))

        if not conditions:
            return []

        stmt = select(ClientProfile).where(or_(*conditions)).limit(FUZZY_SEARCH_LIMIT)
        result = await db.execute(stmt)
        return list(result.scalars().all())
