import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, CurrentUser, require_internal, require_rm_or_above
from app.models.approval import ProgramApproval
from app.models.enums import ApprovalType, UserRole
from app.models.program import Program
from app.models.user import User
from app.schemas.approval import ApprovalDecision, ApprovalRequest, ApprovalResponse

router = APIRouter()


async def _build_approval_response(approval: ProgramApproval, db: AsyncSession) -> dict:
    requester = (
        await db.execute(select(User).where(User.id == approval.requested_by))
    ).scalar_one()

    approver_name = None
    if approval.approved_by:
        approver = (
            await db.execute(select(User).where(User.id == approval.approved_by))
        ).scalar_one_or_none()
        if approver:
            approver_name = approver.full_name

    return {
        **{c.key: getattr(approval, c.key) for c in approval.__table__.columns},
        "requester_name": requester.full_name,
        "approver_name": approver_name,
    }


@router.post(
    "/",
    response_model=ApprovalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def request_approval(
    data: ApprovalRequest,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
):
    result = await db.execute(select(Program).where(Program.id == data.program_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    approval = ProgramApproval(
        program_id=data.program_id,
        approval_type=data.approval_type.value,
        requested_by=current_user.id,
        comments=data.comments,
    )
    db.add(approval)
    await db.commit()
    await db.refresh(approval)
    return await _build_approval_response(approval, db)


@router.get("/", response_model=list[ApprovalResponse])
async def list_pending_approvals(
    db: DB,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _: None = Depends(require_internal),
):
    result = await db.execute(
        select(ProgramApproval)
        .where(ProgramApproval.status == "pending")
        .order_by(ProgramApproval.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    approvals = result.scalars().all()
    return [await _build_approval_response(a, db) for a in approvals]


@router.get(
    "/program/{program_id}",
    response_model=list[ApprovalResponse],
    dependencies=[Depends(require_internal)],
)
async def get_program_approvals(program_id: uuid.UUID, db: DB):
    result = await db.execute(
        select(ProgramApproval)
        .where(ProgramApproval.program_id == program_id)
        .order_by(ProgramApproval.created_at.desc())
    )
    approvals = result.scalars().all()
    return [await _build_approval_response(a, db) for a in approvals]


@router.patch("/{approval_id}", response_model=ApprovalResponse)
async def decide_approval(
    approval_id: uuid.UUID,
    data: ApprovalDecision,
    db: DB,
    current_user: CurrentUser,
):
    result = await db.execute(select(ProgramApproval).where(ProgramApproval.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval not found")

    if approval.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approval already decided",
        )

    # Role gating per approval type
    approval_type = approval.approval_type
    user_role = current_user.role

    if approval_type == ApprovalType.standard.value:
        allowed = {UserRole.managing_director.value, UserRole.relationship_manager.value}
    else:
        allowed = {UserRole.managing_director.value}

    if user_role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for this approval type",
        )

    approval.status = data.status
    approval.approved_by = current_user.id
    approval.decided_at = datetime.now(UTC)
    if data.comments:
        approval.comments = data.comments

    await db.commit()
    await db.refresh(approval)
    return await _build_approval_response(approval, db)
