"""API endpoints for budget-based approval routing."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, require_admin, require_compliance, require_rm_or_above
from app.models.budget_approval import (
    ApprovalChain,
    ApprovalChainStep,
    ApprovalThreshold,
    BudgetApprovalHistory,
    BudgetApprovalRequest,
    BudgetApprovalStep,
)
from app.models.enums import (
    BudgetApprovalStatus,
    BudgetRequestType,
)
from app.schemas.budget_approval import (
    ApprovalChainCreate,
    ApprovalChainResponse,
    ApprovalChainStepCreate,
    ApprovalChainStepResponse,
    ApprovalChainSummary,
    ApprovalChainUpdate,
    ApprovalThresholdCreate,
    ApprovalThresholdResponse,
    ApprovalThresholdUpdate,
    BudgetApprovalHistoryResponse,
    BudgetApprovalRequestCreate,
    BudgetApprovalRequestResponse,
    BudgetApprovalRequestSummary,
    BudgetApprovalStepDecision,
    BudgetApprovalStepResponse,
    BudgetImpactRequest,
    BudgetImpactResponse,
    PaginatedBudgetApprovalRequests,
    PendingApprovalItem,
    PendingApprovalsResponse,
)
from app.services.budget_approval_service import BudgetApprovalService

router = APIRouter()


# === Helper Functions ===


async def _build_threshold_response(
    threshold: ApprovalThreshold, db
) -> dict[str, Any]:
    """Build a threshold response with chain name."""
    return {
        "id": threshold.id,
        "name": threshold.name,
        "description": threshold.description,
        "min_amount": threshold.min_amount,
        "max_amount": threshold.max_amount,
        "approval_chain_id": threshold.approval_chain_id,
        "approval_chain_name": threshold.approval_chain.name if threshold.approval_chain else "",
        "is_active": threshold.is_active,
        "priority": threshold.priority,
        "created_at": threshold.created_at,
        "updated_at": threshold.updated_at,
    }


async def _build_chain_step_response(step: ApprovalChainStep) -> dict[str, Any]:
    """Build a chain step response."""
    return {
        "id": step.id,
        "approval_chain_id": step.approval_chain_id,
        "step_number": step.step_number,
        "required_role": step.required_role,
        "specific_user_id": step.specific_user_id,
        "specific_user_name": step.specific_user.full_name if step.specific_user else None,
        "is_parallel": step.is_parallel,
        "timeout_hours": step.timeout_hours,
        "auto_approve_on_timeout": step.auto_approve_on_timeout,
        "created_at": step.created_at,
        "updated_at": step.updated_at,
    }


async def _build_chain_response(chain: ApprovalChain) -> dict[str, Any]:
    """Build a chain response with steps."""
    steps = sorted(chain.steps, key=lambda s: s.step_number)
    return {
        "id": chain.id,
        "name": chain.name,
        "description": chain.description,
        "is_active": chain.is_active,
        "created_by": chain.created_by,
        "creator_name": chain.creator.full_name if chain.creator else "",
        "created_at": chain.created_at,
        "updated_at": chain.updated_at,
        "steps": [await _build_chain_step_response(s) for s in steps],
    }


async def _build_request_response(request: BudgetApprovalRequest) -> dict[str, Any]:
    """Build a full request response with all related data."""
    steps = sorted(request.steps, key=lambda s: s.step_number)
    history = sorted(request.history, key=lambda h: h.created_at)

    total_steps = len({s.step_number for s in steps})

    return {
        "id": request.id,
        "program_id": request.program_id,
        "program_title": request.program.title if request.program else "",
        "request_type": request.request_type,
        "title": request.title,
        "description": request.description,
        "requested_amount": request.requested_amount,
        "budget_impact": request.budget_impact,
        "current_budget": request.current_budget,
        "projected_budget": request.projected_budget,
        "threshold_id": request.threshold_id,
        "threshold_name": request.threshold.name if request.threshold else "",
        "approval_chain_id": request.approval_chain_id,
        "approval_chain_name": request.approval_chain.name if request.approval_chain else "",
        "current_step": request.current_step,
        "total_steps": total_steps,
        "status": request.status,
        "metadata": request.metadata,
        "requested_by": request.requested_by,
        "requester_name": request.requester.full_name if request.requester else "",
        "approved_by": request.approved_by,
        "approver_name": request.final_approver.full_name if request.final_approver else None,
        "final_decision_at": request.final_decision_at,
        "final_comments": request.final_comments,
        "created_at": request.created_at,
        "updated_at": request.updated_at,
        "steps": [await _build_approval_step_response(s) for s in steps],
        "history": [await _build_history_response(h) for h in history],
    }


async def _build_approval_step_response(step: BudgetApprovalStep) -> dict[str, Any]:
    """Build an approval step response."""
    return {
        "id": step.id,
        "request_id": step.request_id,
        "chain_step_id": step.chain_step_id,
        "step_number": step.step_number,
        "assigned_user_id": step.assigned_user_id,
        "assigned_user_name": step.assigned_user.full_name if step.assigned_user else None,
        "assigned_role": step.assigned_role,
        "status": step.status,
        "decision": step.decision,
        "comments": step.comments,
        "decided_by": step.decided_by,
        "decider_name": step.decider.full_name if step.decider else None,
        "decided_at": step.decided_at,
        "is_timeout": step.is_timeout,
        "created_at": step.created_at,
        "updated_at": step.updated_at,
    }


async def _build_history_response(history: BudgetApprovalHistory) -> dict[str, Any]:
    """Build a history response."""
    return {
        "id": history.id,
        "request_id": history.request_id,
        "action": history.action,
        "step_number": history.step_number,
        "from_status": history.from_status,
        "to_status": history.to_status,
        "actor_id": history.actor_id,
        "actor_name": history.actor_name,
        "actor_role": history.actor_role,
        "comments": history.comments,
        "metadata": history.metadata,
        "created_at": history.created_at,
    }


# === Budget Impact Endpoints ===


@router.post("/impact", response_model=BudgetImpactResponse)
async def calculate_budget_impact(
    data: BudgetImpactRequest,
    db: DB,
    _: None = Depends(require_compliance),
):
    """Calculate budget impact and determine required approval chain."""
    service = BudgetApprovalService(db)
    try:
        impact = await service.calculate_budget_impact(data.program_id, data.requested_amount)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from None

    threshold_data = None
    chain_data = None

    if impact["threshold_matched"]:
        threshold_data = await _build_threshold_response(
            impact["threshold_matched"], db
        )
        if impact["approval_chain"]:
            chain = impact["approval_chain"]
            has_steps = hasattr(chain, "steps")
            chain_data = {
                "id": chain.id,
                "name": chain.name,
                "description": chain.description,
                "is_active": chain.is_active,
                "step_count": len(chain.steps) if has_steps else 0,
            }

    return BudgetImpactResponse(
        program_id=impact["program_id"],
        program_title=impact["program_title"],
        current_budget=impact["current_budget"],
        requested_amount=impact["requested_amount"],
        budget_impact=impact["budget_impact"],
        projected_budget=impact["projected_budget"],
        utilization_percentage=impact["utilization_percentage"],
        threshold_matched=threshold_data,
        approval_chain=chain_data,
        requires_approval=impact["requires_approval"],
    )


# === Approval Threshold Endpoints ===


@router.post(
    "/thresholds",
    response_model=ApprovalThresholdResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_threshold(
    data: ApprovalThresholdCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_admin),
):
    """Create a new approval threshold."""
    service = BudgetApprovalService(db)

    # Verify chain exists
    result = await db.execute(
        select(ApprovalChain).where(ApprovalChain.id == data.approval_chain_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval chain not found",
        )

    threshold = await service.create_threshold(
        name=data.name,
        min_amount=data.min_amount,
        approval_chain_id=data.approval_chain_id,
        description=data.description,
        max_amount=data.max_amount,
        is_active=data.is_active,
        priority=data.priority,
    )
    return await _build_threshold_response(threshold, db)


@router.get("/thresholds", response_model=list[ApprovalThresholdResponse])
async def list_thresholds(
    db: DB,
    _: None = Depends(require_compliance),
    is_active: bool | None = Query(None),
):
    """List all approval thresholds."""
    service = BudgetApprovalService(db)
    thresholds = await service.list_thresholds(is_active=is_active)
    return [await _build_threshold_response(t, db) for t in thresholds]


@router.get("/thresholds/{threshold_id}", response_model=ApprovalThresholdResponse)
async def get_threshold(
    threshold_id: uuid.UUID,
    db: DB,
    _: None = Depends(require_compliance),
):
    """Get an approval threshold by ID."""
    service = BudgetApprovalService(db)
    threshold = await service.get_threshold(threshold_id)
    if not threshold:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Threshold not found",
        )
    return await _build_threshold_response(threshold, db)


@router.patch("/thresholds/{threshold_id}", response_model=ApprovalThresholdResponse)
async def update_threshold(
    threshold_id: uuid.UUID,
    data: ApprovalThresholdUpdate,
    db: DB,
    _: None = Depends(require_admin),
):
    """Update an approval threshold."""
    service = BudgetApprovalService(db)
    threshold = await service.update_threshold(
        threshold_id,
        **data.model_dump(exclude_unset=True),
    )
    if not threshold:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Threshold not found",
        )
    return await _build_threshold_response(threshold, db)


@router.delete("/thresholds/{threshold_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_threshold(
    threshold_id: uuid.UUID,
    db: DB,
    _: None = Depends(require_admin),
):
    """Delete an approval threshold."""
    service = BudgetApprovalService(db)
    deleted = await service.delete_threshold(threshold_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Threshold not found",
        )


# === Approval Chain Endpoints ===


@router.post(
    "/chains",
    response_model=ApprovalChainResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_chain(
    data: ApprovalChainCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_admin),
):
    """Create a new approval chain with steps."""
    service = BudgetApprovalService(db)
    steps_data = [s.model_dump() for s in data.steps]
    chain = await service.create_chain(
        name=data.name,
        created_by=current_user.id,
        description=data.description,
        is_active=data.is_active,
        steps=steps_data,
    )
    # Reload with relationships
    chain = await service.get_chain(chain.id)
    return await _build_chain_response(chain)


@router.get("/chains", response_model=list[ApprovalChainSummary])
async def list_chains(
    db: DB,
    _: None = Depends(require_compliance),
    is_active: bool | None = Query(None),
):
    """List all approval chains."""
    service = BudgetApprovalService(db)
    chains = await service.list_chains(is_active=is_active)
    return [
        ApprovalChainSummary(
            id=c.id,
            name=c.name,
            description=c.description,
            is_active=c.is_active,
            step_count=len(c.steps),
        )
        for c in chains
    ]


@router.get("/chains/{chain_id}", response_model=ApprovalChainResponse)
async def get_chain(
    chain_id: uuid.UUID,
    db: DB,
    _: None = Depends(require_compliance),
):
    """Get an approval chain by ID with steps."""
    service = BudgetApprovalService(db)
    chain = await service.get_chain(chain_id)
    if not chain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval chain not found",
        )
    return await _build_chain_response(chain)


@router.patch("/chains/{chain_id}", response_model=ApprovalChainResponse)
async def update_chain(
    chain_id: uuid.UUID,
    data: ApprovalChainUpdate,
    db: DB,
    _: None = Depends(require_admin),
):
    """Update an approval chain."""
    service = BudgetApprovalService(db)
    chain = await service.update_chain(
        chain_id,
        **data.model_dump(exclude_unset=True),
    )
    if not chain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval chain not found",
        )
    return await _build_chain_response(chain)


@router.delete("/chains/{chain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chain(
    chain_id: uuid.UUID,
    db: DB,
    _: None = Depends(require_admin),
):
    """Delete an approval chain."""
    service = BudgetApprovalService(db)
    deleted = await service.delete_chain(chain_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval chain not found",
        )


@router.post(
    "/chains/{chain_id}/steps",
    response_model=ApprovalChainStepResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_chain_step(
    chain_id: uuid.UUID,
    data: ApprovalChainStepCreate,
    db: DB,
    _: None = Depends(require_admin),
):
    """Add a step to an approval chain."""
    service = BudgetApprovalService(db)
    step = await service.add_chain_step(
        chain_id=chain_id,
        step_number=data.step_number,
        required_role=data.required_role,
        specific_user_id=data.specific_user_id,
        is_parallel=data.is_parallel,
        timeout_hours=data.timeout_hours,
        auto_approve_on_timeout=data.auto_approve_on_timeout,
    )
    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval chain not found",
        )
    return await _build_chain_step_response(step)


@router.delete(
    "/chains/{chain_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_chain_step(
    chain_id: uuid.UUID,
    step_id: uuid.UUID,
    db: DB,
    _: None = Depends(require_admin),
):
    """Remove a step from an approval chain."""
    service = BudgetApprovalService(db)
    deleted = await service.remove_chain_step(step_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Step not found",
        )


# === Budget Approval Request Endpoints ===


@router.post(
    "/requests",
    response_model=BudgetApprovalRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_request(
    data: BudgetApprovalRequestCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
):
    """Create a new budget approval request."""
    service = BudgetApprovalService(db)
    try:
        request = await service.create_request(
            program_id=data.program_id,
            request_type=data.request_type,
            title=data.title,
            requested_amount=data.requested_amount,
            requested_by=current_user.id,
            description=data.description,
            metadata=data.metadata,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from None

    request = await service.get_request(request.id)
    return await _build_request_response(request)


@router.get("/requests", response_model=PaginatedBudgetApprovalRequests)
async def list_requests(
    db: DB,
    _: None = Depends(require_compliance),
    status: BudgetApprovalStatus | None = Query(None),
    program_id: uuid.UUID | None = Query(None),
    request_type: BudgetRequestType | None = Query(None),
    requested_by: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List budget approval requests with filters."""
    service = BudgetApprovalService(db)
    requests, total = await service.list_requests(
        status=status,
        program_id=program_id,
        request_type=request_type,
        requested_by=requested_by,
        skip=skip,
        limit=limit,
    )

    items = [
        BudgetApprovalRequestSummary(
            id=r.id,
            program_id=r.program_id,
            program_title=r.program.title if r.program else "",
            request_type=r.request_type,
            title=r.title,
            requested_amount=r.requested_amount,
            status=r.status,
            current_step=r.current_step,
            total_steps=len({s.step_number for s in r.steps}) if r.steps else 0,
            created_at=r.created_at,
            requester_name=r.requester.full_name if r.requester else "",
        )
        for r in requests
    ]

    return PaginatedBudgetApprovalRequests(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/requests/pending", response_model=PendingApprovalsResponse)
async def get_pending_approvals(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_compliance),
):
    """Get pending approvals for the current user."""
    service = BudgetApprovalService(db)
    pending = await service.get_pending_approvals_for_user(current_user)

    items = [
        PendingApprovalItem(
            id=step.id,
            request_id=request.id,
            request_title=request.title,
            request_type=request.request_type,
            program_id=request.program_id,
            program_title=request.program.title if request.program else "",
            requested_amount=request.requested_amount,
            step_number=step.step_number,
            status=step.status,
            created_at=step.created_at,
            requester_name=request.requester.full_name if request.requester else "",
        )
        for step, request in pending
    ]

    return PendingApprovalsResponse(items=items, total=len(items))


