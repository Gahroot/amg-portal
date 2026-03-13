"""Client portal endpoints (client-facing, read-only + decision responses)."""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, RoleChecker
from app.models.client import Client
from app.models.client_profile import ClientProfile
from app.models.communication import Communication
from app.models.decision_request import DecisionRequest
from app.models.deliverable import Deliverable
from app.models.enums import UserRole
from app.models.milestone import Milestone
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.schemas.client_profile import ClientPortalProfileResponse
from app.schemas.portal import (
    CLIENT_VISIBLE_INTELLIGENCE_KEYS,
    COMMUNICATION_PREFERENCES,
    PortalCommunicationListResponse,
    PortalCommunicationResponse,
    PortalDecisionListResponse,
    PortalDecisionRespondRequest,
    PortalDecisionResponse,
    PortalDeliverableResponse,
    PortalIntelligenceResponse,
    PortalIntelligenceUpdate,
    PortalMilestoneResponse,
    PortalProfilePreferencesResponse,
    PortalProfilePreferencesUpdate,
    PortalProgramDetailResponse,
    PortalProgramListResponse,
    PortalProgramResponse,
)
from app.services.client_service import client_service
from app.services.decision_service import decision_service

require_client = RoleChecker([UserRole.client])

router = APIRouter()


def _compute_rag_status(milestones: list[Milestone]) -> str:
    """Compute RAG status from milestones."""
    today = date.today()
    for m in milestones:
        if m.status != "completed" and m.due_date and m.due_date < today:
            return "red"
    for m in milestones:
        if m.status != "completed" and m.due_date and m.due_date <= today + timedelta(days=7):
            return "amber"
    return "green"


async def _get_client_profile(db: DB, user_id: uuid.UUID) -> ClientProfile:
    """Get the ClientProfile for the current logged-in client user."""
    result = await db.execute(select(ClientProfile).where(ClientProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client profile not found"
        )
    return profile


async def _get_client_id(db: DB, profile: ClientProfile) -> uuid.UUID:
    """Resolve the Client (programs table FK) from a ClientProfile.

    Links by matching the ClientProfile.primary_email to Client name,
    or by finding a Client whose rm_id matches the profile's assigned_rm_id.
    Falls back to name matching.
    """
    # Try matching by legal_name -> Client.name
    result = await db.execute(select(Client).where(Client.name == profile.legal_name))
    client = result.scalar_one_or_none()
    if client:
        return client.id

    # Try matching by display_name -> Client.name
    if profile.display_name:
        result = await db.execute(select(Client).where(Client.name == profile.display_name))
        client = result.scalar_one_or_none()
        if client:
            return client.id

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="No linked client record found"
    )


