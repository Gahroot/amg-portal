"""Two-person deletion authorization service.

No entity is permanently erased without a second authorized user
approving the request. Approved deletions are soft-deletes (status set
to 'deleted') with a full audit trail.
"""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.models.deletion_request import DeletionRequest
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.deletion_request import DeletionRequestCreate

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Entity registry
# Maps entity_type (table name) → importable model class path.
# Extend this when new entity types should support deletion requests.
# --------------------------------------------------------------------------- #

_ENTITY_REGISTRY: dict[str, str] = {
    "clients": "app.models.client.Client",
    "client_profiles": "app.models.client_profile.ClientProfile",
    "programs": "app.models.program.Program",
    "partners": "app.models.partner.PartnerProfile",
    "deliverables": "app.models.deliverable.Deliverable",
    "documents": "app.models.document.Document",
    "users": "app.models.user.User",
    "tasks": "app.models.task.Task",
    "escalations": "app.models.escalation.Escalation",
    "communications": "app.models.communication.Communication",
}

SUPPORTED_ENTITY_TYPES: list[str] = sorted(_ENTITY_REGISTRY.keys())


def _load_model_class(entity_type: str) -> type[Any]:
    """Dynamically import and return the ORM class for *entity_type*."""
    module_path = _ENTITY_REGISTRY.get(entity_type)
    if not module_path:
        raise BadRequestException(
            f"Entity type '{entity_type}' is not supported. "
            f"Supported types: {SUPPORTED_ENTITY_TYPES}"
        )
    module_name, class_name = module_path.rsplit(".", 1)
    import importlib

    module = importlib.import_module(module_name)
    return getattr(module, class_name)  # type: ignore[no-any-return]


# --------------------------------------------------------------------------- #
# Service
# --------------------------------------------------------------------------- #


class DeletionService:
    """Manages the two-person deletion authorization workflow."""

    async def request_deletion(
        self,
        db: AsyncSession,
        *,
        data: DeletionRequestCreate,
        requester: User,
    ) -> DeletionRequest:
        """Create a pending deletion request.

        Validates that the entity exists and that there is no other
        pending request for the same entity before inserting.
        """
        # Validate entity type
        model_class = _load_model_class(data.entity_type)

        # Verify the entity actually exists
        result = await db.execute(
            select(model_class).where(model_class.id == data.entity_id)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            raise NotFoundException(
                f"{data.entity_type} with id '{data.entity_id}' not found"
            )

        # Guard against duplicate pending requests for the same entity
        existing = await db.execute(
            select(DeletionRequest).where(
                DeletionRequest.entity_type == data.entity_type,
                DeletionRequest.entity_id == data.entity_id,
                DeletionRequest.status == "pending",
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise ConflictException("A pending deletion request already exists for this entity")

        deletion_req = DeletionRequest(
            entity_type=data.entity_type,
            entity_id=data.entity_id,
            requested_by=requester.id,
            reason=data.reason,
            status="pending",
        )
        db.add(deletion_req)
        await db.commit()
        await db.refresh(deletion_req)

        logger.info(
            "Deletion requested: %s/%s by user %s (request_id=%s)",
            data.entity_type,
            data.entity_id,
            requester.id,
            deletion_req.id,
        )
        return deletion_req

    async def approve_deletion(
        self,
        db: AsyncSession,
        *,
        request_id: uuid.UUID,
        approver: User,
    ) -> DeletionRequest:
        """Approve and execute a pending deletion request.

        Enforces the two-person rule: the approver must be a different
        user from the requester. Executes a soft-delete on the target entity.
        """
        deletion_req = await self._get_pending_or_404(db, request_id)

        # Two-person rule
        if deletion_req.requested_by == approver.id:
            raise ForbiddenException("The approver must be a different user from the requester")

        # Approver must be a managing director
        if approver.role != UserRole.managing_director:
            raise ForbiddenException("Only a Managing Director may approve deletion requests")

        # Soft-delete the target entity
        model_class = _load_model_class(deletion_req.entity_type)
        result = await db.execute(
            select(model_class).where(
                model_class.id == deletion_req.entity_id
            )
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            raise NotFoundException(
                f"Target entity {deletion_req.entity_type}/{deletion_req.entity_id}"
                " no longer exists"
            )

        now = datetime.now(UTC)

        # Soft-delete: set status to "deleted" when the field exists,
        # otherwise set deleted_at (future-proof fallback).
        if hasattr(entity, "status"):
            entity.status = "deleted"
        elif hasattr(entity, "deleted_at"):
            entity.deleted_at = now
        else:
            logger.warning(
                "Entity %s/%s has neither 'status' nor 'deleted_at'; "
                "soft-delete not applied but audit record created",
                deletion_req.entity_type,
                deletion_req.entity_id,
            )

        # Stamp the request
        deletion_req.approved_by = approver.id
        deletion_req.approved_at = now
        deletion_req.status = "approved"
        deletion_req.executed_at = now

        await db.commit()
        await db.refresh(deletion_req)

        logger.info(
            "Deletion approved & executed: %s/%s by approver %s (request_id=%s)",
            deletion_req.entity_type,
            deletion_req.entity_id,
            approver.id,
            deletion_req.id,
        )
        return deletion_req

    async def reject_deletion(
        self,
        db: AsyncSession,
        *,
        request_id: uuid.UUID,
        approver: User,
        reason: str,
    ) -> DeletionRequest:
        """Reject a pending deletion request."""
        deletion_req = await self._get_pending_or_404(db, request_id)

        deletion_req.approved_by = approver.id
        deletion_req.approved_at = datetime.now(UTC)
        deletion_req.rejection_reason = reason
        deletion_req.status = "rejected"

        await db.commit()
        await db.refresh(deletion_req)

        logger.info(
            "Deletion rejected: %s/%s by %s (request_id=%s)",
            deletion_req.entity_type,
            deletion_req.entity_id,
            approver.id,
            deletion_req.id,
        )
        return deletion_req

    async def list_requests(
        self,
        db: AsyncSession,
        *,
        status_filter: str | None = None,
        entity_type: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[DeletionRequest], int]:
        """Return deletion requests with optional filters."""
        from sqlalchemy import func

        query = select(DeletionRequest)
        count_query = select(func.count()).select_from(DeletionRequest)

        if status_filter:
            query = query.where(DeletionRequest.status == status_filter)
            count_query = count_query.where(DeletionRequest.status == status_filter)
        if entity_type:
            query = query.where(DeletionRequest.entity_type == entity_type)
            count_query = count_query.where(DeletionRequest.entity_type == entity_type)

        query = query.order_by(DeletionRequest.requested_at.desc())

        total = (await db.execute(count_query)).scalar_one()
        rows = (await db.execute(query.offset(skip).limit(limit))).scalars().all()
        return list(rows), total

    async def get(self, db: AsyncSession, request_id: uuid.UUID) -> DeletionRequest | None:
        """Fetch a single deletion request by ID."""
        result = await db.execute(
            select(DeletionRequest).where(DeletionRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    # ---------------------------------------------------------------------- #
    # Helpers
    # ---------------------------------------------------------------------- #

    async def _get_pending_or_404(
        self, db: AsyncSession, request_id: uuid.UUID
    ) -> DeletionRequest:
        deletion_req = await self.get(db, request_id)
        if deletion_req is None:
            raise NotFoundException("Deletion request not found")
        if deletion_req.status != "pending":
            raise ConflictException(f"Deletion request is already '{deletion_req.status}'")
        return deletion_req


deletion_service = DeletionService()
