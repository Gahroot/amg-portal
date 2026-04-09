"""Budget-based approval routing service."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.budget_approval import (
    ApprovalChain,
    ApprovalChainStep,
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
    UserRole,
)
from app.models.program import Program
from app.models.user import User


class BudgetApprovalService:
    """Service for budget-based approval routing."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # === Threshold Management ===

    async def create_threshold(
        self,
        name: str,
        min_amount: Decimal,
        approval_chain_id: uuid.UUID,
        description: str | None = None,
        max_amount: Decimal | None = None,
        is_active: bool = True,
        priority: int = 0,
    ) -> ApprovalThreshold:
        """Create a new approval threshold."""
        threshold = ApprovalThreshold(
            name=name,
            description=description,
            min_amount=min_amount,
            max_amount=max_amount,
            approval_chain_id=approval_chain_id,
            is_active=is_active,
            priority=priority,
        )
        self.db.add(threshold)
        await self.db.commit()
        await self.db.refresh(threshold, ["approval_chain"])
        return threshold

    async def get_threshold(self, threshold_id: uuid.UUID) -> ApprovalThreshold | None:
        """Get an approval threshold by ID."""
        result = await self.db.execute(
            select(ApprovalThreshold)
            .options(selectinload(ApprovalThreshold.approval_chain))
            .where(ApprovalThreshold.id == threshold_id)
        )
        return result.scalar_one_or_none()

    async def list_thresholds(
        self, is_active: bool | None = None
    ) -> list[ApprovalThreshold]:
        """List all approval thresholds."""
        query = select(ApprovalThreshold).options(
            selectinload(ApprovalThreshold.approval_chain)
        )
        if is_active is not None:
            query = query.where(ApprovalThreshold.is_active == is_active)
        query = query.order_by(ApprovalThreshold.priority, ApprovalThreshold.min_amount)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_threshold(
        self, threshold_id: uuid.UUID, **kwargs: Any
    ) -> ApprovalThreshold | None:
        """Update an approval threshold."""
        threshold = await self.get_threshold(threshold_id)
        if not threshold:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(threshold, key):
                setattr(threshold, key, value)
        await self.db.commit()
        await self.db.refresh(threshold)
        return threshold

    async def delete_threshold(self, threshold_id: uuid.UUID) -> bool:
        """Delete an approval threshold."""
        threshold = await self.get_threshold(threshold_id)
        if not threshold:
            return False
        await self.db.delete(threshold)
        await self.db.commit()
        return True

    # === Approval Chain Management ===

    async def create_chain(
        self,
        name: str,
        created_by: uuid.UUID,
        description: str | None = None,
        is_active: bool = True,
        steps: list[dict[str, Any]] | None = None,
    ) -> ApprovalChain:
        """Create a new approval chain with steps."""
        chain = ApprovalChain(
            name=name,
            description=description,
            is_active=is_active,
            created_by=created_by,
        )
        self.db.add(chain)
        await self.db.flush()

        if steps:
            for step_data in steps:
                step = ApprovalChainStep(
                    approval_chain_id=chain.id,
                    step_number=step_data["step_number"],
                    required_role=step_data["required_role"],
                    specific_user_id=step_data.get("specific_user_id"),
                    is_parallel=step_data.get("is_parallel", False),
                    timeout_hours=step_data.get("timeout_hours"),
                    auto_approve_on_timeout=step_data.get("auto_approve_on_timeout", False),
                )
                self.db.add(step)

        await self.db.commit()
        await self.db.refresh(chain)
        return chain

    async def get_chain(self, chain_id: uuid.UUID) -> ApprovalChain | None:
        """Get an approval chain by ID with steps."""
        result = await self.db.execute(
            select(ApprovalChain)
            .options(selectinload(ApprovalChain.steps).selectinload(ApprovalChainStep.specific_user))
            .options(selectinload(ApprovalChain.creator))
            .where(ApprovalChain.id == chain_id)
        )
        return result.scalar_one_or_none()

    async def list_chains(self, is_active: bool | None = None) -> list[ApprovalChain]:
        """List all approval chains."""
        query = select(ApprovalChain).options(
            selectinload(ApprovalChain.steps),
            selectinload(ApprovalChain.creator),
        )
        if is_active is not None:
            query = query.where(ApprovalChain.is_active == is_active)
        query = query.order_by(ApprovalChain.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_chain(self, chain_id: uuid.UUID, **kwargs: Any) -> ApprovalChain | None:
        """Update an approval chain."""
        chain = await self.get_chain(chain_id)
        if not chain:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(chain, key):
                setattr(chain, key, value)
        await self.db.commit()
        await self.db.refresh(chain)
        return chain

    async def delete_chain(self, chain_id: uuid.UUID) -> bool:
        """Delete an approval chain."""
        chain = await self.get_chain(chain_id)
        if not chain:
            return False
        await self.db.delete(chain)
        await self.db.commit()
        return True

    async def add_chain_step(
        self,
        chain_id: uuid.UUID,
        step_number: int,
        required_role: UserRole,
        specific_user_id: uuid.UUID | None = None,
        is_parallel: bool = False,
        timeout_hours: int | None = None,
        auto_approve_on_timeout: bool = False,
    ) -> ApprovalChainStep | None:
        """Add a step to an approval chain."""
        chain = await self.get_chain(chain_id)
        if not chain:
            return None
        step = ApprovalChainStep(
            approval_chain_id=chain_id,
            step_number=step_number,
            required_role=required_role.value,
            specific_user_id=specific_user_id,
            is_parallel=is_parallel,
            timeout_hours=timeout_hours,
            auto_approve_on_timeout=auto_approve_on_timeout,
        )
        self.db.add(step)
        await self.db.commit()
        await self.db.refresh(step)
        return step

    async def remove_chain_step(self, step_id: uuid.UUID) -> bool:
        """Remove a step from an approval chain."""
        result = await self.db.execute(
            select(ApprovalChainStep).where(ApprovalChainStep.id == step_id)
        )
        step = result.scalar_one_or_none()
        if not step:
            return False
        await self.db.delete(step)
        await self.db.commit()
        return True

    # === Budget Impact Calculation ===

    async def calculate_budget_impact(
        self, program_id: uuid.UUID, requested_amount: Decimal
    ) -> dict[str, Any]:
        """Calculate budget impact and determine required approval chain."""
        result = await self.db.execute(
            select(Program).where(Program.id == program_id)
        )
        program = result.scalar_one_or_none()
        if not program:
            raise ValueError("Program not found")

        current_budget = Decimal(str(program.budget_envelope or 0))
        budget_impact = requested_amount
        projected_budget = current_budget + budget_impact

        utilization = (
            float(projected_budget / current_budget * 100) if current_budget > 0 else 100.0
        )

        # Find matching threshold
        threshold = await self._find_matching_threshold(requested_amount)

        threshold_data = None
        chain_data = None
        requires_approval = False

        if threshold:
            requires_approval = True
            chain = await self.get_chain(threshold.approval_chain_id)
            threshold_data = threshold
            if chain:
                chain_data = chain

        return {
            "program_id": program_id,
            "program_title": program.title,
            "current_budget": current_budget,
            "requested_amount": requested_amount,
            "budget_impact": budget_impact,
            "projected_budget": projected_budget,
            "utilization_percentage": utilization,
            "threshold_matched": threshold_data,
            "approval_chain": chain_data,
            "requires_approval": requires_approval,
        }

    async def _find_matching_threshold(
        self, amount: Decimal
    ) -> ApprovalThreshold | None:
        """Find the threshold matching the given amount."""
        result = await self.db.execute(
            select(ApprovalThreshold)
            .where(ApprovalThreshold.is_active.is_(True))
            .where(ApprovalThreshold.min_amount <= amount)
            .where(
                (ApprovalThreshold.max_amount.is_(None))
                | (ApprovalThreshold.max_amount >= amount)
            )
            .order_by(ApprovalThreshold.priority, ApprovalThreshold.min_amount.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    # === Budget Approval Request Management ===

    async def create_request(
        self,
        program_id: uuid.UUID,
        request_type: BudgetRequestType,
        title: str,
        requested_amount: Decimal,
        requested_by: uuid.UUID,
        description: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> BudgetApprovalRequest:
        """Create a new budget approval request."""
        # Calculate budget impact
        impact = await self.calculate_budget_impact(program_id, requested_amount)

        if not impact["threshold_matched"] or not impact["approval_chain"]:
            raise ValueError("No matching approval threshold found for this amount")

        threshold = impact["threshold_matched"]
        chain = impact["approval_chain"]

        # Create the request
        request = BudgetApprovalRequest(
            program_id=program_id,
            request_type=request_type.value,
            title=title,
            description=description,
            requested_amount=requested_amount,
            budget_impact=impact["budget_impact"],
            current_budget=impact["current_budget"],
            projected_budget=impact["projected_budget"],
            threshold_id=threshold.id,
            approval_chain_id=chain.id,
            current_step=1,
            status=BudgetApprovalStatus.pending.value,
            request_metadata=metadata,
            requested_by=requested_by,
        )
        self.db.add(request)
        await self.db.flush()

        # Create approval steps for each chain step
        chain_with_steps = await self.get_chain(chain.id)
        if chain_with_steps:
            for chain_step in sorted(chain_with_steps.steps, key=lambda s: s.step_number):
                approval_step = BudgetApprovalStep(
                    request_id=request.id,
                    chain_step_id=chain_step.id,
                    step_number=chain_step.step_number,
                    assigned_role=chain_step.required_role,
                    assigned_user_id=chain_step.specific_user_id,
                    status=BudgetApprovalStepStatus.pending.value,
                )
                self.db.add(approval_step)

        # Record history
        await self._record_history(
            request_id=request.id,
            action=BudgetApprovalAction.created,
            actor_id=requested_by,
            to_status=BudgetApprovalStatus.pending.value,
        )

        await self.db.commit()
        await self.db.refresh(request)
        return request

    async def get_request(self, request_id: uuid.UUID) -> BudgetApprovalRequest | None:
        """Get a budget approval request by ID with all related data."""
        result = await self.db.execute(
            select(BudgetApprovalRequest)
            .options(
                selectinload(BudgetApprovalRequest.program),
                selectinload(BudgetApprovalRequest.threshold),
                selectinload(BudgetApprovalRequest.approval_chain),
                selectinload(BudgetApprovalRequest.requester),
                selectinload(BudgetApprovalRequest.final_approver),
                selectinload(BudgetApprovalRequest.steps)
                .selectinload(BudgetApprovalStep.assigned_user),
                selectinload(BudgetApprovalRequest.steps)
                .selectinload(BudgetApprovalStep.decider),
                selectinload(BudgetApprovalRequest.steps)
                .selectinload(BudgetApprovalStep.chain_step),
                selectinload(BudgetApprovalRequest.history),
            )
            .where(BudgetApprovalRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    async def list_requests(
        self,
        status: BudgetApprovalStatus | None = None,
        program_id: uuid.UUID | None = None,
        request_type: BudgetRequestType | None = None,
        requested_by: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[BudgetApprovalRequest], int]:
        """List budget approval requests with filters."""
        query = (
            select(BudgetApprovalRequest)
            .options(
                selectinload(BudgetApprovalRequest.program),
                selectinload(BudgetApprovalRequest.requester),
                selectinload(BudgetApprovalRequest.steps),
            )
            .order_by(BudgetApprovalRequest.created_at.desc())
        )

        if status:
            query = query.where(BudgetApprovalRequest.status == status.value)
        if program_id:
            query = query.where(BudgetApprovalRequest.program_id == program_id)
        if request_type:
            query = query.where(BudgetApprovalRequest.request_type == request_type.value)
        if requested_by:
            query = query.where(BudgetApprovalRequest.requested_by == requested_by)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0

        # Get paginated results
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total

    async def get_pending_approvals_for_user(
        self, user: User
    ) -> list[tuple[BudgetApprovalStep, BudgetApprovalRequest]]:
        """Get pending approval steps for a user based on role or direct assignment."""
        # Query steps where user is either directly assigned or has the required role
        query = (
            select(BudgetApprovalStep, BudgetApprovalRequest)
            .join(BudgetApprovalRequest, BudgetApprovalStep.request_id == BudgetApprovalRequest.id)
            .where(BudgetApprovalStep.status == BudgetApprovalStepStatus.pending.value)
            .where(BudgetApprovalRequest.status == BudgetApprovalStatus.pending.value)
            .where(
                (BudgetApprovalStep.assigned_user_id == user.id)
                | (BudgetApprovalStep.assigned_role == user.role)
            )
            .options(
                selectinload(BudgetApprovalRequest.program),
                selectinload(BudgetApprovalRequest.requester),
            )
            .order_by(BudgetApprovalStep.created_at)
        )

        result = await self.db.execute(query)
        return [(step, req) for step, req in result.all()]

    async def decide_step(
        self,
        step_id: uuid.UUID,
        decision: str,
        user: User,
        comments: str | None = None,
    ) -> BudgetApprovalStep | None:
        """Make a decision on an approval step."""
        result = await self.db.execute(
            select(BudgetApprovalStep)
            .options(
                selectinload(BudgetApprovalStep.request),
                selectinload(BudgetApprovalStep.chain_step),
            )
            .where(BudgetApprovalStep.id == step_id)
        )
        step = result.scalar_one_or_none()

        if not step:
            return None

        if step.status != BudgetApprovalStepStatus.pending.value:
            raise ValueError("Step already decided")

        # Verify user can approve this step
        if step.assigned_user_id and step.assigned_user_id != user.id:
            raise ValueError("Not authorized to approve this step")
        if step.assigned_role != user.role and not step.assigned_user_id:
            raise ValueError("Not authorized to approve this step")

        # Record the decision
        step.status = (
            BudgetApprovalStepStatus.approved
            if decision == "approved"
            else BudgetApprovalStepStatus.rejected
        )
        step.decision = decision
        step.decided_by = user.id
        step.decided_at = datetime.now(UTC)
        step.comments = comments

        # Record history
        action = (
            BudgetApprovalAction.step_approved
            if decision == "approved"
            else BudgetApprovalAction.step_rejected
        )
        await self._record_history(
            request_id=step.request_id,
            action=action,
            step_number=step.step_number,
            actor_id=user.id,
            to_status=step.status,
            comments=comments,
        )

        # Handle rejection - reject the entire request
        if decision == "rejected":
            step.request.status = BudgetApprovalStatus.rejected.value
            step.request.final_decision_at = datetime.now(UTC)
            step.request.final_comments = comments
            step.request.approved_by = user.id
            await self._record_history(
                request_id=step.request_id,
                action=BudgetApprovalAction.final_rejected,
                actor_id=user.id,
                to_status=BudgetApprovalStatus.rejected.value,
                comments=comments,
            )

        # Handle approval - check if more steps needed
        elif decision == "approved":
            await self._advance_request(step.request, user)

        await self.db.commit()
        await self.db.refresh(step)
        return step

    async def _advance_request(
        self, request: BudgetApprovalRequest, approver: User
    ) -> None:
        """Advance the request to the next step or complete it."""
        # Get all steps for this request
        result = await self.db.execute(
            select(BudgetApprovalStep)
            .where(BudgetApprovalStep.request_id == request.id)
            .order_by(BudgetApprovalStep.step_number)
        )
        steps = list(result.scalars().all())

        total_steps = len(steps)
        current_step_num = request.current_step

        # Check if current step is complete (for parallel steps, all must approve)
        current_steps = [s for s in steps if s.step_number == current_step_num]
        chain_steps = await self._get_chain_steps(request.approval_chain_id)

        is_parallel = any(
            cs.is_parallel
            for cs in chain_steps
            if cs.step_number == current_step_num
        )

        if is_parallel:
            all_current_approved = all(
                s.status == BudgetApprovalStepStatus.approved.value for s in current_steps
            )
            if not all_current_approved:
                return  # Wait for all parallel approvals

        # Check if this was the last step
        if current_step_num >= total_steps:
            # Final approval
            request.status = BudgetApprovalStatus.approved
            request.final_decision_at = datetime.now(UTC)
            request.approved_by = approver.id
            await self._record_history(
                request_id=request.id,
                action=BudgetApprovalAction.final_approved,
                actor_id=approver.id,
                to_status=BudgetApprovalStatus.approved.value,
            )
            # Notify the RM that the budget is approved and the program can now
            # be activated.  Failures are swallowed so the approval still commits.
            try:
                from app.models.program import Program as ProgramModel
                from app.services.program_budget_service import notify_rm_budget_approved

                prog_result = await self.db.execute(
                    select(ProgramModel).where(ProgramModel.id == request.program_id)
                )
                program = prog_result.scalar_one_or_none()
                if program:
                    await notify_rm_budget_approved(self.db, request, program)
            except Exception:
                import logging as _logging

                _logging.getLogger(__name__).exception(
                    "Failed to notify RM of budget approval for request %s",
                    request.id,
                )
        else:
            # Move to next step
            request.current_step = current_step_num + 1
            await self._record_history(
                request_id=request.id,
                action=BudgetApprovalAction.step_approved,
                step_number=current_step_num,
                actor_id=approver.id,
                to_status=f"advanced_to_step_{request.current_step}",
            )

    async def _get_chain_steps(self, chain_id: uuid.UUID) -> list[ApprovalChainStep]:
        """Get all steps for an approval chain."""
        result = await self.db.execute(
            select(ApprovalChainStep)
            .where(ApprovalChainStep.approval_chain_id == chain_id)
            .order_by(ApprovalChainStep.step_number)
        )
        return list(result.scalars().all())

    async def cancel_request(
        self, request_id: uuid.UUID, user: User, reason: str | None = None
    ) -> BudgetApprovalRequest | None:
        """Cancel a budget approval request."""
        request = await self.get_request(request_id)
        if not request:
            return None

        if request.status not in [
            BudgetApprovalStatus.pending.value,
            BudgetApprovalStatus.in_review.value,
        ]:
            raise ValueError("Cannot cancel a request that is not pending or in review")

        # Only requester or admin can cancel
        if request.requested_by != user.id and user.role != UserRole.managing_director.value:
            raise ValueError("Not authorized to cancel this request")

        request.status = BudgetApprovalStatus.cancelled
        request.final_comments = reason
        request.final_decision_at = datetime.now(UTC)

        await self._record_history(
            request_id=request.id,
            action=BudgetApprovalAction.cancelled,
            actor_id=user.id,
            to_status=BudgetApprovalStatus.cancelled.value,
            comments=reason,
        )

        await self.db.commit()
        await self.db.refresh(request)
        return request

    async def _record_history(
        self,
        request_id: uuid.UUID,
        action: BudgetApprovalAction,
        actor_id: uuid.UUID,
        step_number: int | None = None,
        from_status: str | None = None,
        to_status: str | None = None,
        comments: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> BudgetApprovalHistory:
        """Record an action in the approval history."""
        # Get actor details
        result = await self.db.execute(select(User).where(User.id == actor_id))
        actor = result.scalar_one_or_none()

        history = BudgetApprovalHistory(
            request_id=request_id,
            action=action.value,
            step_number=step_number,
            from_status=from_status,
            to_status=to_status,
            actor_id=actor_id,
            actor_name=actor.full_name if actor else "Unknown",
            actor_role=actor.role if actor else "unknown",
            comments=comments,
            history_metadata=metadata,
        )
        self.db.add(history)
        await self.db.flush()
        return history

    async def get_request_history(
        self, request_id: uuid.UUID
    ) -> list[BudgetApprovalHistory]:
        """Get the full history for a request."""
        result = await self.db.execute(
            select(BudgetApprovalHistory)
            .where(BudgetApprovalHistory.request_id == request_id)
            .order_by(BudgetApprovalHistory.created_at)
        )
        return list(result.scalars().all())
