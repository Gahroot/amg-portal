"""Pydantic schemas for budget-based approval routing."""

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    BudgetApprovalStatus,
    BudgetRequestType,
    UserRole,
)
from app.schemas.base import Str50, Str100, Str255, Str2000

# === Approval Threshold Schemas ===


class ApprovalThresholdCreate(BaseModel):
    """Schema for creating an approval threshold."""

    name: str = Field(..., min_length=1, max_length=100)
    description: Str2000 | None = None
    min_amount: Decimal = Field(..., ge=0)
    max_amount: Decimal | None = Field(None, ge=0)
    approval_chain_id: UUID
    is_active: bool = True
    priority: int = Field(default=0, ge=0)


class ApprovalThresholdUpdate(BaseModel):
    """Schema for updating an approval threshold."""

    name: str | None = Field(None, min_length=1, max_length=100)
    description: Str2000 | None = None
    min_amount: Decimal | None = Field(None, ge=0)
    max_amount: Decimal | None = Field(None, ge=0)
    approval_chain_id: UUID | None = None
    is_active: bool | None = None
    priority: int | None = Field(None, ge=0)


class ApprovalThresholdResponse(BaseModel):
    """Schema for approval threshold response."""

    id: UUID
    name: Str100
    description: Str2000 | None
    min_amount: Decimal
    max_amount: Decimal | None
    approval_chain_id: UUID
    approval_chain_name: Str100 = ""
    is_active: bool
    priority: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# === Approval Chain Step Schemas ===


class ApprovalChainStepCreate(BaseModel):
    """Schema for creating an approval chain step."""

    step_number: int = Field(..., ge=1)
    required_role: UserRole
    specific_user_id: UUID | None = None
    is_parallel: bool = False
    timeout_hours: int | None = Field(None, ge=1)
    auto_approve_on_timeout: bool = False


class ApprovalChainStepUpdate(BaseModel):
    """Schema for updating an approval chain step."""

    step_number: int | None = Field(None, ge=1)
    required_role: UserRole | None = None
    specific_user_id: UUID | None = None
    is_parallel: bool | None = None
    timeout_hours: int | None = Field(None, ge=1)
    auto_approve_on_timeout: bool | None = None


class ApprovalChainStepResponse(BaseModel):
    """Schema for approval chain step response."""

    id: UUID
    approval_chain_id: UUID
    step_number: int
    required_role: Str50
    specific_user_id: UUID | None
    specific_user_name: Str255 | None = None
    is_parallel: bool
    timeout_hours: int | None
    auto_approve_on_timeout: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# === Approval Chain Schemas ===


class ApprovalChainCreate(BaseModel):
    """Schema for creating an approval chain."""

    name: str = Field(..., min_length=1, max_length=100)
    description: Str2000 | None = None
    is_active: bool = True
    steps: list[ApprovalChainStepCreate] = Field(default_factory=list)


class ApprovalChainUpdate(BaseModel):
    """Schema for updating an approval chain."""

    name: str | None = Field(None, min_length=1, max_length=100)
    description: Str2000 | None = None
    is_active: bool | None = None