@router.get(
    "/profile",
    response_model=ClientPortalProfileResponse,
    dependencies=[Depends(require_client)],
)
async def get_my_profile(
    db: DB,
    current_user: CurrentUser,
) -> ClientPortalProfileResponse:
    profile = await client_service.get_client_dashboard_data(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile found")
    return profile  # type: ignore[return-value]


# --- Programs ---


@router.get(
    "/programs",
    response_model=PortalProgramListResponse,
    dependencies=[Depends(require_client)],
)
async def get_my_programs(
    db: DB,
    current_user: CurrentUser,
) -> PortalProgramListResponse:
    """List all programs belonging to the client, with milestone progress."""
    profile = await _get_client_profile(db, current_user.id)
    client_id = await _get_client_id(db, profile)

    query = (
        select(Program)
        .options(selectinload(Program.milestones))
        .where(Program.client_id == client_id)
        .order_by(Program.created_at.desc())
    )
    count_query = select(func.count()).select_from(Program).where(Program.client_id == client_id)

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(query)
    programs = result.scalars().unique().all()

    items: list[PortalProgramResponse] = []
    for p in programs:
        milestones = p.milestones or []
        milestone_count = len(milestones)
        completed = sum(1 for m in milestones if m.status == "completed")
        items.append(
            PortalProgramResponse(
                id=p.id,
                title=p.title,
                objectives=p.objectives,
                scope=p.scope,
                start_date=p.start_date,
                end_date=p.end_date,
                status=p.status,
                rag_status=_compute_rag_status(milestones),
                milestone_count=milestone_count,
                completed_milestone_count=completed,
                created_at=p.created_at,
            )
        )

    return PortalProgramListResponse(programs=items, total=total)


@router.get(
    "/programs/{program_id}",
    response_model=PortalProgramDetailResponse,
    dependencies=[Depends(require_client)],
)
async def get_my_program_detail(
    program_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> PortalProgramDetailResponse:
    """Get a single program with milestones and client-visible deliverables."""
    profile = await _get_client_profile(db, current_user.id)
    client_id = await _get_client_id(db, profile)

    result = await db.execute(
        select(Program)
        .options(selectinload(Program.milestones))
        .where(Program.id == program_id, Program.client_id == client_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    milestones = program.milestones or []
    milestone_count = len(milestones)
    completed = sum(1 for m in milestones if m.status == "completed")

    milestone_items = [
        PortalMilestoneResponse(
            id=m.id,
            title=m.title,
            description=m.description,
            due_date=m.due_date,
            status=m.status,
            position=m.position,
        )
        for m in sorted(milestones, key=lambda m: m.position)
    ]

    # Fetch client-visible deliverables via partner assignments on this program
    deliverable_result = await db.execute(
        select(Deliverable)
        .join(PartnerAssignment, Deliverable.assignment_id == PartnerAssignment.id)
        .where(
            PartnerAssignment.program_id == program_id,
            Deliverable.client_visible.is_(True),
        )
        .order_by(Deliverable.created_at.desc())
    )
    deliverables = deliverable_result.scalars().all()
    deliverable_items = [
        PortalDeliverableResponse.model_validate(d)
        for d in deliverables
    ]

    return PortalProgramDetailResponse(
        id=program.id,
        title=program.title,
        objectives=program.objectives,
        scope=program.scope,
        start_date=program.start_date,
        end_date=program.end_date,
        status=program.status,
        rag_status=_compute_rag_status(milestones),
        milestone_count=milestone_count,
        completed_milestone_count=completed,
        milestones=milestone_items,
        deliverables=deliverable_items,
        created_at=program.created_at,
    )


# --- Communications ---


@router.get(
    "/communications",
    response_model=PortalCommunicationListResponse,
    dependencies=[Depends(require_client)],
)
async def get_my_communications(
    db: DB,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> PortalCommunicationListResponse:
    """List communications addressed to the client."""
    profile = await _get_client_profile(db, current_user.id)

    query = (
        select(Communication)
        .where(Communication.client_id == profile.id)
        .order_by(Communication.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    count_query = (
        select(func.count())
        .select_from(Communication)
        .where(Communication.client_id == profile.id)
    )

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(query)
    comms = result.scalars().all()

    items = [
        PortalCommunicationResponse(
            id=c.id,
            channel=c.channel,
            subject=c.subject,
            body=c.body,
            sent_at=c.sent_at,
            created_at=c.created_at,
        )
        for c in comms
    ]

    return PortalCommunicationListResponse(communications=items, total=total)


# --- Decisions ---


@router.get(
    "/decisions",
    response_model=PortalDecisionListResponse,
    dependencies=[Depends(require_client)],
)
async def get_my_decisions(
    db: DB,
    current_user: CurrentUser,
    decision_status: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> PortalDecisionListResponse:
    """List decision requests for the client, optionally filtered by status."""
    profile = await _get_client_profile(db, current_user.id)

    query = select(DecisionRequest).where(DecisionRequest.client_id == profile.id)
    count_query = (
        select(func.count())
        .select_from(DecisionRequest)
        .where(DecisionRequest.client_id == profile.id)
    )

    if decision_status:
        query = query.where(DecisionRequest.status == decision_status)
        count_query = count_query.where(DecisionRequest.status == decision_status)

    query = query.order_by(DecisionRequest.created_at.desc()).offset(skip).limit(limit)

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(query)
    decisions = result.scalars().all()

    items = [
        PortalDecisionResponse(
            id=d.id,
            program_id=d.program_id,
            title=d.title,
            prompt=d.prompt,
            response_type=d.response_type,
            options=d.options,
            deadline_date=d.deadline_date,
            deadline_time=d.deadline_time,
            consequence_text=d.consequence_text,
            status=d.status,
            response=d.response,
            responded_at=d.responded_at,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in decisions
    ]

    return PortalDecisionListResponse(decisions=items, total=total)


@router.post(
    "/decisions/{decision_id}/respond",
    response_model=PortalDecisionResponse,
    dependencies=[Depends(require_client)],
)
async def respond_to_decision(
    decision_id: uuid.UUID,
    data: PortalDecisionRespondRequest,
    db: DB,
    current_user: CurrentUser,
) -> PortalDecisionResponse:
    """Submit a response to a pending decision request."""
    profile = await _get_client_profile(db, current_user.id)

    # Fetch and verify ownership
    result = await db.execute(
        select(DecisionRequest).where(
            DecisionRequest.id == decision_id,
            DecisionRequest.client_id == profile.id,
        )
    )
    decision = result.scalar_one_or_none()
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Decision request not found"
        )

    if decision.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Decision is not pending"
        )

    from app.schemas.decision_request import DecisionSubmitResponse

    submit_data = DecisionSubmitResponse(
        option_id=data.response.option_id,
        text=data.response.text,
    )
    updated = await decision_service.submit_response(db, decision, submit_data, current_user.id)

    return PortalDecisionResponse(
        id=updated.id,
        program_id=updated.program_id,
        title=updated.title,
        prompt=updated.prompt,
        response_type=updated.response_type,
        options=updated.options,
        deadline_date=updated.deadline_date,
        deadline_time=updated.deadline_time,
        consequence_text=updated.consequence_text,
        status=updated.status,
        response=updated.response,
        responded_at=updated.responded_at,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


# --- Profile Preferences ---


@router.get(
    "/profile-preferences",
    response_model=PortalProfilePreferencesResponse,
    dependencies=[Depends(require_client)],
)
async def get_profile_preferences(
    db: DB,
    current_user: CurrentUser,
) -> PortalProfilePreferencesResponse:
    """Get client's communication preference, sensitivities, and special instructions."""
    profile = await _get_client_profile(db, current_user.id)
    return PortalProfilePreferencesResponse(
        communication_preference=profile.communication_preference,
        sensitivities=profile.sensitivities,
        special_instructions=profile.special_instructions,
    )


@router.patch(
    "/profile-preferences",
    response_model=PortalProfilePreferencesResponse,
    dependencies=[Depends(require_client)],
)
async def update_profile_preferences(
    body: PortalProfilePreferencesUpdate,
    db: DB,
    current_user: CurrentUser,
) -> PortalProfilePreferencesResponse:
    """Update client's communication preference, sensitivities, and special instructions."""
    profile = await _get_client_profile(db, current_user.id)

    if body.communication_preference is not None:
        if body.communication_preference not in COMMUNICATION_PREFERENCES:
            allowed = ", ".join(sorted(COMMUNICATION_PREFERENCES))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid communication_preference. Must be one of: {allowed}",
            )
        profile.communication_preference = body.communication_preference

    if body.sensitivities is not None:
        profile.sensitivities = body.sensitivities

    if body.special_instructions is not None:
        profile.special_instructions = body.special_instructions

    await db.commit()
    await db.refresh(profile)

    return PortalProfilePreferencesResponse(
        communication_preference=profile.communication_preference,
        sensitivities=profile.sensitivities,
        special_instructions=profile.special_instructions,
    )


# --- Intelligence File ---


@router.get(
    "/intelligence",
    response_model=PortalIntelligenceResponse,
    dependencies=[Depends(require_client)],
)
async def get_intelligence(
    db: DB,
    current_user: CurrentUser,
) -> PortalIntelligenceResponse:
    """Return client-visible subset of the intelligence file."""
    profile = await _get_client_profile(db, current_user.id)
    intel = profile.intelligence_file or {}

    # Filter to only client-visible keys
    visible_data = {k: v for k, v in intel.items() if k in CLIENT_VISIBLE_INTELLIGENCE_KEYS}
    return PortalIntelligenceResponse(data=visible_data)


@router.patch(
    "/intelligence",
    response_model=PortalIntelligenceResponse,
    dependencies=[Depends(require_client)],
)
async def update_intelligence(
    body: PortalIntelligenceUpdate,
    db: DB,
    current_user: CurrentUser,
) -> PortalIntelligenceResponse:
    """Update client-visible portions of the intelligence file.

    Only keys in CLIENT_VISIBLE_INTELLIGENCE_KEYS can be written.
    RM-only keys are preserved and cannot be overwritten by clients.
    """
    profile = await _get_client_profile(db, current_user.id)

    # Reject if any submitted key is not client-visible
    disallowed = set(body.data.keys()) - CLIENT_VISIBLE_INTELLIGENCE_KEYS
    if disallowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update restricted fields: {', '.join(sorted(disallowed))}",
        )

    # Merge: preserve all existing data, overlay only client-visible keys
    current_intel = dict(profile.intelligence_file or {})
    for key, value in body.data.items():
        current_intel[key] = value

    profile.intelligence_file = current_intel
    await db.commit()
    await db.refresh(profile)

    # Return only client-visible data
    visible_data = {
        k: v for k, v in (profile.intelligence_file or {}).items()
        if k in CLIENT_VISIBLE_INTELLIGENCE_KEYS
    }
    return PortalIntelligenceResponse(data=visible_data)
