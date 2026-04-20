"""Service for Pulse Survey operations."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PulseSurveyResponseType, PulseSurveyStatus
from app.models.pulse_survey import PulseSurvey, PulseSurveyResponse
from app.schemas.pulse_survey import (
    PulseSurveyCreate,
    PulseSurveyResponseCreate,
    PulseSurveyStats,
    PulseSurveyValueCount,
)
from app.services.crud_base import CRUDBase

# ─── Helpers ─────────────────────────────────────────────────────────────────


def _positive_values(response_type: str) -> set[str]:
    """Return the response values considered 'positive' for sentiment scoring."""
    mapping: dict[str, set[str]] = {
        PulseSurveyResponseType.emoji: {"happy"},
        PulseSurveyResponseType.stars: {"4", "5"},
        PulseSurveyResponseType.yes_no: {"yes"},
        PulseSurveyResponseType.thumbs: {"up"},
    }
    return mapping.get(response_type, set())


def _valid_values(response_type: str) -> set[str]:
    """Return the valid response values for a given response type."""
    mapping: dict[str, set[str]] = {
        PulseSurveyResponseType.emoji: {"happy", "neutral", "sad"},
        PulseSurveyResponseType.stars: {"1", "2", "3", "4", "5"},
        PulseSurveyResponseType.yes_no: {"yes", "no"},
        PulseSurveyResponseType.thumbs: {"up", "down"},
    }
    return mapping.get(response_type, set())


# ─── Survey Service ───────────────────────────────────────────────────────────


class PulseSurveyService(CRUDBase[PulseSurvey, PulseSurveyCreate, dict[str, Any]]):
    """Service for pulse survey CRUD and business logic."""

    async def create_survey(
        self,
        db: AsyncSession,
        *,
        data: PulseSurveyCreate,
        created_by_id: uuid.UUID,
    ) -> PulseSurvey:
        """Create a new pulse survey."""
        obj = PulseSurvey(
            title=data.title,
            question=data.question,
            response_type=data.response_type,
            allow_comment=data.allow_comment,
            trigger_type=data.trigger_type,
            active_from=data.active_from,
            active_to=data.active_to,
            max_responses=data.max_responses,
            min_days_between_shows=data.min_days_between_shows,
            status=PulseSurveyStatus.draft,
            created_by=created_by_id,
        )
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj

    async def get_surveys(
        self,
        db: AsyncSession,
        *,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[PulseSurvey], int]:
        """List pulse surveys with optional status filter."""
        filters = []
        if status:
            filters.append(PulseSurvey.status == status)
        return await self.get_multi(db, skip=skip, limit=limit, filters=filters or None)

    async def activate_survey(self, db: AsyncSession, survey: PulseSurvey) -> PulseSurvey:
        """Activate a draft survey."""
        return await self.update(
            db,
            db_obj=survey,
            obj_in={"status": PulseSurveyStatus.active},
        )

    async def close_survey(self, db: AsyncSession, survey: PulseSurvey) -> PulseSurvey:
        """Close an active survey."""
        return await self.update(
            db,
            db_obj=survey,
            obj_in={"status": PulseSurveyStatus.closed},
        )

    async def get_active_for_client(
        self,
        db: AsyncSession,
        client_profile_id: uuid.UUID,
    ) -> PulseSurvey | None:
        """
        Return an active pulse survey the client hasn't already responded to,
        respecting anti-fatigue (min_days_between_shows) and date range.
        """
        now = datetime.now(UTC)

        # Build query: active surveys whose window covers now
        stmt = (
            select(PulseSurvey)
            .where(
                and_(
                    PulseSurvey.status == PulseSurveyStatus.active,
                    (PulseSurvey.active_from == None) | (PulseSurvey.active_from <= now),  # noqa: E711
                    (PulseSurvey.active_to == None) | (PulseSurvey.active_to >= now),  # noqa: E711
                )
            )
            .order_by(PulseSurvey.created_at.asc())
        )

        result = await db.execute(stmt)
        candidates = list(result.scalars().all())

        for survey in candidates:
            # Check max_responses cap
            if survey.max_responses is not None:
                count_result = await db.execute(
                    select(func.count())
                    .select_from(PulseSurveyResponse)
                    .where(PulseSurveyResponse.survey_id == survey.id)
                )
                total = count_result.scalar_one()
                if total >= survey.max_responses:
                    continue

            # Check if this client already responded to this survey
            existing = await db.execute(
                select(PulseSurveyResponse).where(
                    and_(
                        PulseSurveyResponse.survey_id == survey.id,
                        PulseSurveyResponse.client_profile_id == client_profile_id,
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue

            # Anti-fatigue: check most recent response to any pulse survey
            recent_result = await db.execute(
                select(PulseSurveyResponse.responded_at)
                .where(PulseSurveyResponse.client_profile_id == client_profile_id)
                .order_by(PulseSurveyResponse.responded_at.desc())
                .limit(1)
            )
            last_responded_at = recent_result.scalar_one_or_none()
            if last_responded_at is not None:
                min_gap = timedelta(days=survey.min_days_between_shows)
                if now - last_responded_at < min_gap:
                    continue

            return survey

        return None

    async def get_client_status(
        self,
        db: AsyncSession,
        survey_id: uuid.UUID,
        client_profile_id: uuid.UUID,
    ) -> PulseSurveyResponse | None:
        """Return the client's existing response for a survey, if any."""
        result = await db.execute(
            select(PulseSurveyResponse).where(
                and_(
                    PulseSurveyResponse.survey_id == survey_id,
                    PulseSurveyResponse.client_profile_id == client_profile_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_stats(
        self,
        db: AsyncSession,
        survey: PulseSurvey,
    ) -> PulseSurveyStats:
        """Compute response statistics for a pulse survey."""
        # Get all response values
        stmt = (
            select(
                PulseSurveyResponse.response_value,
                func.count().label("cnt"),
            )
            .where(PulseSurveyResponse.survey_id == survey.id)
            .group_by(PulseSurveyResponse.response_value)
        )

        result = await db.execute(stmt)
        rows = result.all()

        total = sum(r.cnt for r in rows)
        breakdown = [
            PulseSurveyValueCount(
                value=r.response_value,
                count=r.cnt,
                percent=round(r.cnt / total * 100, 1) if total > 0 else 0.0,
            )
            for r in rows
        ]

        # Sort by value
        breakdown.sort(key=lambda x: x.value)

        # Count responses with comments
        comments_result = await db.execute(
            select(func.count())
            .select_from(PulseSurveyResponse)
            .where(
                and_(
                    PulseSurveyResponse.survey_id == survey.id,
                    PulseSurveyResponse.comment != None,  # noqa: E711
                    PulseSurveyResponse.comment != "",
                )
            )
        )
        has_comments = comments_result.scalar_one()

        # Compute sentiment score
        positives = _positive_values(survey.response_type)
        positive_count = sum(r.cnt for r in rows if r.response_value in positives)
        sentiment_score = round(positive_count / total, 3) if total > 0 else None

        return PulseSurveyStats(
            survey_id=survey.id,
            survey_title=survey.title,
            response_type=survey.response_type,
            total_responses=total,
            breakdown=breakdown,
            has_comments=has_comments,
            sentiment_score=sentiment_score,
        )


# ─── Response Service ─────────────────────────────────────────────────────────


class PulseSurveyResponseService(
    CRUDBase[PulseSurveyResponse, PulseSurveyResponseCreate, dict[str, Any]]
):
    """Service for pulse survey response operations."""

    async def submit_response(
        self,
        db: AsyncSession,
        *,
        survey: PulseSurvey,
        client_profile_id: uuid.UUID,
        data: PulseSurveyResponseCreate,
    ) -> PulseSurveyResponse:
        """Submit a pulse survey response."""
        obj = PulseSurveyResponse(
            survey_id=survey.id,
            client_profile_id=client_profile_id,
            response_value=data.response_value,
            comment=data.comment,
            trigger_context=data.trigger_context,
        )
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj

    async def list_responses(
        self,
        db: AsyncSession,
        survey_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[PulseSurveyResponse], int]:
        """List responses for a survey."""
        filters = [PulseSurveyResponse.survey_id == survey_id]
        return await self.get_multi(db, skip=skip, limit=limit, filters=filters)


# ─── Service instances ────────────────────────────────────────────────────────

pulse_survey_service = PulseSurveyService(PulseSurvey)
pulse_response_service = PulseSurveyResponseService(PulseSurveyResponse)
