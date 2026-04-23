"""Partner portal endpoints (partner-facing views)."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.deps import DB, CurrentPartner, CurrentUser, RLSContext, require_partner
from app.api.v1.partner_portal_assignments import router as partner_portal_assignments_router
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.conversation import Conversation
from app.models.user import User
from app.schemas.communication import CommunicationResponse, SendMessageRequest
from app.schemas.conversation import (
    ConversationListResponse,
    ConversationResponse,
    MessageListResponse,
    ParticipantInfo,
)
from app.schemas.partner import (
    CapabilityRefreshRequest,
    CapabilityRefreshStatusResponse,
    PartnerProfileResponse,
)
from app.schemas.report import (
    PartnerBriefSummaryReport,
    PartnerDeliverableFeedbackReport,
    PartnerEngagementHistoryReport,
)
from app.services.communication_service import communication_service
from app.services.conversation_service import MessageScopeError, conversation_service
from app.services.partner_scorecard_service import get_partner_scorecard as _get_scorecard
from app.services.partner_trends_service import get_partner_trends
from app.services.report_service import partner_report_service

logger = logging.getLogger(__name__)

router = APIRouter()
router.include_router(partner_portal_assignments_router)


@router.get("/profile", response_model=PartnerProfileResponse)
async def get_my_profile(
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> Any:
    return partner


# ============================================================================
# Partner Reports (Class C)
# ============================================================================


@router.get("/reports/brief-summary", response_model=PartnerBriefSummaryReport)
async def get_brief_summary_report(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> Any:
    """Active brief summary — active assignments with tasks, deadlines, and coordinator contact.

    Scoped to the current partner only. No client metadata or budget info is included.
    """
    report = await partner_report_service.get_brief_summary(db, partner.id)
    if not report:
        raise NotFoundException("Partner profile not found")
    return report


@router.get("/reports/deliverable-feedback", response_model=PartnerDeliverableFeedbackReport)
async def get_deliverable_feedback_report(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    assignment_id: UUID | None = Query(None, description="Filter by assignment ID"),
) -> Any:
    """Deliverable feedback report — history of all submissions with review status and comments.

    Optionally filter by a specific assignment via the `assignment_id` query parameter.
    """
    report = await partner_report_service.get_deliverable_feedback(db, partner.id, assignment_id)
    if not report:
        raise NotFoundException("Partner profile not found")
    return report


@router.get("/reports/engagement-history", response_model=PartnerEngagementHistoryReport)
async def get_engagement_history_report(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> Any:
    """Engagement history — all past engagements with completion status and deliverable count."""
    report = await partner_report_service.get_engagement_history(db, partner.id)
    if not report:
        raise NotFoundException("Partner profile not found")
    return report


# ============================================================================
# Annual Capability Refresh (partner self-service)
# ============================================================================


def _compute_refresh_status(partner: Any) -> dict[str, Any]:  # noqa: ANN401
    """Compute whether a partner's annual capability refresh is overdue or due soon."""
    now = datetime.now(UTC)
    refresh_due_at = partner.refresh_due_at
    last_refreshed_at = partner.last_refreshed_at

    # If never refreshed: overdue if partner was created more than 365 days ago
    if refresh_due_at is None:
        created_at = partner.created_at
        if created_at is None:
            is_overdue = False
        else:
            # Make created_at timezone-aware if naive
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=UTC)
            is_overdue = (now - created_at).days >= 365
        return {
            "last_refreshed_at": last_refreshed_at,
            "refresh_due_at": None,
            "is_overdue": is_overdue,
            "is_due_soon": False,
            "days_until_due": None,
        }

    # Make refresh_due_at timezone-aware if naive
    if refresh_due_at.tzinfo is None:
        refresh_due_at = refresh_due_at.replace(tzinfo=UTC)

    delta = (refresh_due_at - now).days
    is_overdue = refresh_due_at < now
    is_due_soon = not is_overdue and delta <= 30

    return {
        "last_refreshed_at": last_refreshed_at,
        "refresh_due_at": refresh_due_at,
        "is_overdue": is_overdue,
        "is_due_soon": is_due_soon,
        "days_until_due": max(0, delta) if not is_overdue else None,
    }


