import contextlib
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, CurrentUser, require_internal, require_rm_or_above
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.approval import ProgramApproval
from app.models.approval_comment import ApprovalComment
from app.models.enums import (
    ApprovalType,
    AuditAction,
    NotificationType,
    ProgramApprovalStatus,
    UserRole,
)
from app.models.program import Program
from app.models.user import User
from app.schemas.approval import (
    ApprovalCommentCreate,
    ApprovalCommentResponse,
    ApprovalCommentThreadResponse,
    ApprovalDecision,
    ApprovalRequest,
    ApprovalResponse,
)
from app.schemas.notification import CreateNotificationRequest
from app.services.audit_service import log_action
from app.services.notification_service import notification_service

router = APIRouter()

# Regex to extract @mentions like @[UserName](user-uuid)
_MENTION_RE = re.compile(r"@\[[^\]]+\]\(([0-9a-f-]{36})\)")


def _extract_mentions(content: str) -> list[str]:
    return _MENTION_RE.findall(content)


async def _build_approval_response(approval: ProgramApproval, db: AsyncSession) -> dict[str, Any]:
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


def _build_comment_response(
    comment: ApprovalComment, author_name: str, reply_responses: list[ApprovalCommentResponse]
) -> ApprovalCommentResponse:
    return ApprovalCommentResponse(
        id=comment.id,
        entity_type=comment.entity_type,
        entity_id=comment.entity_id,
        parent_id=comment.parent_id,
        author_id=comment.author_id,
        author_name=author_name,
        content=comment.content,
        is_internal=comment.is_internal,
        mentioned_user_ids=[uuid.UUID(s) for s in (comment.mentioned_user_ids or [])],
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        replies=reply_responses,
    )


async def _build_thread(
    comments: list[ApprovalComment], db: AsyncSession
) -> list[ApprovalCommentResponse]:
    """Build a nested comment thread from a flat list, fetching author names."""

    # Fetch all unique authors in one pass
    author_ids = {c.author_id for c in comments}
    author_rows = (
        await db.execute(select(User).where(User.id.in_(author_ids)))
    ).scalars().all()
    author_map: dict[uuid.UUID, str] = {u.id: u.full_name for u in author_rows}

    # Index comments
    by_id: dict[uuid.UUID, ApprovalComment] = {c.id: c for c in comments}
    children: dict[uuid.UUID, list[ApprovalComment]] = {c.id: [] for c in comments}
    roots: list[ApprovalComment] = []

    for c in comments:
        if c.parent_id and c.parent_id in by_id:
            children[c.parent_id].append(c)
        else:
            roots.append(c)

    def _build(c: ApprovalComment) -> ApprovalCommentResponse:
        reply_responses = [
            _build(child)
            for child in sorted(children.get(c.id, []), key=lambda x: x.created_at)
        ]
        return _build_comment_response(c, author_map.get(c.author_id, "Unknown"), reply_responses)

    return [_build(r) for r in sorted(roots, key=lambda x: x.created_at)]


# ─── Approval CRUD ─────────────────────────────────────────────────────────────


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
) -> dict[str, Any]:
    result = await db.execute(select(Program).where(Program.id == data.program_id))
    if not result.scalar_one_or_none():
        raise NotFoundException("Program not found")

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
) -> list[dict[str, Any]]:
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
async def get_program_approvals(
    program_id: uuid.UUID, db: DB
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(ProgramApproval)
        .where(ProgramApproval.program_id == program_id)
        .order_by(ProgramApproval.created_at.desc())
    )
    approvals = result.scalars().all()
    return [await _build_approval_response(a, db) for a in approvals]


