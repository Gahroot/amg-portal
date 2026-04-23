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
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.enums import TaskPriority, TaskStatus
from app.schemas.import_schemas import (
    ColumnMapping,
    ImportEntityType,
    ImportError,
    ImportJobResponse,
    ImportStatus,
    ImportWarning,
)
from app.services.client_service import client_service
from app.services.import_validation import ImportValidationService, _import_jobs

from .import_validation import *  # noqa: F401, F403

logger = logging.getLogger(__name__)


class ImportService(ImportValidationService):
    """Service for handling data imports."""

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
