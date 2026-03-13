"""Partner portal endpoints (partner-facing views)."""

import csv
import io
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentPartner, CurrentUser
from app.models.communication import Communication
from app.models.conversation import Conversation
from app.models.deliverable import Deliverable
from app.models.partner_assignment import PartnerAssignment
from app.models.partner_rating import PartnerRating
from app.models.user import User
from app.schemas.communication import (
    CommunicationListResponse,
    CommunicationResponse,
    SendMessageRequest,
)
from app.schemas.conversation import ConversationListResponse, ConversationResponse, ParticipantInfo
from app.schemas.deliverable import DeliverableListResponse
from app.schemas.partner import PartnerProfileResponse
from app.schemas.partner_assignment import AssignmentListResponse, AssignmentResponse
from app.schemas.report import (
    ActiveBriefDeliverable,
    ActiveBriefEntry,
    ActiveBriefSummaryReport,
    DeliverableFeedbackEntry,
    DeliverableFeedbackReport,
    EngagementHistoryEntry,
    EngagementHistoryReport,
    EngagementHistoryStats,
    EngagementRating,
)
from app.services.communication_service import communication_service
from app.services.conversation_service import conversation_service
from app.services.storage import storage_service

router = APIRouter()


@router.get("/profile", response_model=PartnerProfileResponse)
async def get_my_profile(
    current_user: CurrentUser,
    partner: CurrentPartner,
):
    return partner


@router.get("/assignments", response_model=AssignmentListResponse)
async def get_my_assignments(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
):
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.partner), selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.partner_id == partner.id)
        .order_by(PartnerAssignment.created_at.desc())
    )
    assignments = result.scalars().all()

    def build_response(a) -> Any:
        return {
            "id": a.id,
            "partner_id": a.partner_id,
            "program_id": a.program_id,
            "assigned_by": a.assigned_by,
            "title": a.title,
            "brief": a.brief,
            "sla_terms": a.sla_terms,
            "status": a.status,
            "due_date": a.due_date,
            "accepted_at": a.accepted_at,
            "completed_at": a.completed_at,
            "created_at": a.created_at,
            "updated_at": a.updated_at,
            "partner_firm_name": a.partner.firm_name if a.partner else None,
            "program_title": a.program.title if a.program else None,
        }

    return AssignmentListResponse(
        assignments=[build_response(a) for a in assignments],
        total=len(assignments),
    )


