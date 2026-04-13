"""Service for importing data from CSV/Excel files.

Handles job lifecycle, DB write operations, and reference/duplicate validation.
Pure parsing logic lives in import_parsers.py.
"""

import asyncio
import base64
import contextlib
import csv
import io
import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, cast

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.client_profile import ClientProfile
from app.models.enums import TaskPriority, TaskStatus
from app.models.partner import PartnerProfile
from app.models.program import Program
from app.models.user import User
from app.schemas.import_schemas import (
    ColumnMapping,
    ImportEntityType,
    ImportError,
    ImportJobResponse,
    ImportStatus,
    ImportTemplateResponse,
    ImportWarning,
)
from app.services.client_service import client_service
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

logger = logging.getLogger(__name__)

# In-memory storage for import jobs (in production, use Redis or database)
_import_jobs: dict[str, dict[str, Any]] = {}


class ImportService:
    """Service for handling data imports."""

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
            created_at=cast(datetime, job_data["created_at"]),
            updated_at=cast(datetime, job_data["updated_at"]),
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

    async def confirm_import(  # noqa: PLR0912, PLR0915
        self,
        db: AsyncSession,
        import_id: str,
        skip_invalid_rows: bool = True,
        skip_warnings: bool = False,
        created_by_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Execute the import after confirmation."""
        job = _import_jobs.get(import_id)
        if not job:
            raise NotFoundException("Import job not found")

        if job["status"] != ImportStatus.PREVIEW:
            raise BadRequestException("Import must be validated before confirmation")

        job["status"] = ImportStatus.IMPORTING
        job["updated_at"] = datetime.now(UTC)

        entity_type = job["entity_type"]
        created_ids: list[uuid.UUID] = []
        import_errors: list[dict[str, Any]] = []
        imported_count = 0
        skipped_count = 0
        failed_count = 0

        error_rows: set[int] = {err["row_number"] for err in job["errors"]}
        warning_rows: set[int] = {warn["row_number"] for warn in job["warnings"]}

        # Load reference data concurrently
        client_email_to_id, user_email_to_id = await asyncio.gather(
            self._load_client_email_to_id(db),
            self._load_user_email_to_id(db),
        )

        # Suppress per-row audit log entries during bulk import
        db.info["skip_audit"] = True

        for preview_row in job["preview_rows"]:
            row_num = preview_row["row_number"]
            mapped_data = preview_row["mapped_data"]

            if skip_invalid_rows and row_num in error_rows:
                skipped_count += 1
                continue

            if skip_warnings and row_num in warning_rows:
                skipped_count += 1
                continue

            try:
                if entity_type == ImportEntityType.CLIENTS:
                    created_id = await self._import_client(
                        db, mapped_data, user_email_to_id, created_by_id
                    )
                    if created_id:
                        created_ids.append(created_id)
                        imported_count += 1

                elif entity_type == ImportEntityType.PARTNERS:
                    created_id = await self._import_partner(db, mapped_data, created_by_id)
                    if created_id:
                        created_ids.append(created_id)
                        imported_count += 1

                elif entity_type == ImportEntityType.PROGRAMS:
                    created_id = await self._import_program(
                        db, mapped_data, client_email_to_id, created_by_id
                    )
                    if created_id:
                        created_ids.append(created_id)
                        imported_count += 1

                elif entity_type == ImportEntityType.TASKS:
                    created_id = await self._import_task(db, mapped_data, user_email_to_id)
                    if created_id:
                        created_ids.append(created_id)
                        imported_count += 1

            except Exception as e:
                logger.error(f"Import failed for row {row_num}: {e}")
                import_errors.append(
                    {
                        "row_number": row_num,
                        "error_type": "import",
                        "message": str(e),
                        "field": None,
                        "value": None,
                    }
                )
                failed_count += 1

        await db.commit()

        job["status"] = ImportStatus.COMPLETED if failed_count == 0 else ImportStatus.FAILED
        job["imported_rows"] = imported_count
        job["skipped_rows"] = skipped_count
        job["failed_rows"] = failed_count
        job["created_ids"] = [str(id) for id in created_ids]
        job["errors"].extend(import_errors)
        job["updated_at"] = datetime.now(UTC)

        return {
            "import_id": import_id,
            "status": job["status"],
            "total_rows": len(job["raw_rows"]),
            "imported_rows": imported_count,
            "skipped_rows": skipped_count,
            "failed_rows": failed_count,
            "created_ids": created_ids,
            "errors": import_errors,
        }

    async def get_error_report(self, import_id: str) -> dict[str, Any]:
        """Generate a downloadable error report CSV."""
        job = _import_jobs.get(import_id)
        if not job:
            raise NotFoundException("Import job not found")

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Row", "Column", "Field", "Error Type", "Message", "Value"])

        for err in job.get("errors", []):
            writer.writerow(
                [
                    err.get("row_number", ""),
                    err.get("column", ""),
                    err.get("field", ""),
                    err.get("error_type", ""),
                    err.get("message", ""),
                    err.get("value", ""),
                ]
            )

        writer.writerow([])
        writer.writerow(["Warnings:"])
        for warn in job.get("warnings", []):
            writer.writerow(
                [
                    warn.get("row_number", ""),
                    warn.get("column", ""),
                    warn.get("field", ""),
                    warn.get("warning_type", ""),
                    warn.get("message", ""),
                    warn.get("value", ""),
                ]
            )

        content = output.getvalue()
        encoded = base64.b64encode(content.encode()).decode()

        return {
            "import_id": import_id,
            "filename": f"import_errors_{import_id[:8]}.csv",
            "content_type": "text/csv",
            "content": encoded,
        }

    async def get_job(self, import_id: str) -> ImportJobResponse | None:
        """Get import job by ID."""
        job = _import_jobs.get(import_id)
        if not job:
            return None

        mappings = [
            ColumnMapping(
                source_column=m["source_column"],
                target_field=m["target_field"],
                transform=m.get("transform"),
            )
            for m in job.get("mappings", [])
        ]

        return ImportJobResponse(
            import_id=import_id,
            entity_type=job["entity_type"],
            filename=job["filename"],
            status=job["status"],
            created_at=job["created_at"],
            updated_at=job["updated_at"],
            total_rows=len(job.get("raw_rows", [])),
            valid_rows=job.get("valid_rows"),
            invalid_rows=job.get("invalid_rows"),
            imported_rows=job.get("imported_rows"),
            errors=[ImportError(**e) for e in job.get("errors", [])],
            warnings=[ImportWarning(**w) for w in job.get("warnings", [])],
            mappings=mappings,
        )

    async def list_jobs(self, limit: int = 20) -> list[ImportJobResponse]:
        """List recent import jobs."""
        jobs = sorted(
            _import_jobs.values(),
            key=lambda j: j["created_at"],
            reverse=True,
        )[:limit]

        results = []
        for j in jobs:
            job = await self.get_job(j["import_id"])
            if job:
                results.append(job)
        return results

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

    # --- DB write operations ---

    async def _import_client(
        self,
        db: AsyncSession,
        data: dict[str, Any],
        user_email_to_id: dict[str, uuid.UUID],
        created_by_id: uuid.UUID | None,
    ) -> uuid.UUID | None:
        """Import a single client."""
        from app.schemas.client_profile import ClientProfileCreate

        assigned_rm_id = None
        rm_email = data.get("assigned_rm_email")
        if rm_email:
            assigned_rm_id = user_email_to_id.get(rm_email.lower())

        create_data = ClientProfileCreate(
            legal_name=data.get("legal_name", ""),
            display_name=data.get("display_name") or None,
            entity_type=data.get("entity_type") or None,
            jurisdiction=data.get("jurisdiction") or None,
            tax_id=data.get("tax_id") or None,
            primary_email=data.get("primary_email", ""),
            secondary_email=data.get("secondary_email") or None,
            phone=data.get("phone") or None,
            address=data.get("address") or None,
            communication_preference=data.get("communication_preference") or None,
            sensitivities=data.get("sensitivities") or None,
            special_instructions=data.get("special_instructions") or None,
        )

        client = await client_service.create_intake(
            db,
            data=create_data,
            created_by_id=created_by_id or uuid.UUID("00000000-0000-0000-0000-000000000000"),
        )

        if assigned_rm_id and client:
            client.assigned_rm_id = assigned_rm_id

        return client.id if client else None

    async def _import_partner(
        self,
        db: AsyncSession,
        data: dict[str, Any],
        created_by_id: uuid.UUID | None,
    ) -> uuid.UUID | None:
        """Import a single partner."""
        from app.models.enums import PartnerStatus
        from app.models.partner import PartnerProfile

        capabilities = (
            [c.strip() for c in data["capabilities"].split(",")] if data.get("capabilities") else []
        )
        geographies = (
            [g.strip() for g in data["geographies"].split(",")] if data.get("geographies") else []
        )

        partner = PartnerProfile(
            firm_name=data.get("firm_name", ""),
            contact_name=data.get("contact_name", ""),
            contact_email=data.get("contact_email", ""),
            contact_phone=data.get("contact_phone") or None,
            capabilities=capabilities,
            geographies=geographies,
            notes=data.get("notes") or None,
            status=PartnerStatus.active.value,
            availability_status="available",
            compliance_verified=False,
            total_assignments=0,
            completed_assignments=0,
            created_by=created_by_id or uuid.UUID("00000000-0000-0000-0000-000000000000"),
        )

        db.add(partner)
        await db.flush()
        await db.refresh(partner)
        return partner.id

    async def _import_program(
        self,
        db: AsyncSession,
        data: dict[str, Any],
        client_email_to_id: dict[str, uuid.UUID],
        created_by_id: uuid.UUID | None,
    ) -> uuid.UUID | None:
        """Import a single program."""
        from app.models.enums import ProgramStatus
        from app.models.program import Program

        client_email = data.get("client_email", "").lower()
        client_id = client_email_to_id.get(client_email)
        if not client_id:
            raise ValueError(f"Client not found: {client_email}")

        budget = None
        if data.get("budget_envelope"):
            with contextlib.suppress(InvalidOperation, ValueError):
                budget = Decimal(data["budget_envelope"])

        status_val = data.get("status") or ProgramStatus.intake.value

        program = Program(
            client_id=client_id,
            title=data.get("title", ""),
            objectives=data.get("objectives") or None,
            scope=data.get("scope") or None,
            budget_envelope=budget,
            start_date=data.get("start_date") or None,
            end_date=data.get("end_date") or None,
            status=status_val,
            created_by=created_by_id or uuid.UUID("00000000-0000-0000-0000-000000000000"),
        )

        db.add(program)
        await db.flush()
        await db.refresh(program)
        return program.id

    async def _import_task(
        self,
        db: AsyncSession,
        data: dict[str, Any],
        user_email_to_id: dict[str, uuid.UUID],
    ) -> uuid.UUID | None:
        """Import a single task (standalone; can be linked to program later)."""
        from app.models.task import Task

        assignee_id = None
        assignee_email = data.get("assigned_to_email")
        if assignee_email:
            assignee_id = user_email_to_id.get(assignee_email.lower())

        priority = TaskPriority.medium
        if data.get("priority"):
            with contextlib.suppress(ValueError):
                priority = TaskPriority(data["priority"].lower())

        status_val = TaskStatus.todo
        if data.get("status"):
            with contextlib.suppress(ValueError):
                status_val = TaskStatus(data["status"].lower())

        task = Task(
            title=data.get("title", ""),
            description=data.get("description") or None,
            due_date=data.get("due_date") or None,
            assigned_to=assignee_id,
            priority=priority,
            status=status_val,
        )

        db.add(task)
        await db.flush()
        await db.refresh(task)
        return task.id


import_service = ImportService()