@router.get("/requests/{request_id}", response_model=BudgetApprovalRequestResponse)
async def get_request(
    request_id: uuid.UUID,
    db: DB,
    _: None = Depends(require_compliance),
):
    """Get a budget approval request by ID."""
    service = BudgetApprovalService(db)
    request = await service.get_request(request_id)
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )
    return await _build_request_response(request)


@router.post("/requests/{request_id}/cancel", response_model=BudgetApprovalRequestResponse)
async def cancel_request(
    request_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    reason: str | None = Query(None),
):
    """Cancel a budget approval request."""
    service = BudgetApprovalService(db)
    try:
        request = await service.cancel_request(request_id, current_user, reason)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from None

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )
    request = await service.get_request(request.id)
    return await _build_request_response(request)


# === Approval Step Decision Endpoints ===


@router.post("/steps/{step_id}/decide", response_model=BudgetApprovalStepResponse)
async def decide_step(
    step_id: uuid.UUID,
    data: BudgetApprovalStepDecision,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_compliance),
):
    """Make a decision on an approval step."""
    service = BudgetApprovalService(db)
    try:
        step = await service.decide_step(
            step_id=step_id,
            decision=data.decision,
            user=current_user,
            comments=data.comments,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from None

    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Step not found",
        )
    return await _build_approval_step_response(step)


# === History Endpoints ===


@router.get(
    "/requests/{request_id}/history", response_model=list[BudgetApprovalHistoryResponse]
)
async def get_request_history(
    request_id: uuid.UUID,
    db: DB,
    _: None = Depends(require_compliance),
):
    """Get the full history for a budget approval request."""
    service = BudgetApprovalService(db)
    history = await service.get_request_history(request_id)
    return [await _build_history_response(h) for h in history]
