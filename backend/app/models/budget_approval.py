"""Budget-based approval routing engine models."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import (
    BudgetApprovalAction,
    BudgetApprovalStatus,
    BudgetApprovalStepStatus,
    BudgetRequestType,
    UserRole,
)


class ApprovalThreshold(Base, TimestampMixin):
    """Configurable budget thresholds that trigger approval routing."""

    __tablename__ = "approval_thresholds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    max_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    approval_chain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_chains.id"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    approval_chain = relationship("ApprovalChain", back_populates="thresholds")


class ApprovalChain(Base, TimestampMixin):
    """Multi-level approval chain configuration."""

    __tablename__ = "approval_chains"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    steps = relationship(
        "ApprovalChainStep", back_populates="approval_chain", cascade="all, delete-orphan"
    )
    thresholds = relationship(
        "ApprovalThreshold", back_populates="approval_chain", cascade="all, delete-orphan"
    )
    creator = relationship("User", foreign_keys=[created_by])


class ApprovalChainStep(Base, TimestampMixin):
    """Individual step in an approval chain."""

    __tablename__ = "approval_chain_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    approval_chain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_chains.id"), nullable=False
    )
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    required_role: Mapped[UserRole] = mapped_column(String(50), nullable=False)
    specific_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    is_parallel: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    timeout_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    auto_approve_on_timeout: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    approval_chain = relationship("ApprovalChain", back_populates="steps")
    specific_user = relationship("User", foreign_keys=[specific_user_id])


class BudgetApprovalRequest(Base, TimestampMixin):
    """Approval request with budget impact calculation."""

    __tablename__ = "budget_approval_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id"), nullable=False, index=True
    )
    request_type: Mapped[BudgetRequestType] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    budget_impact: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    current_budget: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    projected_budget: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    threshold_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_thresholds.id"), nullable=False
    )
    approval_chain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_chains.id"), nullable=False
    )
    current_step: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[BudgetApprovalStatus] = mapped_column(
        String(20), default=BudgetApprovalStatus.pending, nullable=False
    )
    request_metadata: Mapped[dict[str, object] | None] = mapped_column(
        "metadata", JSONB, nullable=True, key="request_metadata"
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    final_decision_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    final_comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    program = relationship("Program")
    threshold = relationship("ApprovalThreshold")
    approval_chain = relationship("ApprovalChain")
    requester = relationship("User", foreign_keys=[requested_by])
    final_approver = relationship("User", foreign_keys=[approved_by])
    steps = relationship(
        "BudgetApprovalStep", back_populates="request", cascade="all, delete-orphan"
    )
    history = relationship(
        "BudgetApprovalHistory", back_populates="request", cascade="all, delete-orphan"
    )


class BudgetApprovalStep(Base, TimestampMixin):
    """Individual step approval record for multi-level approvals."""

    __tablename__ = "budget_approval_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("budget_approval_requests.id"), nullable=False, index=True
    )
    chain_step_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_chain_steps.id"), nullable=False
    )
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    assigned_role: Mapped[UserRole] = mapped_column(String(50), nullable=False)
    status: Mapped[BudgetApprovalStepStatus] = mapped_column(
        String(20), default=BudgetApprovalStepStatus.pending, nullable=False
    )
    decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_timeout: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    request = relationship("BudgetApprovalRequest", back_populates="steps")
    chain_step = relationship("ApprovalChainStep")
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])
    decider = relationship("User", foreign_keys=[decided_by])


class BudgetApprovalHistory(Base):
    """Audit trail for all approval actions."""

    __tablename__ = "budget_approval_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("budget_approval_requests.id"), nullable=False, index=True
    )
    action: Mapped[BudgetApprovalAction] = mapped_column(String(50), nullable=False)
    step_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    from_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    actor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    actor_role: Mapped[UserRole] = mapped_column(String(50), nullable=False)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    history_metadata: Mapped[dict[str, object] | None] = mapped_column(
        "metadata", JSONB, nullable=True, key="history_metadata"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    request = relationship("BudgetApprovalRequest", back_populates="history")
    actor = relationship("User")