@router.get("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def get_my_assignment(
    assignment_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
):
    result = await db.execute(
        select(PartnerAssignment)
        .options(
            selectinload(PartnerAssignment.partner),
            selectinload(PartnerAssignment.program),
            selectinload(PartnerAssignment.deliverables),
        )
        .where(PartnerAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.partner_id != partner.id:
        raise HTTPException(status_code=403, detail="Not your assignment")

    return {
        "id": assignment.id,
        "partner_id": assignment.partner_id,
        "program_id": assignment.program_id,
        "assigned_by": assignment.assigned_by,
        "title": assignment.title,
        "brief": assignment.brief,
        "sla_terms": assignment.sla_terms,
        "status": assignment.status,
        "due_date": assignment.due_date,
        "accepted_at": assignment.accepted_at,
        "completed_at": assignment.completed_at,
        "created_at": assignment.created_at,
        "updated_at": assignment.updated_at,
        "partner_firm_name": assignment.partner.firm_name if assignment.partner else None,
        "program_title": assignment.program.title if assignment.program else None,
    }


@router.get("/deliverables", response_model=DeliverableListResponse)
async def get_my_deliverables(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
):
    # Get all assignments for this partner, then all deliverables
    assignments_result = await db.execute(
        select(PartnerAssignment.id).where(PartnerAssignment.partner_id == partner.id)
    )
    assignment_ids = [row[0] for row in assignments_result.all()]

    if not assignment_ids:
        return DeliverableListResponse(deliverables=[], total=0)

    result = await db.execute(
        select(Deliverable)
        .where(Deliverable.assignment_id.in_(assignment_ids))
        .order_by(Deliverable.created_at.desc())
    )
    deliverables = result.scalars().all()

    def build_response(d) -> Any:
        data = {
            "id": d.id,
            "assignment_id": d.assignment_id,
            "title": d.title,
            "deliverable_type": d.deliverable_type,
            "description": d.description,
            "due_date": d.due_date,
            "file_path": d.file_path,
            "file_name": d.file_name,
            "file_size": d.file_size,
            "submitted_at": d.submitted_at,
            "submitted_by": d.submitted_by,
            "status": d.status,
            "review_comments": d.review_comments,
            "reviewed_by": d.reviewed_by,
            "reviewed_at": d.reviewed_at,
            "client_visible": d.client_visible,
            "created_at": d.created_at,
            "updated_at": d.updated_at,
            "download_url": None,
        }
        if d.file_path:
            import contextlib

            with contextlib.suppress(Exception):
                data["download_url"] = storage_service.get_presigned_url(d.file_path)
        return data

    return DeliverableListResponse(
        deliverables=[build_response(d) for d in deliverables],
        total=len(deliverables),
    )


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------


async def _get_partner_assignment_ids(db: DB, partner_id: UUID) -> list[UUID]:
    """Get all assignment IDs for a partner."""
    result = await db.execute(
        select(PartnerAssignment.id).where(PartnerAssignment.partner_id == partner_id)
    )
    return [row[0] for row in result.all()]


async def _verify_partner_conversation_access(
    db: DB,
    conversation_id: UUID,
    user_id: UUID,
    partner_id: UUID,
) -> Conversation:
    """Verify the partner has access to a conversation and return it."""
    conversation = await conversation_service.get(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Partner can access if they are a participant
    if user_id in conversation.participant_ids:
        return conversation

    # Or if the conversation is linked to one of their assignments
    if conversation.partner_assignment_id:
        assignment_ids = await _get_partner_assignment_ids(db, partner_id)
        if conversation.partner_assignment_id in assignment_ids:
            return conversation

    raise HTTPException(status_code=403, detail="Not a participant in this conversation")


async def _build_conversation_response(
    db: DB,
    conversation: Conversation,
    user_id: UUID,
) -> ConversationResponse:
    """Build a ConversationResponse with unread_count and participant info."""
    # Compute unread count: messages the partner hasn't read
    unread_result = await db.execute(
        select(func.count())
        .select_from(Communication)
        .where(
            Communication.conversation_id == conversation.id,
            Communication.sender_id != user_id,
        )
    )
    total_from_others = unread_result.scalar_one() or 0

    # Count how many of those the user has read
    read_result = await db.execute(
        select(Communication)
        .where(
            Communication.conversation_id == conversation.id,
            Communication.sender_id != user_id,
        )
    )
    others_msgs = read_result.scalars().all()
    read_count = sum(
        1
        for m in others_msgs
        if m.read_receipts and str(user_id) in m.read_receipts
    )
    unread_count = total_from_others - read_count

    # Resolve participant names
    participants: list[ParticipantInfo] = []
    if conversation.participant_ids:
        user_result = await db.execute(
            select(User).where(User.id.in_(conversation.participant_ids))
        )
        users = user_result.scalars().all()
        participants = [
            ParticipantInfo(id=u.id, full_name=u.full_name, role=u.role)
            for u in users
        ]

    return ConversationResponse(
        id=conversation.id,
        conversation_type=conversation.conversation_type,
        client_id=conversation.client_id,
        partner_assignment_id=conversation.partner_assignment_id,
        title=conversation.title,
        participant_ids=conversation.participant_ids,
        last_activity_at=conversation.last_activity_at,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        unread_count=max(unread_count, 0),
        participants=participants,
    )


@router.get("/conversations", response_model=ConversationListResponse)
async def get_my_conversations(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    limit: int = Query(50, ge=1, le=100),
):
    """List conversations the partner is part of."""
    assignment_ids = await _get_partner_assignment_ids(db, partner.id)

    # Conversations where the partner's user_id is in participant_ids
    # OR linked to one of the partner's assignments
    filters = [Conversation.participant_ids.contains([current_user.id])]
    if assignment_ids:
        filters.append(Conversation.partner_assignment_id.in_(assignment_ids))

    result = await db.execute(
        select(Conversation)
        .where(or_(*filters))
        .order_by(Conversation.last_activity_at.desc().nulls_last())
        .limit(limit)
    )
    conversations = result.scalars().all()

    response_items = [
        await _build_conversation_response(db, c, current_user.id)
        for c in conversations
    ]

    return ConversationListResponse(conversations=response_items, total=len(response_items))


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_my_conversation(
    conversation_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
):
    """Get a single conversation the partner is part of."""
    conversation = await _verify_partner_conversation_access(
        db, conversation_id, current_user.id, partner.id
    )
    return await _build_conversation_response(db, conversation, current_user.id)


@router.get("/conversations/{conversation_id}/messages", response_model=CommunicationListResponse)
async def get_my_conversation_messages(
    conversation_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
):
    """Get paginated messages for a conversation the partner is part of."""
    await _verify_partner_conversation_access(
        db, conversation_id, current_user.id, partner.id
    )

    count_result = await db.execute(
        select(func.count())
        .select_from(Communication)
        .where(Communication.conversation_id == conversation_id)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Communication)
        .options(selectinload(Communication.sender))
        .where(Communication.conversation_id == conversation_id)
        .order_by(Communication.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    messages = result.scalars().all()

    comm_responses = [
        CommunicationResponse(
            id=m.id,
            conversation_id=m.conversation_id,
            channel=m.channel,
            status=m.status,
            sender_id=m.sender_id,
            sender_name=m.sender.full_name if m.sender else None,
            recipients=m.recipients,
            subject=m.subject,
            body=m.body,
            attachment_ids=m.attachment_ids,
            client_id=m.client_id,
            program_id=m.program_id,
            partner_id=m.partner_id,
            read_receipts=m.read_receipts,
            sent_at=m.sent_at,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m in messages
    ]

    return CommunicationListResponse(communications=comm_responses, total=total)


@router.post("/conversations/{conversation_id}/messages", response_model=CommunicationResponse)
async def send_message_to_conversation(
    conversation_id: UUID,
    data: SendMessageRequest,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
):
    """Send a message to a conversation the partner is part of."""
    conversation = await _verify_partner_conversation_access(
        db, conversation_id, current_user.id, partner.id
    )

    # Ensure the partner is in participant_ids (they might only be linked via assignment)
    if current_user.id not in conversation.participant_ids:
        await conversation_service.add_participant(db, conversation_id, current_user.id)

    data.conversation_id = conversation_id
    message = await communication_service.send_message(db, sender_id=current_user.id, data=data)

    return CommunicationResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        channel=message.channel,
        status=message.status,
        sender_id=message.sender_id,
        sender_name=current_user.full_name,
        recipients=message.recipients,
        subject=message.subject,
        body=message.body,
        attachment_ids=message.attachment_ids,
        client_id=message.client_id,
        program_id=message.program_id,
        partner_id=message.partner_id,
        read_receipts=message.read_receipts,
        sent_at=message.sent_at,
        created_at=message.created_at,
        updated_at=message.updated_at,
    )


@router.post("/conversations/{conversation_id}/mark-read", status_code=204)
async def mark_my_conversation_read(
    conversation_id: UUID,
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
):
    """Mark all messages in a conversation as read for this partner."""
    await _verify_partner_conversation_access(
        db, conversation_id, current_user.id, partner.id
    )
    await conversation_service.mark_conversation_read(db, conversation_id, current_user.id)


# ---------------------------------------------------------------------------
# Class C Partner Reports
# ---------------------------------------------------------------------------

ACTIVE_STATUSES = ("dispatched", "accepted", "in_progress")


@router.get("/reports/active-brief", response_model=ActiveBriefSummaryReport)
async def get_active_brief_summary(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
):
    """Active Brief Summary — current assignments with deliverable details."""
    result = await db.execute(
        select(PartnerAssignment)
        .options(
            selectinload(PartnerAssignment.program),
            selectinload(PartnerAssignment.deliverables),
        )
        .where(
            PartnerAssignment.partner_id == partner.id,
            PartnerAssignment.status.in_(ACTIVE_STATUSES),
        )
        .order_by(PartnerAssignment.due_date.asc().nulls_last())
    )
    assignments = result.scalars().all()

    total_deliverables = 0
    pending_deliverables = 0
    entries: list[ActiveBriefEntry] = []

    for a in assignments:
        delivs = [
            ActiveBriefDeliverable(
                id=d.id,
                title=d.title,
                deliverable_type=d.deliverable_type,
                description=d.description,
                due_date=d.due_date,
                status=d.status,
            )
            for d in (a.deliverables or [])
        ]
        total_deliverables += len(delivs)
        pending_deliverables += sum(1 for d in delivs if d.status in ("pending", "returned"))
        entries.append(
            ActiveBriefEntry(
                id=a.id,
                title=a.title,
                brief=a.brief,
                sla_terms=a.sla_terms,
                status=a.status,
                due_date=a.due_date,
                program_title=a.program.title if a.program else None,
                accepted_at=a.accepted_at,
                created_at=a.created_at,
                deliverables=delivs,
            )
        )

    return ActiveBriefSummaryReport(
        assignments=entries,
        total_assignments=len(entries),
        total_deliverables=total_deliverables,
        pending_deliverables=pending_deliverables,
    )


@router.get("/reports/deliverable-feedback", response_model=DeliverableFeedbackReport)
async def get_deliverable_feedback_report(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    assignment_id: UUID | None = Query(None, description="Filter by assignment"),
):
    """Deliverable Feedback Report — all deliverables with review comments and status."""
    query = (
        select(Deliverable)
        .join(PartnerAssignment, Deliverable.assignment_id == PartnerAssignment.id)
        .options(
            selectinload(Deliverable.reviewer),
            selectinload(Deliverable.assignment),
        )
        .where(PartnerAssignment.partner_id == partner.id)
        .order_by(Deliverable.created_at.desc())
    )
    if assignment_id is not None:
        query = query.where(Deliverable.assignment_id == assignment_id)

    result = await db.execute(query)
    deliverables = result.scalars().all()

    entries: list[DeliverableFeedbackEntry] = []
    reviewed_count = 0
    pending_count = 0
    approved_count = 0
    returned_count = 0

    for d in deliverables:
        if d.reviewed_at is not None:
            reviewed_count += 1
        if d.status == "pending":
            pending_count += 1
        elif d.status == "approved":
            approved_count += 1
        elif d.status == "returned":
            returned_count += 1

        entries.append(
            DeliverableFeedbackEntry(
                id=d.id,
                assignment_id=d.assignment_id,
                assignment_title=d.assignment.title if d.assignment else "",
                title=d.title,
                deliverable_type=d.deliverable_type,
                status=d.status,
                due_date=d.due_date,
                submitted_at=d.submitted_at,
                review_comments=d.review_comments,
                reviewer_name=d.reviewer.full_name if d.reviewer else None,
                reviewed_at=d.reviewed_at,
            )
        )

    return DeliverableFeedbackReport(
        deliverables=entries,
        total=len(entries),
        reviewed_count=reviewed_count,
        pending_count=pending_count,
        approved_count=approved_count,
        returned_count=returned_count,
    )


@router.get("/reports/deliverable-feedback/export")
async def export_deliverable_feedback_csv(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    assignment_id: UUID | None = Query(None, description="Filter by assignment"),
):
    """Export deliverable feedback report as CSV."""
    report = await get_deliverable_feedback_report(db, current_user, partner, assignment_id)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Deliverable Feedback Report"])
    writer.writerow([f"Generated: {report.generated_at.isoformat()}"])
    writer.writerow([])
    writer.writerow([
        "Assignment",
        "Deliverable",
        "Type",
        "Status",
        "Due Date",
        "Submitted At",
        "Reviewer",
        "Reviewed At",
        "Review Comments",
    ])
    for d in report.deliverables:
        writer.writerow([
            d.assignment_title,
            d.title,
            d.deliverable_type,
            d.status,
            str(d.due_date) if d.due_date else "N/A",
            d.submitted_at.isoformat() if d.submitted_at else "N/A",
            d.reviewer_name or "N/A",
            d.reviewed_at.isoformat() if d.reviewed_at else "N/A",
            d.review_comments or "",
        ])

    output.seek(0)
    filename = f"deliverable_feedback_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/reports/engagement-history", response_model=EngagementHistoryReport)
async def get_engagement_history_report(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
):
    """Engagement History — all assignments with completion data and ratings."""
    result = await db.execute(
        select(PartnerAssignment)
        .options(selectinload(PartnerAssignment.program))
        .where(PartnerAssignment.partner_id == partner.id)
        .order_by(PartnerAssignment.completed_at.desc().nulls_last())
    )
    assignments = result.scalars().all()

    # Fetch ratings for this partner keyed by program_id
    ratings_result = await db.execute(
        select(PartnerRating).where(PartnerRating.partner_id == partner.id)
    )
    ratings_by_program: dict[UUID, PartnerRating] = {
        r.program_id: r for r in ratings_result.scalars().all()
    }

    entries: list[EngagementHistoryEntry] = []
    completed_count = 0
    quality_scores: list[int] = []
    timeliness_scores: list[int] = []
    communication_scores: list[int] = []
    overall_scores: list[int] = []

    for a in assignments:
        rating_model = ratings_by_program.get(a.program_id)
        rating = None
        if rating_model:
            rating = EngagementRating(
                quality_score=rating_model.quality_score,
                timeliness_score=rating_model.timeliness_score,
                communication_score=rating_model.communication_score,
                overall_score=rating_model.overall_score,
            )
            quality_scores.append(rating_model.quality_score)
            timeliness_scores.append(rating_model.timeliness_score)
            communication_scores.append(rating_model.communication_score)
            overall_scores.append(rating_model.overall_score)

        if a.status == "completed":
            completed_count += 1

        entries.append(
            EngagementHistoryEntry(
                id=a.id,
                title=a.title,
                program_title=a.program.title if a.program else None,
                status=a.status,
                due_date=a.due_date,
                accepted_at=a.accepted_at,
                completed_at=a.completed_at,
                created_at=a.created_at,
                rating=rating,
            )
        )

    total = len(entries)
    def _avg(scores: list[int]) -> float | None:
        return round(sum(scores) / len(scores), 2) if scores else None

    stats = EngagementHistoryStats(
        total_engagements=total,
        completed_engagements=completed_count,
        completion_rate=(
            round(completed_count / total * 100, 1) if total > 0 else 0.0
        ),
        average_quality=_avg(quality_scores),
        average_timeliness=_avg(timeliness_scores),
        average_communication=_avg(communication_scores),
        average_overall=_avg(overall_scores),
    )

    return EngagementHistoryReport(engagements=entries, stats=stats)


@router.get("/reports/engagement-history/export")
async def export_engagement_history_csv(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
):
    """Export engagement history report as CSV."""
    report = await get_engagement_history_report(db, current_user, partner)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Engagement History Report"])
    writer.writerow([f"Generated: {report.generated_at.isoformat()}"])
    writer.writerow([])

    # Stats
    writer.writerow(["Summary"])
    writer.writerow(["Total Engagements", report.stats.total_engagements])
    writer.writerow(["Completed", report.stats.completed_engagements])
    writer.writerow(["Completion Rate", f"{report.stats.completion_rate}%"])
    writer.writerow(["Avg Quality", report.stats.average_quality or "N/A"])
    writer.writerow(["Avg Timeliness", report.stats.average_timeliness or "N/A"])
    writer.writerow(["Avg Communication", report.stats.average_communication or "N/A"])
    writer.writerow(["Avg Overall", report.stats.average_overall or "N/A"])
    writer.writerow([])

    writer.writerow([
        "Assignment",
        "Program",
        "Status",
        "Due Date",
        "Accepted At",
        "Completed At",
        "Quality",
        "Timeliness",
        "Communication",
        "Overall",
    ])
    for e in report.engagements:
        writer.writerow([
            e.title,
            e.program_title or "N/A",
            e.status,
            str(e.due_date) if e.due_date else "N/A",
            e.accepted_at.isoformat() if e.accepted_at else "N/A",
            e.completed_at.isoformat() if e.completed_at else "N/A",
            e.rating.quality_score if e.rating else "N/A",
            e.rating.timeliness_score if e.rating else "N/A",
            e.rating.communication_score if e.rating else "N/A",
            e.rating.overall_score if e.rating else "N/A",
        ])

    output.seek(0)
    filename = f"engagement_history_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