@router.get(
    "/{approval_id}",
    response_model=ApprovalResponse,
    dependencies=[Depends(require_internal)],
)
async def get_approval(approval_id: uuid.UUID, db: DB) -> dict[str, Any]:
    result = await db.execute(select(ProgramApproval).where(ProgramApproval.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise NotFoundException("Approval not found")
    return await _build_approval_response(approval, db)


@router.patch("/{approval_id}", response_model=ApprovalResponse)
async def decide_approval(
    approval_id: uuid.UUID,
    data: ApprovalDecision,
    db: DB,
    current_user: CurrentUser,
) -> dict[str, Any]:
    result = await db.execute(select(ProgramApproval).where(ProgramApproval.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise NotFoundException("Approval not found")

    if approval.status != "pending":
        raise BadRequestException("Approval already decided")

    # Role gating per approval type
    approval_type = approval.approval_type
    user_role = current_user.role

    if approval_type == ApprovalType.standard.value:
        allowed = {UserRole.managing_director.value, UserRole.relationship_manager.value}
    else:
        allowed = {UserRole.managing_director.value}

    if user_role not in allowed:
        raise ForbiddenException("Insufficient permissions for this approval type")

    approval.status = ProgramApprovalStatus(data.status)
    approval.approved_by = current_user.id
    approval.decided_at = datetime.now(UTC)
    if data.comments:
        approval.comments = data.comments

    await db.commit()
    await db.refresh(approval)

    semantic_action = (
        AuditAction.approval_approved
        if approval.status == ProgramApprovalStatus.approved
        else AuditAction.approval_rejected
    )
    await log_action(
        db,
        action=semantic_action,
        entity_type="program_approval",
        entity_id=str(approval.id),
        user=current_user,
        after_state={
            "status": approval.status.value,
            "approval_type": approval.approval_type,
            "comments": data.comments,
        },
    )
    await db.commit()

    return await _build_approval_response(approval, db)


async def _gather_notify_ids(
    db: AsyncSession,
    commenter_id: uuid.UUID,
    entity_type: str,
    entity_id: uuid.UUID,
    parent_id: uuid.UUID | None,
    mention_ids: list[str],
) -> set[uuid.UUID]:
    """Collect user IDs to notify about a new comment."""
    ids: set[uuid.UUID] = set()

    if entity_type == "program_approval":
        pa = (
            await db.execute(select(ProgramApproval).where(ProgramApproval.id == entity_id))
        ).scalar_one_or_none()
        if pa:
            ids.update(
                uid for uid in (pa.requested_by, pa.approved_by)
                if uid and uid != commenter_id
            )

    for uid_str in mention_ids:
        with contextlib.suppress(ValueError):
            uid = uuid.UUID(uid_str)
            if uid != commenter_id:
                ids.add(uid)

    if parent_id:
        parent_c = (
            await db.execute(select(ApprovalComment).where(ApprovalComment.id == parent_id))
        ).scalar_one_or_none()
        if parent_c and parent_c.author_id != commenter_id:
            ids.add(parent_c.author_id)

    return ids


# ─── Comment Endpoints ─────────────────────────────────────────────────────────


@router.get(
    "/{entity_id}/comments",
    response_model=ApprovalCommentThreadResponse,
    dependencies=[Depends(require_internal)],
)
async def get_comments(
    entity_id: uuid.UUID,
    db: DB,
    entity_type: str = Query("program_approval"),
    include_internal: bool = Query(True),
) -> ApprovalCommentThreadResponse:
    """Return the full comment thread for an approval entity."""
    query = (
        select(ApprovalComment)
        .where(
            ApprovalComment.entity_id == entity_id,
            ApprovalComment.entity_type == entity_type,
        )
        .order_by(ApprovalComment.created_at)
    )
    if not include_internal:
        query = query.where(ApprovalComment.is_internal == False)  # noqa: E712

    comments = (await db.execute(query)).scalars().all()
    thread = await _build_thread(list(comments), db)
    return ApprovalCommentThreadResponse(
        entity_type=entity_type,
        entity_id=entity_id,
        total=len(comments),
        comments=thread,
    )


@router.post(
    "/{entity_id}/comments",
    response_model=ApprovalCommentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal)],
)
async def add_comment(
    entity_id: uuid.UUID,
    data: ApprovalCommentCreate,
    db: DB,
    current_user: CurrentUser,
    entity_type: str = Query("program_approval"),
) -> ApprovalCommentResponse:
    """Post a new comment (or reply) on an approval entity."""

    # Validate parent exists and belongs to same entity
    if data.parent_id:
        parent_result = await db.execute(
            select(ApprovalComment).where(ApprovalComment.id == data.parent_id)
        )
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise NotFoundException("Parent comment not found")
        if parent.entity_id != entity_id or parent.entity_type != entity_type:
            raise BadRequestException("Parent comment belongs to a different entity")

    # Resolve @mentions from content
    extracted_ids = _extract_mentions(data.content)
    all_mention_ids = list(
        {str(u) for u in data.mentioned_user_ids} | set(extracted_ids)
    )

    comment = ApprovalComment(
        entity_type=entity_type,
        entity_id=entity_id,
        parent_id=data.parent_id,
        author_id=current_user.id,
        content=data.content,
        is_internal=data.is_internal,
        mentioned_user_ids=all_mention_ids,
    )
    db.add(comment)
    await db.flush()

    notify_user_ids = await _gather_notify_ids(
        db, current_user.id, entity_type, entity_id, data.parent_id, all_mention_ids
    )

    await db.commit()
    await db.refresh(comment)

    # Fire notifications (best-effort)
    action_url = f"/approvals/{entity_id}?entity_type={entity_type}"
    for uid in notify_user_ids:
        with contextlib.suppress(Exception):
            await notification_service.create_notification(
                db,
                CreateNotificationRequest(
                    user_id=uid,
                    notification_type=NotificationType.approval_required,
                    title="New comment on approval",
                    body=f"{current_user.full_name} commented: {data.content[:120]}",
                    action_url=action_url,
                    action_label="View comment",
                    entity_type=entity_type,
                    entity_id=entity_id,
                    priority="normal",
                ),
            )

    return _build_comment_response(comment, current_user.full_name, [])


@router.delete(
    "/{entity_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_internal)],
)
async def delete_comment(
    entity_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    entity_type: str = Query("program_approval"),
) -> None:
    """Delete a comment. Authors can delete their own; MDs can delete any."""
    result = await db.execute(
        select(ApprovalComment).where(ApprovalComment.id == comment_id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise NotFoundException("Comment not found")
    if comment.entity_id != entity_id or comment.entity_type != entity_type:
        raise BadRequestException("Comment does not belong to this entity")

    is_own = comment.author_id == current_user.id
    is_md = current_user.role == UserRole.managing_director.value
    if not is_own and not is_md:
        raise ForbiddenException("Cannot delete another user's comment")

    await db.delete(comment)
    await db.commit()
