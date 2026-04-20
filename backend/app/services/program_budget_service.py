"""Wires budget-threshold checks into program creation and updates.

This service is responsible for:
- Finding the matching ApprovalThreshold for a given budget amount.
- Auto-creating a BudgetApprovalRequest (with steps + history) when a threshold
  is exceeded.  Uses flush, not commit, so the caller owns the transaction.
- Sending in-portal notifications to the approval chain and to the RM on
  final approval.
"""

import logging
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.budget_approval import (
    ApprovalChain,
    ApprovalThreshold,
    BudgetApprovalHistory,
    BudgetApprovalRequest,
    BudgetApprovalStep,
)
from app.models.enums import (
    BudgetApprovalAction,
    BudgetApprovalStatus,
    BudgetApprovalStepStatus,
    BudgetRequestType,
    NotificationType,
)
from app.models.program import Program
from app.models.user import User
from app.schemas.notification import CreateNotificationRequest
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Threshold helpers
# ---------------------------------------------------------------------------


async def find_matching_threshold(
    db: AsyncSession,
    amount: Decimal,
) -> ApprovalThreshold | None:
    """Return the highest-priority active threshold that covers *amount*.

    Thresholds are matched on ``min_amount <= amount`` (and
    ``max_amount >= amount`` when max_amount is set).  When multiple
    thresholds match, the one with the lowest ``priority`` value and
    the highest ``min_amount`` is returned (most specific rule wins).
    """
    result = await db.execute(
        select(ApprovalThreshold)
        .where(ApprovalThreshold.is_active.is_(True))
        .where(ApprovalThreshold.min_amount <= amount)
        .where((ApprovalThreshold.max_amount.is_(None)) | (ApprovalThreshold.max_amount >= amount))
        .order_by(ApprovalThreshold.priority, ApprovalThreshold.min_amount.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def has_pending_budget_approval(
    db: AsyncSession,
    program_id: uuid.UUID,
) -> bool:
    """Return True when *program_id* has at least one pending/in-review approval."""
    result = await db.execute(
        select(BudgetApprovalRequest)
        .where(BudgetApprovalRequest.program_id == program_id)
        .where(
            BudgetApprovalRequest.status.in_(
                [BudgetApprovalStatus.pending.value, BudgetApprovalStatus.in_review.value]
            )
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


# ---------------------------------------------------------------------------
# Approval request creation (flush-only — caller commits)
# ---------------------------------------------------------------------------


async def create_budget_approval_for_program(
    db: AsyncSession,
    program: Program,
    budget_amount: Decimal,
    request_type: BudgetRequestType,
    requested_by: uuid.UUID,
    current_budget: Decimal | None = None,
) -> BudgetApprovalRequest | None:
    """Create a BudgetApprovalRequest for *program* if *budget_amount* exceeds a threshold.

    Uses ``db.flush()`` only — the caller is responsible for ``db.commit()``.
    Returns the new request, or ``None`` when no active threshold matches.
    """
    threshold = await find_matching_threshold(db, budget_amount)
    if not threshold:
        return None

    chain_result = await db.execute(
        select(ApprovalChain)
        .options(selectinload(ApprovalChain.steps))
        .where(ApprovalChain.id == threshold.approval_chain_id)
    )
    chain = chain_result.scalar_one_or_none()
    if not chain:
        logger.warning(
            "Threshold %s references a missing approval chain; skipping budget approval.",
            threshold.id,
        )
        return None

    curr = current_budget if current_budget is not None else Decimal("0")

    request = BudgetApprovalRequest(
        program_id=program.id,
        request_type=request_type.value,
        title=f"Budget approval: {program.title}",
        description=(
            f"Program '{program.title}' requires budget approval. "
            f"Requested amount: {budget_amount:,.2f}"
        ),
        requested_amount=budget_amount,
        budget_impact=budget_amount,
        current_budget=curr,
        projected_budget=curr + budget_amount,
        threshold_id=threshold.id,
        approval_chain_id=chain.id,
        current_step=1,
        status=BudgetApprovalStatus.pending.value,
        requested_by=requested_by,
    )
    db.add(request)
    await db.flush()

    for chain_step in sorted(chain.steps, key=lambda s: s.step_number):
        db.add(
            BudgetApprovalStep(
                request_id=request.id,
                chain_step_id=chain_step.id,
                step_number=chain_step.step_number,
                assigned_role=chain_step.required_role,
                assigned_user_id=chain_step.specific_user_id,
                status=BudgetApprovalStepStatus.pending.value,
            )
        )

    actor_res = await db.execute(select(User).where(User.id == requested_by))
    actor = actor_res.scalar_one_or_none()
    db.add(
        BudgetApprovalHistory(
            request_id=request.id,
            action=BudgetApprovalAction.created.value,
            actor_id=requested_by,
            actor_name=actor.full_name if actor else "Unknown",
            actor_role=actor.role if actor else "unknown",
            to_status=BudgetApprovalStatus.pending.value,
        )
    )
    await db.flush()

    logger.info(
        "Budget approval request %s created for program %s (threshold: %s, amount: %s)",
        request.id,
        program.id,
        threshold.name,
        budget_amount,
    )
    return request


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


async def notify_approval_chain(
    db: AsyncSession,
    request: BudgetApprovalRequest,
    program: Program,
) -> None:
    """Send in-portal ``approval_required`` notifications to every user in the chain.

    Each call to ``notification_service.create_notification`` commits its own
    row, so this function should be called *after* the main transaction is
    committed.
    """
    chain_result = await db.execute(
        select(ApprovalChain)
        .options(selectinload(ApprovalChain.steps))
        .where(ApprovalChain.id == request.approval_chain_id)
    )
    chain = chain_result.scalar_one_or_none()
    if not chain:
        return

    notified: set[uuid.UUID] = set()

    for step in chain.steps:
        if step.specific_user_id:
            notified.add(uuid.UUID(str(step.specific_user_id)))
        else:
            role_result = await db.execute(select(User).where(User.role == step.required_role))
            for user in role_result.scalars().all():
                notified.add(uuid.UUID(str(user.id)))

    for user_id in notified:
        notif = CreateNotificationRequest(
            user_id=user_id,
            notification_type=NotificationType.approval_required.value,
            title="Budget Approval Required",
            body=(
                f"Program '{program.title}' requires budget approval. "
                f"Requested amount: {request.requested_amount:,.2f}."
            ),
            entity_type="budget_approval_request",
            entity_id=request.id,
            priority="normal",
        )
        try:
            await notification_service.create_notification(db, notif)
        except Exception:
            logger.exception(
                "Failed to send budget-approval notification to user %s for program %s",
                user_id,
                program.id,
            )


async def notify_rm_budget_approved(
    db: AsyncSession,
    request: BudgetApprovalRequest,
    program: Program,
) -> None:
    """Notify the program's RM (creator) that the budget has been approved."""
    creator_id = uuid.UUID(str(program.created_by))
    notif = CreateNotificationRequest(
        user_id=creator_id,
        notification_type=NotificationType.approval_required.value,
        title="Program Budget Approved",
        body=(
            f"Budget for program '{program.title}' has been approved. "
            "The program is now ready for activation."
        ),
        entity_type="budget_approval_request",
        entity_id=request.id,
        priority="normal",
    )
    try:
        await notification_service.create_notification(db, notif)
    except Exception:
        logger.exception(
            "Failed to notify RM %s of budget approval for program %s",
            creator_id,
            program.id,
        )
