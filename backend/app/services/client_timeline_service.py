"""Service for aggregating client timeline events."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import ScalarSelect, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.approval import ProgramApproval
from app.models.client_profile import ClientProfile
from app.models.communication_log import CommunicationLog
from app.models.document import Document
from app.models.enums import DocumentEntityType
from app.models.milestone import Milestone
from app.models.program import Program
from app.schemas.client_timeline import (
    TimelineEventResponse,
    TimelineEventType,
    TimelineListResponse,
)


class ClientTimelineService:
    """Aggregates timeline events from multiple sources for a client."""

    async def get_timeline(
        self,
        db: AsyncSession,
        profile_id: UUID,
        *,
        event_types: list[TimelineEventType] | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> TimelineListResponse:
        """Get aggregated timeline for a client profile."""
        all_events: list[TimelineEventResponse] = []

        # Determine which event types to fetch
        types_to_fetch = set(event_types) if event_types else set(TimelineEventType)

        if TimelineEventType.communication in types_to_fetch:
            events = await self._get_communication_events(db, profile_id, date_from, date_to)
            all_events.extend(events)

        if TimelineEventType.document in types_to_fetch:
            events = await self._get_document_events(db, profile_id, date_from, date_to)
            all_events.extend(events)

        if TimelineEventType.milestone in types_to_fetch:
            events = await self._get_milestone_events(db, profile_id, date_from, date_to)
            all_events.extend(events)

        if TimelineEventType.program_status in types_to_fetch:
            events = await self._get_program_events(db, profile_id, date_from, date_to)
            all_events.extend(events)

        if TimelineEventType.approval in types_to_fetch:
            events = await self._get_approval_events(db, profile_id, date_from, date_to)
            all_events.extend(events)

        if TimelineEventType.compliance in types_to_fetch:
            events = await self._get_compliance_events(db, profile_id, date_from, date_to)
            all_events.extend(events)

        # Sort all events by date descending
        all_events.sort(key=lambda e: e.occurred_at, reverse=True)

        total = len(all_events)
        paginated = all_events[skip : skip + limit]

        return TimelineListResponse(
            items=paginated,
            total=total,
            has_more=(skip + limit) < total,
        )

    # ------------------------------------------------------------------
    # Private helpers to fetch events from each source
    # ------------------------------------------------------------------

    async def _get_communication_events(
        self,
        db: AsyncSession,
        profile_id: UUID,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> list[TimelineEventResponse]:
        """Fetch communication log events for the client."""
        query = (
            select(CommunicationLog)
            .options(selectinload(CommunicationLog.logger))
            .where(CommunicationLog.client_id == profile_id)
        )
        if date_from:
            query = query.where(CommunicationLog.occurred_at >= date_from)
        if date_to:
            query = query.where(CommunicationLog.occurred_at <= date_to)

        result = await db.execute(query)
        logs = result.scalars().all()

        events: list[TimelineEventResponse] = []
        for log in logs:
            actor_name: str | None = None
            if log.logger:
                actor_name = log.logger.full_name
            channel_val = log.channel.value if log.channel else None
            direction_val = log.direction.value if log.direction else None
            fallback = f"{(channel_val or '').replace('_', ' ').title()} - {direction_val or ''}"
            title = log.subject or fallback
            events.append(
                TimelineEventResponse(
                    id=log.id,
                    event_type=TimelineEventType.communication,
                    title=title,
                    description=log.summary,
                    occurred_at=log.occurred_at,
                    metadata={
                        "channel": channel_val,
                        "direction": direction_val,
                        "contact_name": log.contact_name,
                        "contact_email": log.contact_email,
                        "tags": log.tags or [],
                    },
                    entity_id=log.id,
                    entity_type="communication_log",
                    actor_name=actor_name,
                    actor_id=log.logged_by,
                )
            )
        return events

    async def _get_document_events(
        self,
        db: AsyncSession,
        profile_id: UUID,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> list[TimelineEventResponse]:
        """Fetch document upload events for the client."""
        query = (
            select(Document)
            .options(selectinload(Document.uploader))
            .where(Document.entity_type == DocumentEntityType.client)
            .where(Document.entity_id == profile_id)
        )
        if date_from:
            query = query.where(Document.created_at >= date_from)
        if date_to:
            query = query.where(Document.created_at <= date_to)

        result = await db.execute(query)
        docs = result.scalars().all()

        events: list[TimelineEventResponse] = []
        for doc in docs:
            actor_name: str | None = None
            if doc.uploader:
                actor_name = doc.uploader.full_name
            events.append(
                TimelineEventResponse(
                    id=doc.id,  # type: ignore[arg-type]
                    event_type=TimelineEventType.document,
                    title=f"Document uploaded: {doc.file_name}",
                    description=doc.description,  # type: ignore[arg-type]
                    occurred_at=doc.created_at,
                    metadata={
                        "file_name": doc.file_name,
                        "file_size": doc.file_size,
                        "content_type": doc.content_type,
                        "category": doc.category.value if doc.category else None,
                        "version": doc.version,
                        "vault_status": doc.vault_status.value if doc.vault_status else None,
                    },
                    entity_id=doc.id,  # type: ignore[arg-type]
                    entity_type="document",
                    actor_name=actor_name,
                    actor_id=doc.uploaded_by,  # type: ignore[arg-type]
                )
            )
        return events

    def _program_ids_subquery(self, profile_id: UUID) -> ScalarSelect[Any]:
        """Subquery returning program IDs linked to a client profile via communication logs."""
        return (
            select(CommunicationLog.program_id)
            .where(CommunicationLog.client_id == profile_id)
            .where(CommunicationLog.program_id.is_not(None))
            .distinct()
            .scalar_subquery()
        )

    async def _get_milestone_events(
        self,
        db: AsyncSession,
        profile_id: UUID,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> list[TimelineEventResponse]:
        """Fetch milestone events for programs belonging to this client profile."""
        program_ids_sq = self._program_ids_subquery(profile_id)

        query = (
            select(Milestone)
            .options(selectinload(Milestone.program))
            .where(Milestone.program_id.in_(program_ids_sq))
        )
        if date_from:
            query = query.where(Milestone.created_at >= date_from)
        if date_to:
            query = query.where(Milestone.created_at <= date_to)

        result = await db.execute(query)
        milestones = result.scalars().all()

        events: list[TimelineEventResponse] = []
        for ms in milestones:
            program_title = ms.program.title if ms.program else "Unknown Program"
            description = f"Program: {program_title}"
            if ms.description:
                description += f" - {ms.description}"
            events.append(
                TimelineEventResponse(
                    id=ms.id,
                    event_type=TimelineEventType.milestone,
                    title=f"Milestone: {ms.title}",
                    description=description,
                    occurred_at=ms.updated_at or ms.created_at,
                    metadata={
                        "status": ms.status.value if ms.status else None,
                        "due_date": ms.due_date.isoformat() if ms.due_date else None,
                        "program_title": program_title,
                        "program_id": str(ms.program_id),
                    },
                    entity_id=ms.id,
                    entity_type="milestone",
                )
            )
        return events

    async def _get_program_events(
        self,
        db: AsyncSession,
        profile_id: UUID,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> list[TimelineEventResponse]:
        """Fetch program creation/status events for the client."""
        program_ids_sq = self._program_ids_subquery(profile_id)

        query = (
            select(Program)
            .options(selectinload(Program.creator))
            .where(Program.id.in_(program_ids_sq))
        )
        if date_from:
            query = query.where(Program.created_at >= date_from)
        if date_to:
            query = query.where(Program.created_at <= date_to)

        result = await db.execute(query)
        programs = result.scalars().all()

        events: list[TimelineEventResponse] = []
        for prog in programs:
            actor_name: str | None = None
            if prog.creator:
                actor_name = prog.creator.full_name
            events.append(
                TimelineEventResponse(
                    id=prog.id,
                    event_type=TimelineEventType.program_status,
                    title=f"Program: {prog.title}",
                    description=prog.objectives,
                    occurred_at=prog.created_at,
                    metadata={
                        "status": prog.status.value if prog.status else None,
                        "budget": str(prog.budget_envelope) if prog.budget_envelope else None,
                        "start_date": prog.start_date.isoformat() if prog.start_date else None,
                        "end_date": prog.end_date.isoformat() if prog.end_date else None,
                    },
                    entity_id=prog.id,
                    entity_type="program",
                    actor_name=actor_name,
                    actor_id=prog.created_by,
                )
            )
        return events

    async def _get_approval_events(
        self,
        db: AsyncSession,
        profile_id: UUID,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> list[TimelineEventResponse]:
        """Fetch approval events for programs belonging to this client."""
        program_ids_sq = self._program_ids_subquery(profile_id)

        query = (
            select(ProgramApproval)
            .options(
                selectinload(ProgramApproval.requester),
                selectinload(ProgramApproval.approver),
                selectinload(ProgramApproval.program),
            )
            .where(ProgramApproval.program_id.in_(program_ids_sq))
        )
        if date_from:
            query = query.where(ProgramApproval.created_at >= date_from)
        if date_to:
            query = query.where(ProgramApproval.created_at <= date_to)

        result = await db.execute(query)
        approvals = result.scalars().all()

        events: list[TimelineEventResponse] = []
        for appr in approvals:
            actor_name: str | None = None
            actor_id: UUID | None = None
            if appr.approver:
                actor_name = appr.approver.full_name
                actor_id = appr.approved_by
            elif appr.requester:
                actor_name = appr.requester.full_name
                actor_id = appr.requested_by

            program_title = appr.program.title if appr.program else "Unknown"
            type_label = (
                appr.approval_type.value.replace("_", " ").title()
                if appr.approval_type
                else "Unknown"
            )
            events.append(
                TimelineEventResponse(
                    id=appr.id,
                    event_type=TimelineEventType.approval,
                    title=f"Approval: {type_label} - {program_title}",
                    description=appr.comments,
                    occurred_at=appr.decided_at or appr.created_at,
                    metadata={
                        "approval_type": appr.approval_type.value if appr.approval_type else None,
                        "status": appr.status.value if appr.status else None,
                        "program_title": program_title,
                        "program_id": str(appr.program_id),
                    },
                    entity_id=appr.id,
                    entity_type="approval",
                    actor_name=actor_name,
                    actor_id=actor_id,
                )
            )
        return events

    async def _get_compliance_events(
        self,
        db: AsyncSession,
        profile_id: UUID,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> list[TimelineEventResponse]:
        """Fetch compliance review events for the client profile."""
        query = (
            select(ClientProfile)
            .options(
                selectinload(ClientProfile.compliance_reviewer),
                selectinload(ClientProfile.approver),
            )
            .where(ClientProfile.id == profile_id)
        )
        result = await db.execute(query)
        profile = result.scalar_one_or_none()

        if not profile:
            return []

        events: list[TimelineEventResponse] = []

        # Compliance review event
        if profile.compliance_reviewed_at:
            reviewed_at = profile.compliance_reviewed_at
            in_range = True
            if date_from and reviewed_at < date_from:
                in_range = False
            if date_to and reviewed_at > date_to:
                in_range = False

            if in_range:
                reviewer_name: str | None = None
                if profile.compliance_reviewer:
                    reviewer_name = profile.compliance_reviewer.full_name
                status_label = (
                    profile.compliance_status.replace("_", " ").title()
                    if profile.compliance_status
                    else "Unknown"
                )
                events.append(
                    TimelineEventResponse(
                        id=profile.id,
                        event_type=TimelineEventType.compliance,
                        title=f"Compliance Review: {status_label}",
                        description=profile.compliance_notes,
                        occurred_at=reviewed_at,
                        metadata={
                            "compliance_status": profile.compliance_status,
                        },
                        entity_id=profile.id,
                        entity_type="client_profile",
                        actor_name=reviewer_name,
                        actor_id=profile.compliance_reviewed_by,
                    )
                )

        # MD approval event
        if profile.approved_at:
            approved_at = profile.approved_at
            in_range = True
            if date_from and approved_at < date_from:
                in_range = False
            if date_to and approved_at > date_to:
                in_range = False

            if in_range:
                approver_name: str | None = None
                if profile.approver:
                    approver_name = profile.approver.full_name
                approval_label = (
                    profile.approval_status.replace("_", " ").title()
                    if profile.approval_status
                    else "Unknown"
                )
                events.append(
                    TimelineEventResponse(
                        id=profile.id,
                        event_type=TimelineEventType.compliance,
                        title=f"MD Approval: {approval_label}",
                        description=None,
                        occurred_at=approved_at,
                        metadata={
                            "approval_status": profile.approval_status,
                        },
                        entity_id=profile.id,
                        entity_type="client_profile",
                        actor_name=approver_name,
                        actor_id=profile.approved_by,
                    )
                )

        return events


client_timeline_service = ClientTimelineService()