class ApprovalChainResponse(BaseModel):
    """Schema for approval chain response."""

    id: UUID
    name: Str100
    description: Str2000 | None
    is_active: bool
    created_by: UUID
    creator_name: Str255 = ""
    created_at: datetime
    updated_at: datetime
    steps: list[ApprovalChainStepResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ApprovalChainSummary(BaseModel):
    """Brief summary of an approval chain."""

    id: UUID
    name: Str100
    description: Str2000 | None
    is_active: bool
    step_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# === Budget Approval Request Schemas ===


class BudgetImpactSummary(BaseModel):
    """Summary of budget impact calculation."""

    current_budget: Decimal
    requested_amount: Decimal
    budget_impact: Decimal
    projected_budget: Decimal
    utilization_percentage: float
    threshold_triggered: Str100 | None = None


class BudgetApprovalRequestCreate(BaseModel):
    """Schema for creating a budget approval request."""

    program_id: UUID
    request_type: BudgetRequestType
    title: str = Field(..., min_length=1, max_length=255)
    description: Str2000 | None = None
    requested_amount: Decimal = Field(..., gt=0)
    metadata: dict[str, Any] | None = None


class BudgetApprovalRequestUpdate(BaseModel):
    """Schema for updating a budget approval request (before submission)."""

    title: str | None = Field(None, min_length=1, max_length=255)
    description: Str2000 | None = None
    requested_amount: Decimal | None = Field(None, gt=0)
    metadata: dict[str, Any] | None = None


class BudgetApprovalStepDecision(BaseModel):
    """Schema for making a decision on an approval step."""

    decision: Literal["approved", "rejected"]
    comments: Str2000 | None = None
    delegate_to_user_id: UUID | None = None


class BudgetApprovalStepResponse(BaseModel):
    """Schema for budget approval step response."""

    id: UUID
    request_id: UUID
    chain_step_id: UUID
    step_number: int
    assigned_user_id: UUID | None
    assigned_user_name: Str255 | None = None
    assigned_role: Str50
    status: Str50
    decision: Str50 | None
    comments: Str2000 | None
    decided_by: UUID | None
    decider_name: Str255 | None = None
    decided_at: datetime | None
    is_timeout: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BudgetApprovalHistoryResponse(BaseModel):
    """Schema for approval history entry."""

    id: UUID
    request_id: UUID
    action: Str50
    step_number: int | None
    from_status: Str50 | None
    to_status: Str50 | None
    actor_id: UUID
    actor_name: Str255
    actor_role: Str50
    comments: Str2000 | None
    metadata: dict[str, Any] | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BudgetApprovalRequestResponse(BaseModel):
    """Schema for budget approval request response."""

    id: UUID
    program_id: UUID
    program_title: Str255 = ""
    request_type: Str50
    title: Str255
    description: Str2000 | None
    requested_amount: Decimal
    budget_impact: Decimal
    current_budget: Decimal
    projected_budget: Decimal
    threshold_id: UUID
    threshold_name: Str100 = ""
    approval_chain_id: UUID
    approval_chain_name: Str100 = ""
    current_step: int
    total_steps: int = 0
    status: Str50
    metadata: dict[str, Any] | None
    requested_by: UUID
    requester_name: Str255 = ""
    approved_by: UUID | None
    approver_name: Str255 | None = None
    final_decision_at: datetime | None
    final_comments: Str2000 | None
    created_at: datetime
    updated_at: datetime
    steps: list[BudgetApprovalStepResponse] = []
    history: list[BudgetApprovalHistoryResponse] = []

    model_config = ConfigDict(from_attributes=True)


class BudgetApprovalRequestSummary(BaseModel):
    """Brief summary of a budget approval request."""

    id: UUID
    program_id: UUID
    program_title: Str255 = ""
    request_type: Str50
    title: Str255
    requested_amount: Decimal
    status: Str50
    current_step: int
    total_steps: int = 0
    created_at: datetime
    requester_name: Str255 = ""

    model_config = ConfigDict(from_attributes=True)


# === List/Query Schemas ===


class BudgetApprovalListFilters(BaseModel):
    """Filters for listing budget approval requests."""

    status: BudgetApprovalStatus | None = None
    program_id: UUID | None = None
    request_type: BudgetRequestType | None = None
    requested_by: UUID | None = None
    min_amount: Decimal | None = None
    max_amount: Decimal | None = None


class PaginatedBudgetApprovalRequests(BaseModel):
    """Paginated list of budget approval requests."""

    items: list[BudgetApprovalRequestSummary]
    total: int
    skip: int
    limit: int


class PendingApprovalItem(BaseModel):
    """Item in a user's pending approvals queue."""

    id: UUID
    request_id: UUID
    request_title: Str255
    request_type: Str50
    program_id: UUID
    program_title: Str255
    requested_amount: Decimal
    step_number: int
    status: Str50
    created_at: datetime
    requester_name: Str255

    model_config = ConfigDict(from_attributes=True)


class PendingApprovalsResponse(BaseModel):
    """Response for user's pending approvals."""

    items: list[PendingApprovalItem]
    total: int


# === Budget Impact Calculation Schemas ===


class BudgetImpactRequest(BaseModel):
    """Request to calculate budget impact."""

    program_id: UUID
    requested_amount: Decimal = Field(..., gt=0)


class BudgetImpactResponse(BaseModel):
    """Response with budget impact calculation."""

    program_id: UUID
    program_title: Str255
    current_budget: Decimal
    requested_amount: Decimal
    budget_impact: Decimal
    projected_budget: Decimal
    utilization_percentage: float
    threshold_matched: ApprovalThresholdResponse | None = None
    approval_chain: ApprovalChainSummary | None = None
    requires_approval: bool
