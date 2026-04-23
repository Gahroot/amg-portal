"""Approval workflow mixin for CommunicationService."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.communication import Communication
from app.models.enums import CommunicationApprovalStatus, NotificationType, UserRole
from app.models.user import User
from app.services.communication_helpers import _attach_plaintext_body

logger = logging.getLogger(__name__)


class CommunicationApprovalMixin:
    """Mixin providing submit/review approval workflow for CommunicationService."""

    async def submit_for_review(
        self,
        db: AsyncSession,
        communication_id: uuid.UUID,
        user: Any,
    ) -> Communication:
        """Submit a draft communication for review."""
        communication: Communication | None = await self.get(db, communication_id)  # type: ignore[attr-defined]
        if not communication:
            raise ValueError("Communication not found")
        if communication.sender_id != user.id:
            raise ValueError("Only the sender can submit a communication for review")
        if communication.approval_status != "draft":
            raise ValueError("Only draft communications can be submitted for review")

        communication.approval_status = CommunicationApprovalStatus.pending_review
        await db.commit()
        await db.refresh(communication)

        # Audit trail
        try:
            from app.services.communication_audit_service import log_communication_event

            await log_communication_event(
                db,
                communication_id=communication_id,
                conversation_id=communication.conversation_id,
                action="submitted_for_review",
                actor_id=user.id,
                details={"previous_status": "draft"},
            )
        except Exception:
            logger.exception("Failed to log audit event for communication %s", communication_id)

        # Notify internal staff about pending review
        try:
            from app.schemas.notification import CreateNotificationRequest
            from app.services.notification_service import notification_service

            # Notify all RMs and MDs
            result = await db.execute(
                select(User).where(
                    User.role.in_([UserRole.relationship_manager, UserRole.managing_director]),
                    User.status == "active",
                    User.id != user.id,
                )
            )
            reviewers = result.scalars().all()
            for reviewer in reviewers:
                notif = CreateNotificationRequest(
                    user_id=reviewer.id,
                    notification_type=NotificationType.approval_required,
                    title="Communication pending review",
                    body=(
                        f"A communication"
                        f" '{communication.subject or '(no subject)'}'"
                        " requires your review."
                    ),
                    entity_type="communication",
                    entity_id=communication.id,
                    priority="normal",
                )
                await notification_service.create_notification(db, notif)
        except Exception:
            logger.exception(
                "Failed to send review notifications for communication %s",
                communication_id,
            )

        _attach_plaintext_body(db, communication)
        return communication

    async def review_communication(
        self,
        db: AsyncSession,
        communication_id: uuid.UUID,
        reviewer: Any,
        action: str,
        notes: str | None = None,
    ) -> Communication:
        """Approve or reject a communication."""
        communication: Communication | None = await self.get(db, communication_id)  # type: ignore[attr-defined]
        if not communication:
            raise ValueError("Communication not found")
        if communication.approval_status != "pending_review":
            raise ValueError("Only communications pending review can be reviewed")
        if action not in ("approve", "reject"):
            raise ValueError("Action must be 'approve' or 'reject'")

        communication.approval_status = (
            CommunicationApprovalStatus.approved
            if action == "approve"
            else CommunicationApprovalStatus.rejected
        )
        communication.reviewer_id = reviewer.id
        communication.reviewed_at = datetime.now(UTC)
        communication.reviewer_notes = notes

        await db.commit()
        await db.refresh(communication)

        # Audit trail
        try:
            from app.services.communication_audit_service import log_communication_event

            await log_communication_event(
                db,
                communication_id=communication_id,
                conversation_id=communication.conversation_id,
                action=f"review_{action}d",
                actor_id=reviewer.id,
                details={"notes": notes, "outcome": communication.approval_status},
            )
        except Exception:
            logger.exception("Failed to log audit event for communication %s", communication_id)

        # Notify the sender about the review outcome
        try:
            from app.schemas.notification import CreateNotificationRequest
            from app.services.notification_service import notification_service

            status_text = "approved" if action == "approve" else "rejected"
            if communication.sender_id is None:
                raise ValueError("Communication has no sender")
            notif = CreateNotificationRequest(
                user_id=communication.sender_id,
                notification_type=NotificationType.communication,
                title=f"Communication {status_text}",
                body=(
                    f"Your communication"
                    f" '{communication.subject or '(no subject)'}'"
                    f" has been {status_text}." + (f" Notes: {notes}" if notes else "")
                ),
                entity_type="communication",
                entity_id=communication.id,
                priority="normal",
            )
            await notification_service.create_notification(db, notif)
        except Exception:
            logger.exception(
                "Failed to send review outcome notification for communication %s",
                communication_id,
            )

        _attach_plaintext_body(db, communication)
        return communication

    async def get_pending_reviews(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Communication], int]:
        """Get communications pending review."""
        query = select(Communication).where(Communication.approval_status == "pending_review")
        count_query = (
            select(func.count())
            .select_from(Communication)
            .where(Communication.approval_status == "pending_review")
        )
        query = query.order_by(Communication.created_at.desc())
        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.offset(skip).limit(limit))
        messages = list(result.scalars().all())
        for msg in messages:
            _attach_plaintext_body(db, msg)
        return messages, total

    async def get_communications_by_approval_status(
        self,
        db: AsyncSession,
        approval_status: str,
        user_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Communication], int]:
        """Get communications filtered by approval status, optionally by sender."""
        query = select(Communication).where(Communication.approval_status == approval_status)
        count_query = (
            select(func.count())
            .select_from(Communication)
            .where(Communication.approval_status == approval_status)
        )
        if user_id:
            query = query.where(Communication.sender_id == user_id)
            count_query = count_query.where(Communication.sender_id == user_id)
        query = query.order_by(Communication.created_at.desc())
        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.offset(skip).limit(limit))
        messages = list(result.scalars().all())
        for msg in messages:
            _attach_plaintext_body(db, msg)
        return messages, total
