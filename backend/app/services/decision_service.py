"""Service for decision request operations."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.decision_request import DecisionRequest
from app.models.enums import INTERNAL_ROLES, UserRole
from app.models.partner_assignment import PartnerAssignment
from app.models.user import User
from app.schemas.decision_request import (
    DecisionRequestCreate,
    DecisionRequestUpdate,
    DecisionSubmitResponse,
)
from app.services.crud_base import CRUDBase


class DecisionService(CRUDBase[DecisionRequest, DecisionRequestCreate, DecisionRequestUpdate]):
    """Service for decision request operations."""

    async def get_decision_requests_for_user(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        user_role: str,
        client_id: uuid.UUID | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[DecisionRequest], int]:
        """Get decision requests based on user role."""
        query = select(DecisionRequest)
        count_query = select(func.count()).select_from(DecisionRequest)

        if user_role == UserRole.client:
            # Clients see only their own decisions
            query = query.where(DecisionRequest.client_id == user_id)
            count_query = count_query.where(DecisionRequest.client_id == user_id)
        elif user_role == UserRole.partner:
            # Partners see decisions for their assigned clients
            # Get partner's user profile first to link to assignments
            query = query.join(
                PartnerAssignment,
                DecisionRequest.client_id == PartnerAssignment.client_id,
            ).where(PartnerAssignment.partner_user_id == user_id)
            count_query = count_query.join(
                PartnerAssignment,
                DecisionRequest.client_id == PartnerAssignment.client_id,
            ).where(PartnerAssignment.partner_user_id == user_id)
        # Internal users (RM, coordinator) can see all for their clients
        # For simplicity, internal users see all decisions

        if client_id:
            query = query.where(DecisionRequest.client_id == client_id)
            count_query = count_query.where(DecisionRequest.client_id == client_id)

        if status:
            query = query.where(DecisionRequest.status == status)
            count_query = count_query.where(DecisionRequest.status == status)

        query = query.order_by(DecisionRequest.created_at.desc())

        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.offset(skip).limit(limit))
        decisions = list(result.scalars().all())

        return decisions, total

    async def check_access(
        self,
        db: AsyncSession,
        decision: DecisionRequest,
        current_user: User,
    ) -> bool:
        """Check if user has access to a decision request."""
        # Client can see their own decisions
        if current_user.role == UserRole.client:
            return decision.client_id == current_user.id

        # Internal users can see all decisions
        if current_user.role in INTERNAL_ROLES:
            return True

        # Partners can see decisions for their assigned clients
        if current_user.role == UserRole.partner:
            result = await db.execute(
                select(PartnerAssignment).where(
                    PartnerAssignment.client_id == decision.client_id,
                    PartnerAssignment.partner_user_id == current_user.id,
                ),
            )
            return result.scalar_one_or_none() is not None

        return False

    async def submit_response(
        self,
        db: AsyncSession,
        decision: DecisionRequest,
        response: DecisionSubmitResponse,
        user_id: uuid.UUID,
    ) -> DecisionRequest:
        """Submit a response to a decision request."""
        response_data = {
            "option_id": response.option_id,
            "text": response.text,
            "responded_at": datetime.now(UTC).isoformat(),
        }

        decision.response = response_data  # type: ignore
        decision.status = "responded"
        decision.responded_at = datetime.now(UTC)
        decision.responded_by = user_id

        await db.commit()
        await db.refresh(decision)

        # Send notification to the creator
        # await notification_service.create_notification(...)

        return decision


decision_service = DecisionService(DecisionRequest)
