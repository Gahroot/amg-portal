"""Service for two-person delete authorization & retention.

Governance rule (Design Doc §06): *All deletion events are logged — nothing
is permanently erased without a two-person authorization and audit record.*

Status flow:  pending → approved → executed (after retention) OR rejected
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deletion_request import DeletionRequest
from app.schemas.deletion_request import DeletionRequestCreate

logger = logging.getLogger(__name__)

_VALID_ENTITY_TYPES = frozenset({"client_profile", "document", "program"})


class DeletionService:
    """Handles deletion requests with two-person authorization and retention periods."""

    # ------------------------------------------------------------------
    # CRUD helpers
    # ------------------------------------------------------------------

    async def get(self, db: AsyncSession, request_id: uuid.UUID) -> DeletionRequest | None:
        result = await db.execute(
            select(DeletionRequest).where(DeletionRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    async def list_requests(
        self,
        db: AsyncSession,
        *,
        status: str | None = None,
        entity_type: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[DeletionRequest], int]:
        """List deletion requests with optional filters."""
        query = select(DeletionRequest)
        count_query = select(func.count()).select_from(DeletionRequest)

        if status:
            query = query.where(DeletionRequest.status == status)
            count_query = count_query.where(DeletionRequest.status == status)

        if entity_type:
            query = query.where(DeletionRequest.entity_type == entity_type)
            count_query = count_query.where(DeletionRequest.entity_type == entity_type)

        query = query.order_by(DeletionRequest.created_at.desc())

        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.offset(skip).limit(limit))
        requests = list(result.scalars().all())
        return requests, total

    async def create_request(
        self,
        db: AsyncSession,
        *,
        data: DeletionRequestCreate,
        requested_by: uuid.UUID,
    ) -> DeletionRequest:
        """Create a new deletion request."""
        if data.entity_type not in _VALID_ENTITY_TYPES:
            msg = f"Invalid entity_type: {data.entity_type}"
            raise ValueError(msg)

        deletion_request = DeletionRequest(
            entity_type=data.entity_type,
            entity_id=data.entity_id,
            reason=data.reason,
            retention_days=data.retention_days,
            requested_by=requested_by,
            status="pending",
        )
        db.add(deletion_request)
        await db.commit()
        await db.refresh(deletion_request)
        return deletion_request

    # ------------------------------------------------------------------
    # Two-person authorization
    # ------------------------------------------------------------------

    async def approve_request(
        self,
        db: AsyncSession,
        *,
        deletion_request: DeletionRequest,
        approved_by: uuid.UUID,
    ) -> DeletionRequest:
        """Approve a deletion request.

        Two-person rule: the approver **must** be a different user than the
        requester.  On approval the ``scheduled_purge_at`` is computed as
        ``now + retention_days``.
        """
        if deletion_request.requested_by == approved_by:
            msg = "Approver must be a different user than the requester"
            raise ValueError(msg)

        if deletion_request.status != "pending":
            msg = f"Cannot approve request with status '{deletion_request.status}'"
            raise ValueError(msg)

        now = datetime.now(UTC)
        deletion_request.approved_by = approved_by
        deletion_request.status = "approved"
        deletion_request.scheduled_purge_at = now + timedelta(days=deletion_request.retention_days)

        await db.commit()
        await db.refresh(deletion_request)
        return deletion_request

    async def reject_request(
        self,
        db: AsyncSession,
        *,
        deletion_request: DeletionRequest,
        rejected_by: uuid.UUID,
        reason: str,
    ) -> DeletionRequest:
        """Reject a deletion request with a mandatory reason."""
        if deletion_request.status != "pending":
            msg = f"Cannot reject request with status '{deletion_request.status}'"
            raise ValueError(msg)

        deletion_request.status = "rejected"
        deletion_request.approved_by = rejected_by
        deletion_request.rejection_reason = reason

        await db.commit()
        await db.refresh(deletion_request)
        return deletion_request

    # ------------------------------------------------------------------
    # Execution (called by the daily scheduler after retention expires)
    # ------------------------------------------------------------------

    async def execute_deletion(
        self,
        db: AsyncSession,
        *,
        deletion_request: DeletionRequest,
    ) -> DeletionRequest:
        """Execute an approved deletion after its retention window has elapsed.

        Per entity_type:
        - ``client_profile``: anonymize PII fields (GDPR-style erasure).
        - ``document``: remove the file from MinIO and delete the DB record.
        - ``program``: set status to ``archived``.

        The request status transitions to ``executed``.
        """
        if deletion_request.status != "approved":
            msg = "Only approved requests can be executed"
            raise ValueError(msg)

        entity_type = deletion_request.entity_type
        entity_id = deletion_request.entity_id

        if entity_type == "client_profile":
            await self._execute_client_profile_deletion(db, entity_id)
        elif entity_type == "document":
            await self._execute_document_deletion(db, entity_id)
        elif entity_type == "program":
            await self._execute_program_deletion(db, entity_id)

        deletion_request.status = "executed"
        await db.flush()
        return deletion_request

    # ------------------------------------------------------------------
    # Per-entity execution helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _execute_client_profile_deletion(
        db: AsyncSession, entity_id: uuid.UUID
    ) -> None:
        """Anonymize a client profile — wipe PII while keeping the row for
        referential integrity and audit trail."""
        from app.models.client_profile import ClientProfile

        result = await db.execute(
            select(ClientProfile).where(ClientProfile.id == entity_id)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            return

        entity.legal_name = "[REDACTED]"
        entity.display_name = "[REDACTED]"
        entity.primary_email = f"redacted-{entity_id}@deleted.local"
        entity.secondary_email = None
        entity.phone = None
        entity.address = None
        entity.tax_id = None
        entity.sensitivities = None
        entity.special_instructions = None
        entity.intelligence_file = None
        entity.compliance_status = "flagged"
        entity.portal_access_enabled = False

    @staticmethod
    async def _execute_document_deletion(
        db: AsyncSession, entity_id: uuid.UUID
    ) -> None:
        """Remove the document file from MinIO storage and delete the DB record."""
        from app.models.document import Document

        result = await db.execute(select(Document).where(Document.id == entity_id))
        entity = result.scalar_one_or_none()
        if entity is None:
            return

        # Remove file from MinIO
        try:
            from app.services.storage import storage_service

            storage_service.delete_file(str(entity.file_path))
        except Exception:
            logger.exception(
                "Failed to remove document %s from MinIO (path=%s) — continuing with DB deletion",
                entity_id,
                entity.file_path,
            )

        await db.delete(entity)

    @staticmethod
    async def _execute_program_deletion(
        db: AsyncSession, entity_id: uuid.UUID
    ) -> None:
        """Archive a program (soft-delete)."""
        from app.models.program import Program

        result = await db.execute(select(Program).where(Program.id == entity_id))
        entity = result.scalar_one_or_none()
        if entity is None:
            return

        entity.status = "archived"

    # ------------------------------------------------------------------
    # Batch: find & execute all approved requests past their retention window
    # ------------------------------------------------------------------

    async def execute_approved_deletions(self, db: AsyncSession) -> list[DeletionRequest]:
        """Find all approved requests whose retention window has elapsed and execute them.

        Returns the list of executed ``DeletionRequest`` objects.
        """
        now = datetime.now(UTC)
        result = await db.execute(
            select(DeletionRequest).where(
                DeletionRequest.status == "approved",
                DeletionRequest.scheduled_purge_at <= now,
            )
        )
        due_requests = list(result.scalars().all())
        executed: list[DeletionRequest] = []

        for req in due_requests:
            try:
                await self.execute_deletion(db, deletion_request=req)
                executed.append(req)
            except Exception:
                logger.exception(
                    "Failed to execute deletion request %s (entity_type=%s, entity_id=%s)",
                    req.id,
                    req.entity_type,
                    req.entity_id,
                )

        return executed


deletion_service = DeletionService()
