"""Service for NPS survey operations."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.client_profile import ClientProfile
from app.models.enums import (
    NPSFollowUpPriority,
    NPSFollowUpStatus,
    NPSScoreCategory,
    NPSSurveyStatus,
)
from app.models.nps_survey import NPSFollowUp, NPSResponse, NPSSurvey
from app.schemas.nps_survey import (
    NPSFollowUpCreate,
    NPSFollowUpUpdate,
    NPSResponseCreate,
    NPSResponseUpdate,
    NPSSurveyCreate,
    NPSSurveyStats,
    NPSTrendAnalysis,
    NPSTrendPoint,
)
from app.services.crud_base import CRUDBase


def categorize_score(score: int) -> str:
    """Categorize NPS score into promoter/passive/detractor."""
    if score >= 9:
        return NPSScoreCategory.promoter
    elif score >= 7:
        return NPSScoreCategory.passive
    else:
        return NPSScoreCategory.detractor


def calculate_nps(promoters: int, passives: int, detractors: int) -> float:
    """Calculate NPS score from counts."""
    total = promoters + passives + detractors
    if total == 0:
        return 0.0
    return round(((promoters - detractors) / total) * 100, 1)


def _percent(count: int, total: int) -> float:
    """Calculate percentage with 1 decimal place."""
    return round((count / total * 100) if total > 0 else 0, 1)


class NPSSurveyService(CRUDBase[NPSSurvey, NPSSurveyCreate, dict[str, Any]]):
    """Service for NPS survey operations."""

    async def get_surveys(
        self,
        db: AsyncSession,
        *,
        status: str | None = None,
        year: int | None = None,
        quarter: int | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[NPSSurvey], int]:
        """Get NPS surveys with optional filtering."""
        query = select(NPSSurvey)
        count_query = select(func.count()).select_from(NPSSurvey)

        filters = []
        if status:
            filters.append(NPSSurvey.status == status)
        if year:
            filters.append(NPSSurvey.year == year)
        if quarter:
            filters.append(NPSSurvey.quarter == quarter)

        for f in filters:
            query = query.where(f)
            count_query = count_query.where(f)

        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(
            query.order_by(NPSSurvey.year.desc(), NPSSurvey.quarter.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def get_survey_with_details(
        self, db: AsyncSession, survey_id: uuid.UUID
    ) -> NPSSurvey | None:
        """Get a survey with responses and follow-ups loaded."""
        result = await db.execute(
            select(NPSSurvey)
            .options(
                selectinload(NPSSurvey.responses),
                selectinload(NPSSurvey.follow_ups),
            )
            .where(NPSSurvey.id == survey_id)
        )
        return result.scalar_one_or_none()

    async def create_survey(
        self,
        db: AsyncSession,
        *,
        data: NPSSurveyCreate,
        created_by_id: uuid.UUID,
    ) -> NPSSurvey:
        """Create a new NPS survey."""
        survey = NPSSurvey(
            name=data.name,
            description=data.description,
            quarter=data.quarter,
            year=data.year,
            questions=data.questions,
            distribution_method=data.distribution_method,
            reminder_enabled=data.reminder_enabled,
            reminder_days=data.reminder_days,
            scheduled_at=data.scheduled_at,
            closes_at=data.closes_at,
            target_client_types=data.target_client_types,
            target_client_ids=data.target_client_ids,
            status=NPSSurveyStatus.draft,
            created_by=created_by_id,
        )
        db.add(survey)
        await db.commit()
        await db.refresh(survey)
        return survey

    async def update_survey_status(
        self,
        db: AsyncSession,
        survey: NPSSurvey,
        status: NPSSurveyStatus,
    ) -> NPSSurvey:
        """Update survey status."""
        survey.status = status
        if status == NPSSurveyStatus.active:
            survey.sent_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(survey)
        return survey

    async def get_survey_stats(
        self, db: AsyncSession, survey_id: uuid.UUID
    ) -> NPSSurveyStats | None:
        """Get statistics for a survey."""
        survey = await self.get(db, survey_id)
        if not survey:
            return None

        # Get response counts by category
        result = await db.execute(
            select(
                func.count().label("total"),
                func.sum(case((NPSResponse.score_category == "promoter", 1), else_=0)).label(
                    "promoters"
                ),
                func.sum(case((NPSResponse.score_category == "passive", 1), else_=0)).label(
                    "passives"
                ),
                func.sum(case((NPSResponse.score_category == "detractor", 1), else_=0)).label(
                    "detractors"
                ),
                func.avg(NPSResponse.score).label("avg_score"),
            ).where(NPSResponse.survey_id == survey_id)
        )
        row = result.one()

        total_responses = row.total or 0
        promoters = row.promoters or 0
        passives = row.passives or 0
        detractors = row.detractors or 0
        avg_score = float(row.avg_score) if row.avg_score else 0.0

        # Get follow-up counts
        follow_up_result = await db.execute(
            select(
                func.sum(
                    case((NPSFollowUp.status == NPSFollowUpStatus.pending, 1), else_=0)
                ).label("pending"),
                func.sum(
                    case((NPSFollowUp.status == NPSFollowUpStatus.completed, 1), else_=0)
                ).label("completed"),
            ).where(NPSFollowUp.survey_id == survey_id)
        )
        fu_row = follow_up_result.one()

        # Calculate total sent (target clients)
        total_sent = 0
        if survey.target_client_ids:
            total_sent = len(survey.target_client_ids)
        else:
            # Count clients matching criteria
            client_query = select(func.count()).select_from(ClientProfile).where(
                ClientProfile.approval_status == "approved"
            )
            if survey.target_client_types:
                client_query = client_query.where(
                    ClientProfile.entity_type.in_(survey.target_client_types)
                )
            total_sent = (await db.execute(client_query)).scalar_one()

        response_rate = (total_responses / total_sent * 100) if total_sent > 0 else 0.0
        nps_score = calculate_nps(promoters, passives, detractors)

        return NPSSurveyStats(
            survey_id=survey.id,
            survey_name=survey.name,
            quarter=survey.quarter,
            year=survey.year,
            total_sent=total_sent,
            total_responses=total_responses,
            response_rate=round(response_rate, 1),
            nps_score=nps_score,
            promoters_count=promoters,
            passives_count=passives,
            detractors_count=detractors,
            promoters_percent=_percent(promoters, total_responses),
            passives_percent=_percent(passives, total_responses),
            detractors_percent=_percent(detractors, total_responses),
            average_score=round(avg_score, 1),
            follow_ups_pending=fu_row.pending or 0,
            follow_ups_completed=fu_row.completed or 0,
        )

    async def get_trend_analysis(
        self,
        db: AsyncSession,
        *,
        client_profile_id: uuid.UUID | None = None,
        quarters: int = 4,
    ) -> NPSTrendAnalysis:
        """Get NPS trend analysis over time."""
        # Get surveys ordered by date
        query = (
            select(NPSSurvey)
            .where(NPSSurvey.status.in_([NPSSurveyStatus.closed, NPSSurveyStatus.active]))
            .order_by(NPSSurvey.year.desc(), NPSSurvey.quarter.desc())
            .limit(quarters)
        )
        result = await db.execute(query)
        surveys = list(result.scalars().all())

        trends = []
        for survey in reversed(surveys):  # Oldest first
            # Get response stats for this survey
            response_query = (
                select(
                    func.count().label("total"),
                    func.sum(
                        case((NPSResponse.score_category == "promoter", 1), else_=0)
                    ).label("promoters"),
                    func.sum(
                        case((NPSResponse.score_category == "passive", 1), else_=0)
                    ).label("passives"),
                    func.sum(
                        case((NPSResponse.score_category == "detractor", 1), else_=0)
                    ).label("detractors"),
                )
                .select_from(NPSResponse)
                .where(NPSResponse.survey_id == survey.id)
            )

            if client_profile_id:
                response_query = response_query.where(
                    NPSResponse.client_profile_id == client_profile_id
                )

            row = (await db.execute(response_query)).one()
            total = row.total or 0
            promoters = row.promoters or 0
            passives = row.passives or 0
            detractors = row.detractors or 0

            nps = calculate_nps(promoters, passives, detractors)
            trends.append(
                NPSTrendPoint(
                    period=f"Q{survey.quarter} {survey.year}",
                    quarter=survey.quarter,
                    year=survey.year,
                    nps_score=nps,
                    response_count=total,
                    promoters_percent=round((promoters / total * 100) if total > 0 else 0, 1),
                    passives_percent=round((passives / total * 100) if total > 0 else 0, 1),
                    detractors_percent=round((detractors / total * 100) if total > 0 else 0, 1),
                )
            )

        # Calculate change
        current_nps = trends[-1].nps_score if trends else 0.0
        previous_nps = trends[-2].nps_score if len(trends) > 1 else None
        change = round(current_nps - previous_nps, 1) if previous_nps is not None else None

        if change is None:
            trend_direction = "stable"
        elif change > 0:
            trend_direction = "up"
        elif change < 0:
            trend_direction = "down"
        else:
            trend_direction = "stable"

        return NPSTrendAnalysis(
            trends=trends,
            current_nps=current_nps,
            previous_nps=previous_nps,
            change=change,
            trend_direction=trend_direction,
        )


class NPSResponseService(CRUDBase[NPSResponse, NPSResponseCreate, NPSResponseUpdate]):
    """Service for NPS response operations."""

    async def get_responses(
        self,
        db: AsyncSession,
        *,
        survey_id: uuid.UUID | None = None,
        client_profile_id: uuid.UUID | None = None,
        score_category: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[NPSResponse], int]:
        """Get NPS responses with optional filtering."""
        query = select(NPSResponse).options(joinedload(NPSResponse.client_profile))
        count_query = select(func.count()).select_from(NPSResponse)

        filters = []
        if survey_id:
            filters.append(NPSResponse.survey_id == survey_id)
        if client_profile_id:
            filters.append(NPSResponse.client_profile_id == client_profile_id)
        if score_category:
            filters.append(NPSResponse.score_category == score_category)

        for f in filters:
            query = query.where(f)
            count_query = count_query.where(f)

        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(
            query.order_by(NPSResponse.responded_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().unique().all()), total

    async def submit_response(
        self,
        db: AsyncSession,
        *,
        survey_id: uuid.UUID,
        client_profile_id: uuid.UUID,
        data: NPSResponseCreate,
    ) -> NPSResponse:
        """Submit an NPS response."""
        score_category = categorize_score(data.score)

        response = NPSResponse(
            survey_id=survey_id,
            client_profile_id=client_profile_id,
            score=data.score,
            score_category=score_category,
            comment=data.comment,
            custom_responses=data.custom_responses,
            response_channel=data.response_channel,
            follow_up_required=(score_category == NPSScoreCategory.detractor),
        )
        db.add(response)
        await db.commit()
        await db.refresh(response)

        # Auto-create follow-up for detractors
        if score_category == NPSScoreCategory.detractor:
            await self._create_auto_follow_up(db, response)

        return response

    async def _create_auto_follow_up(
        self, db: AsyncSession, response: NPSResponse
    ) -> NPSFollowUp:
        """Create automatic follow-up for detractor response."""
        # Get the client's RM
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.id == response.client_profile_id)
        )
        client = result.scalar_one_or_none()

        assigned_to = client.assigned_rm_id if client and client.assigned_rm_id else None
        # If no RM assigned, follow-up will need manual assignment

        # Determine priority based on score
        if response.score <= 3:
            priority = NPSFollowUpPriority.urgent
        elif response.score <= 5:
            priority = NPSFollowUpPriority.high
        else:
            priority = NPSFollowUpPriority.medium

        follow_up = NPSFollowUp(
            survey_id=response.survey_id,
            response_id=response.id,
            client_profile_id=response.client_profile_id,
            assigned_to=assigned_to or uuid.UUID("00000000-0000-0000-0000-000000000000"),
            priority=priority.value,
            status=NPSFollowUpStatus.pending.value,
            due_at=datetime.now(UTC) + timedelta(days=3),
        )
        db.add(follow_up)
        await db.commit()
        await db.refresh(follow_up)
        return follow_up

    async def check_existing_response(
        self,
        db: AsyncSession,
        survey_id: uuid.UUID,
        client_profile_id: uuid.UUID,
    ) -> NPSResponse | None:
        """Check if a client has already responded to a survey."""
        result = await db.execute(
            select(NPSResponse).where(
                and_(
                    NPSResponse.survey_id == survey_id,
                    NPSResponse.client_profile_id == client_profile_id,
                )
            )
        )
        return result.scalar_one_or_none()


class NPSFollowUpService(CRUDBase[NPSFollowUp, NPSFollowUpCreate, NPSFollowUpUpdate]):
    """Service for NPS follow-up operations."""

    async def get_follow_ups(
        self,
        db: AsyncSession,
        *,
        survey_id: uuid.UUID | None = None,
        assigned_to: uuid.UUID | None = None,
        status: str | None = None,
        priority: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[NPSFollowUp], int]:
        """Get NPS follow-ups with optional filtering."""
        query = select(NPSFollowUp).options(
            joinedload(NPSFollowUp.client_profile),
            joinedload(NPSFollowUp.response),
        )
        count_query = select(func.count()).select_from(NPSFollowUp)

        filters = []
        if survey_id:
            filters.append(NPSFollowUp.survey_id == survey_id)
        if assigned_to:
            filters.append(NPSFollowUp.assigned_to == assigned_to)
        if status:
            filters.append(NPSFollowUp.status == status)
        if priority:
            filters.append(NPSFollowUp.priority == priority)

        for f in filters:
            query = query.where(f)
            count_query = count_query.where(f)

        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(
            query.order_by(
                NPSFollowUp.priority.desc(),
                NPSFollowUp.created_at.desc(),
            )
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().unique().all()), total

    async def update_status(
        self,
        db: AsyncSession,
        follow_up: NPSFollowUp,
        status: NPSFollowUpStatus,
        resolution_notes: str | None = None,
    ) -> NPSFollowUp:
        """Update follow-up status."""
        follow_up.status = status.value
        if status == NPSFollowUpStatus.completed:
            follow_up.completed_at = datetime.now(UTC)
            if resolution_notes:
                follow_up.resolution_notes = resolution_notes

            # Mark the response follow-up as completed
            await db.execute(
                select(NPSResponse).where(NPSResponse.id == follow_up.response_id)
            )
            response = (await db.execute(
                select(NPSResponse).where(NPSResponse.id == follow_up.response_id)
            )).scalar_one_or_none()
            if response:
                response.follow_up_completed = True

        if resolution_notes:
            follow_up.resolution_notes = resolution_notes

        await db.commit()
        await db.refresh(follow_up)
        return follow_up

    async def get_my_follow_ups(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        *,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[NPSFollowUp], int]:
        """Get follow-ups assigned to the current user."""
        return await self.get_follow_ups(
            db,
            assigned_to=user_id,
            status=status,
            skip=skip,
            limit=limit,
        )


# Service instances
nps_survey_service = NPSSurveyService(NPSSurvey)
nps_response_service = NPSResponseService(NPSResponse)
nps_follow_up_service = NPSFollowUpService(NPSFollowUp)
