"""Portal feedback API endpoints."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.portal_feedback import FeedbackStatus, FeedbackType, PortalFeedback
from app.models.user import User
from app.schemas.portal_feedback import (
    PortalFeedbackCreate,
    PortalFeedbackListResponse,
    PortalFeedbackResponse,
    PortalFeedbackSummary,
    PortalFeedbackTypesResponse,
    PortalFeedbackUpdate,
    get_feedback_type_options,
)
from app.services.email_service import send_email

router = APIRouter()


# ==================== Public/User Endpoints ====================


@router.get("/types", response_model=PortalFeedbackTypesResponse)
async def get_feedback_types() -> PortalFeedbackTypesResponse:
    """Get available feedback types."""
    return PortalFeedbackTypesResponse(types=get_feedback_type_options())


@router.post("/", response_model=PortalFeedbackResponse, status_code=201)
async def submit_feedback(
    data: PortalFeedbackCreate,
    db: DB,
    current_user: CurrentUser,
) -> PortalFeedbackResponse:
    """Submit feedback from the portal widget."""
    # Validate feedback type
    data.validate_feedback_type()

    # Create feedback record
    feedback = PortalFeedback(
        user_id=current_user.id,
        feedback_type=data.feedback_type,
        description=data.description,
        page_url=data.page_url,
        screenshot_url=data.screenshot_url,
        email=data.email or current_user.email,
        user_agent=data.user_agent,
        extra_data=data.extra_data,
        status=FeedbackStatus.OPEN,
    )

    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    # Send confirmation email to user
    if feedback.email:
        await send_feedback_confirmation(feedback.email, feedback)

    # Notify product team (in production, this would go to a Slack channel or email)
    await notify_product_team(feedback, current_user)

    # Load relationships for response
    await db.refresh(feedback, ["user"])

    return PortalFeedbackResponse(
        **{
            c.name: getattr(feedback, c.name)
            for c in feedback.__table__.columns
        },
        user_name=current_user.full_name,
        user_email=current_user.email,
    )


@router.get("/my", response_model=PortalFeedbackListResponse)
async def list_my_feedback(
    db: DB,
    current_user: CurrentUser,
    status: str | None = Query(None, description="Filter by status"),
    feedback_type: str | None = Query(None, description="Filter by type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> PortalFeedbackListResponse:
    """List feedback submitted by the current user."""
    query = (
        select(PortalFeedback)
        .where(PortalFeedback.user_id == current_user.id)
        .order_by(PortalFeedback.created_at.desc())
    )

    count_query = (
        select(func.count())
        .select_from(PortalFeedback)
        .where(PortalFeedback.user_id == current_user.id)
    )

    if status:
        query = query.where(PortalFeedback.status == status)
        count_query = count_query.where(PortalFeedback.status == status)

    if feedback_type:
        query = query.where(PortalFeedback.feedback_type == feedback_type)
        count_query = count_query.where(PortalFeedback.feedback_type == feedback_type)

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(query.offset(skip).limit(limit))
    feedback_list = list(result.scalars().all())

    return PortalFeedbackListResponse(
        feedback=[
            PortalFeedbackResponse(
                **{c.name: getattr(f, c.name) for c in f.__table__.columns},
                user_name=current_user.full_name,
                user_email=current_user.email,
            )
            for f in feedback_list
        ],
        total=total,
    )


@router.get("/my/{feedback_id}", response_model=PortalFeedbackResponse)
async def get_my_feedback(
    feedback_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> PortalFeedbackResponse:
    """Get a specific feedback item submitted by the current user."""
    result = await db.execute(
        select(PortalFeedback).where(
            PortalFeedback.id == feedback_id,
            PortalFeedback.user_id == current_user.id,
        )
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        raise NotFoundException("Feedback not found")

    return PortalFeedbackResponse(
        **{c.name: getattr(feedback, c.name) for c in feedback.__table__.columns},
        user_name=current_user.full_name,
        user_email=current_user.email,
    )


# ==================== Admin Endpoints ====================


@router.get("/", response_model=PortalFeedbackListResponse)
async def list_all_feedback(
    db: DB,
    current_user: CurrentUser,  # TODO: Add admin check
    status: str | None = Query(None, description="Filter by status"),
    feedback_type: str | None = Query(None, description="Filter by type"),
    priority: str | None = Query(None, description="Filter by priority"),
    assigned_to: uuid.UUID | None = Query(None, description="Filter by assignee"),
    search: str | None = Query(None, description="Search in description"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> PortalFeedbackListResponse:
    """List all feedback (admin only)."""
    query = select(PortalFeedback).options(
        selectinload(PortalFeedback.user),
        selectinload(PortalFeedback.assignee),
    ).order_by(PortalFeedback.created_at.desc())

    count_query = select(func.count()).select_from(PortalFeedback)

    if status:
        query = query.where(PortalFeedback.status == status)
        count_query = count_query.where(PortalFeedback.status == status)

    if feedback_type:
        query = query.where(PortalFeedback.feedback_type == feedback_type)
        count_query = count_query.where(PortalFeedback.feedback_type == feedback_type)

    if priority:
        query = query.where(PortalFeedback.priority == priority)
        count_query = count_query.where(PortalFeedback.priority == priority)

    if assigned_to:
        query = query.where(PortalFeedback.assigned_to == assigned_to)
        count_query = count_query.where(PortalFeedback.assigned_to == assigned_to)

    if search:
        search_term = f"%{search}%"
        query = query.where(PortalFeedback.description.ilike(search_term))
        count_query = count_query.where(PortalFeedback.description.ilike(search_term))

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(query.offset(skip).limit(limit))
    feedback_list = list(result.scalars().all())

    return PortalFeedbackListResponse(
        feedback=[
            PortalFeedbackResponse(
                **{c.name: getattr(f, c.name) for c in f.__table__.columns},
                user_name=f.user.full_name if f.user else None,
                user_email=f.user.email if f.user else None,
                assignee_name=f.assignee.full_name if f.assignee else None,
            )
            for f in feedback_list
        ],
        total=total,
    )


@router.get("/summary", response_model=PortalFeedbackSummary)
async def get_feedback_summary(
    db: DB,
    current_user: CurrentUser,  # TODO: Add admin check
) -> PortalFeedbackSummary:
    """Get feedback summary statistics (admin only)."""
    # Total count
    total_result = await db.execute(select(func.count()).select_from(PortalFeedback))
    total = total_result.scalar_one()

    # By status
    status_result = await db.execute(
        select(PortalFeedback.status, func.count())
        .group_by(PortalFeedback.status)
    )
    by_status: dict[str, int] = {row[0]: row[1] for row in status_result}

    # By type
    type_result = await db.execute(
        select(PortalFeedback.feedback_type, func.count())
        .group_by(PortalFeedback.feedback_type)
    )
    by_type: dict[str, int] = {row[0]: row[1] for row in type_result}

    # By priority
    priority_result = await db.execute(
        select(PortalFeedback.priority, func.count())
        .group_by(PortalFeedback.priority)
    )
    by_priority: dict[str, int] = {
        row[0] or "unprioritized": row[1] for row in priority_result
    }

    # Unassigned count
    unassigned_result = await db.execute(
        select(func.count())
        .select_from(PortalFeedback)
        .where(PortalFeedback.assigned_to.is_(None))
    )
    unassigned_count = unassigned_result.scalar_one()

    # Open count
    open_result = await db.execute(
        select(func.count())
        .select_from(PortalFeedback)
        .where(PortalFeedback.status == FeedbackStatus.OPEN)
    )
    open_count = open_result.scalar_one()

    # Resolved this week
    week_ago = datetime.now(UTC) - timedelta(days=7)
    resolved_week_result = await db.execute(
        select(func.count())
        .select_from(PortalFeedback)
        .where(
            PortalFeedback.status == FeedbackStatus.RESOLVED,
            PortalFeedback.resolved_at >= week_ago,
        )
    )
    resolved_this_week = resolved_week_result.scalar_one()

    return PortalFeedbackSummary(
        total=total,
        by_status=by_status,
        by_type=by_type,
        by_priority=by_priority,
        unassigned_count=unassigned_count,
        open_count=open_count,
        resolved_this_week=resolved_this_week,
    )


@router.get("/{feedback_id}", response_model=PortalFeedbackResponse)
async def get_feedback(
    feedback_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,  # TODO: Add admin check
) -> PortalFeedbackResponse:
    """Get a specific feedback item (admin only)."""
    result = await db.execute(
        select(PortalFeedback)
        .options(
            selectinload(PortalFeedback.user),
            selectinload(PortalFeedback.assignee),
        )
        .where(PortalFeedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        raise NotFoundException("Feedback not found")

    return PortalFeedbackResponse(
        **{c.name: getattr(feedback, c.name) for c in feedback.__table__.columns},
        user_name=feedback.user.full_name if feedback.user else None,
        user_email=feedback.user.email if feedback.user else None,
        assignee_name=feedback.assignee.full_name if feedback.assignee else None,
    )


@router.patch("/{feedback_id}", response_model=PortalFeedbackResponse)
async def update_feedback(
    feedback_id: uuid.UUID,
    data: PortalFeedbackUpdate,
    db: DB,
    current_user: CurrentUser,  # TODO: Add admin check
) -> PortalFeedbackResponse:
    """Update feedback status, priority, or assignment (admin only)."""
    result = await db.execute(
        select(PortalFeedback)
        .options(
            selectinload(PortalFeedback.user),
            selectinload(PortalFeedback.assignee),
        )
        .where(PortalFeedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        raise NotFoundException("Feedback not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle status change
    if data.status and data.status != feedback.status:
        if data.status == FeedbackStatus.RESOLVED:
            feedback.resolved_at = datetime.now(UTC)
            feedback.resolved_by = current_user.id
        update_data["status"] = data.status

    # Apply updates
    for field, value in update_data.items():
        if value is not None:
            setattr(feedback, field, value)

    await db.commit()
    await db.refresh(feedback, ["user", "assignee"])

    return PortalFeedbackResponse(
        **{c.name: getattr(feedback, c.name) for c in feedback.__table__.columns},
        user_name=feedback.user.full_name if feedback.user else None,
        user_email=feedback.user.email if feedback.user else None,
        assignee_name=feedback.assignee.full_name if feedback.assignee else None,
    )


@router.post("/{feedback_id}/assign", response_model=PortalFeedbackResponse)
async def assign_feedback(
    feedback_id: uuid.UUID,
    assigned_to: uuid.UUID,
    db: DB,
    current_user: CurrentUser,  # TODO: Add admin check
) -> PortalFeedbackResponse:
    """Assign feedback to a user (admin only)."""
    result = await db.execute(
        select(PortalFeedback)
        .options(
            selectinload(PortalFeedback.user),
            selectinload(PortalFeedback.assignee),
        )
        .where(PortalFeedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        raise NotFoundException("Feedback not found")

    # Verify assignee exists
    assignee_result = await db.execute(select(User).where(User.id == assigned_to))
    assignee = assignee_result.scalar_one_or_none()
    if not assignee:
        raise BadRequestException("Assignee not found")

    feedback.assigned_to = assigned_to
    feedback.status = FeedbackStatus.IN_PROGRESS

    await db.commit()
    await db.refresh(feedback, ["user", "assignee"])

    return PortalFeedbackResponse(
        **{c.name: getattr(feedback, c.name) for c in feedback.__table__.columns},
        user_name=feedback.user.full_name if feedback.user else None,
        user_email=feedback.user.email if feedback.user else None,
        assignee_name=assignee.full_name,
    )


# ==================== Helper Functions ====================


async def send_feedback_confirmation(email: str, feedback: PortalFeedback) -> None:
    """Send confirmation email to user who submitted feedback."""
    type_labels = {
        FeedbackType.BUG_REPORT: "Bug Report",
        FeedbackType.FEATURE_REQUEST: "Feature Request",
        FeedbackType.GENERAL_FEEDBACK: "Feedback",
        FeedbackType.QUESTION: "Question",
    }

    subject = (
        f"AMG Portal - {type_labels.get(feedback.feedback_type, 'Feedback')} Received"
    )

    feedback_type_label = type_labels.get(feedback.feedback_type, "feedback").lower()
    description_preview = feedback.description[:500]
    if len(feedback.description) > 500:
        description_preview += "..."

    body_html = f"""
    <html>
        <body>
            <h2>Thank you for your feedback</h2>
            <p>Dear User,</p>
            <p>We have received your {feedback_type_label}.</p>
            <p><strong>Summary:</strong></p>
            <p>{description_preview}</p>
            <p>Our team will review your submission and may follow up if needed.</p>
            <p>Reference ID: {feedback.id}</p>
            <p>Best regards,<br>AMG Portal Team</p>
        </body>
    </html>
    """

    await send_email(to=email, subject=subject, body_html=body_html)


async def notify_product_team(feedback: PortalFeedback, user: User) -> None:
    """Notify product team about new feedback."""
    # In production, this would send to Slack, Discord, or a dedicated email
    # For now, we just log it
    import logging

    logger = logging.getLogger(__name__)
    description_preview = feedback.description[:100]
    logger.info(
        f"New feedback received: [{feedback.feedback_type}] "
        f"from {user.email} - {description_preview}..."
    )