@router.get("/capability-refresh/status", response_model=CapabilityRefreshStatusResponse)
async def get_capability_refresh_status(
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> CapabilityRefreshStatusResponse:
    """Get the annual capability refresh status for the current partner."""
    return CapabilityRefreshStatusResponse(**_compute_refresh_status(partner))


@router.post("/capability-refresh", response_model=PartnerProfileResponse)
async def submit_capability_refresh(
    data: CapabilityRefreshRequest,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> Any:
    """Submit an annual capability refresh.

    The partner confirms their current accreditations, insurance, and capacity.
    Records last_refreshed_at and sets refresh_due_at to 12 months from now.
    """
    if not data.accreditations_confirmed:
        raise BadRequestException("Accreditations must be confirmed to complete the refresh.")
    if not data.insurance_confirmed:
        raise BadRequestException("Insurance must be confirmed to complete the refresh.")
    if not data.capacity_confirmed:
        raise BadRequestException("Capacity must be confirmed to complete the refresh.")

    now = datetime.now(UTC)
    partner.last_refreshed_at = now
    partner.refresh_due_at = now + timedelta(days=365)

    await db.commit()
    await db.refresh(partner)
    return partner


@router.get("/trends")
async def get_my_trends(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    days: int = Query(90, ge=7, le=365, description="Number of days of history to return"),
) -> dict[str, Any]:
    """Return weekly performance trend data for the current partner.

    Partners can view their own SLA compliance, quality scores, and assignment
    completion trends for self-assessment.
    """
    import uuid as _uuid

    trends = await get_partner_trends(db, _uuid.UUID(str(partner.id)), days=days)
    if trends is None:
        raise NotFoundException("Partner profile not found")

    return {
        "partner_id": trends.partner_id,
        "firm_name": trends.firm_name,
        "days": trends.days,
        "summary": trends.summary,
        "data_points": [
            {
                "week_start": dp.week_start,
                "sla_compliance_pct": dp.sla_compliance_pct,
                "avg_quality": dp.avg_quality,
                "avg_timeliness": dp.avg_timeliness,
                "avg_communication": dp.avg_communication,
                "avg_overall": dp.avg_overall,
                "completion_rate": dp.completion_rate,
                "sla_total": dp.sla_total,
                "sla_breached": dp.sla_breached,
                "ratings_count": dp.ratings_count,
                "assignments_completed": dp.assignments_completed,
            }
            for dp in trends.data_points
        ],
        "annotations": [
            {
                "date": ann.date,
                "event_type": ann.event_type,
                "label": ann.label,
                "severity": ann.severity,
            }
            for ann in trends.annotations
        ],
    }


# ============================================================================
# Partner Scorecard (partner self-view)
# ============================================================================


@router.get("/scorecard")
async def get_my_scorecard(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    period: str = Query(
        "90d",
        description="Time period: '30d', '90d', or 'ytd'",
        pattern="^(30d|90d|ytd)$",
    ),
) -> dict[str, Any]:
    """Return the performance scorecard for the current partner.

    Includes SLA compliance, quality ratings, response times, on-time delivery,
    client satisfaction, composite score, weekly trends, and platform averages.
    Period options: 30d (last 30 days), 90d (last 90 days), ytd (year to date).
    """
    import uuid as _uuid

    scorecard = await _get_scorecard(db, _uuid.UUID(str(partner.id)), period=period)
    if scorecard is None:
        raise NotFoundException("Partner profile not found")
    return scorecard


# ============================================================================
# Performance Status vs Thresholds (partner self-view)
# ============================================================================


@router.get("/performance-status")
async def get_my_performance_status(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> dict[str, Any]:
    """Return the current partner's performance metrics compared to thresholds.

    Includes current values for SLA compliance, quality score, and overall score,
    alongside configurable thresholds and improvement suggestions for metrics
    that are below threshold or showing a declining trend.
    """
    import uuid as _uuid  # noqa: PLC0415

    from app.services.partner_alert_service import get_partner_performance_status

    status = await get_partner_performance_status(db, _uuid.UUID(str(partner.id)))
    if status is None:
        raise NotFoundException("Partner profile not found")

    return {
        "partner_id": status.partner_id,
        "firm_name": status.firm_name,
        "overall_status": status.overall_status,
        "metrics": status.metrics,
        "thresholds": status.thresholds,
        "alerts": [
            {
                "metric": a.metric,
                "label": a.label,
                "current_value": a.current_value,
                "threshold": a.threshold,
                "status": a.status,
                "trend": a.trend,
                "suggestion": a.suggestion,
            }
            for a in status.alerts
        ],
    }


# ============================================================================
# Partner Conversations / Messages
# ============================================================================


async def _resolve_partner_participants(
    db: DB,
    conversations: list[Conversation],
) -> dict[str, list[ParticipantInfo]]:
    """Resolve participant_ids to ParticipantInfo for a batch of conversations."""
    all_ids: set[UUID] = set()
    for conv in conversations:
        all_ids.update(conv.participant_ids)
    if not all_ids:
        return {}

    result = await db.execute(
        select(User.id, User.full_name, User.role).where(User.id.in_(all_ids))
    )
    user_map: dict[UUID, ParticipantInfo] = {}
    for row in result.all():
        user_map[row.id] = ParticipantInfo(
            id=row.id,
            full_name=row.full_name,
            role=row.role,
        )

    out: dict[str, list[ParticipantInfo]] = {}
    for conv in conversations:
        out[str(conv.id)] = [user_map[pid] for pid in conv.participant_ids if pid in user_map]
    return out


@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    dependencies=[Depends(require_partner)],
)
async def get_partner_conversations(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    limit: int = Query(50, ge=1, le=100),
) -> ConversationListResponse:
    """List conversations where the current partner user is a participant."""
    conversations, total = await conversation_service.get_conversations_for_user(
        db,
        user_id=current_user.id,
        user_role=current_user.role,
        skip=0,
        limit=limit,
    )

    participants_map = await _resolve_partner_participants(db, conversations)

    conv_ids = [c.id for c in conversations]
    unread_counts = await communication_service.get_unread_counts_for_conversations(
        db,
        conv_ids,
        current_user.id,
    )

    conv_responses: list[ConversationResponse] = []
    for conv in conversations:
        resp = ConversationResponse.model_validate(conv)
        resp.unread_count = unread_counts.get(str(conv.id), 0)
        resp.participants = participants_map.get(str(conv.id), [])
        conv_responses.append(resp)

    return ConversationListResponse(conversations=conv_responses, total=total)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
    dependencies=[Depends(require_partner)],
)
async def get_partner_conversation(
    conversation_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> ConversationResponse:
    """Get a specific conversation for the partner user."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    if current_user.id not in conversation.participant_ids:
        raise ForbiddenException("Not a participant in this conversation")

    participants_map = await _resolve_partner_participants(db, [conversation])
    resp = ConversationResponse.model_validate(conversation)
    resp.participants = participants_map.get(str(conversation.id), [])
    unread_counts = await communication_service.get_unread_counts_for_conversations(
        db,
        [conversation.id],
        current_user.id,
    )
    resp.unread_count = unread_counts.get(str(conversation.id), 0)
    return resp


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
    dependencies=[Depends(require_partner)],
)
async def get_partner_conversation_messages(
    conversation_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> MessageListResponse:
    """Get messages for a partner conversation."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    if current_user.id not in conversation.participant_ids:
        raise ForbiddenException("Not a participant in this conversation")

    messages, total = await communication_service.get_messages_for_conversation(
        db,
        conversation_id,
        current_user.id,
        skip=skip,
        limit=limit,
    )
    return MessageListResponse(
        communications=[CommunicationResponse.model_validate(m) for m in messages],
        total=total,
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=CommunicationResponse,
    dependencies=[Depends(require_partner)],
)
async def send_partner_message(
    conversation_id: UUID,
    data: SendMessageRequest,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> CommunicationResponse:
    """Send a message in a partner conversation."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    try:
        await conversation_service.validate_message_scope(
            db,
            conversation_id,
            current_user.id,
        )
    except MessageScopeError as exc:
        raise ForbiddenException(exc.detail) from exc

    data.conversation_id = conversation_id
    message = await communication_service.send_message(
        db,
        sender_id=current_user.id,
        data=data,
    )
    return CommunicationResponse.model_validate(message)


@router.post(
    "/conversations/{conversation_id}/mark-read",
    status_code=204,
    dependencies=[Depends(require_partner)],
)
async def mark_partner_conversation_read(
    conversation_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> None:
    """Mark all messages in a conversation as read for the partner."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise NotFoundException("Conversation not found")

    if current_user.id not in conversation.participant_ids:
        raise ForbiddenException("Not a participant in this conversation")

    await communication_service.mark_messages_read(db, conversation_id, current_user.id)
