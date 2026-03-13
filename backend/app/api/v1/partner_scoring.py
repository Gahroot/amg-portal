"""Partner scoring API — scorecards, rankings, performance history, and governance status."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import DB, require_internal
from app.schemas.dashboard import (
    GovernanceFlag,
    PartnerGovernanceStatus,
    PartnerPerformanceEntry,
    PartnerRanking,
    PartnerRankingsResponse,
    PartnerScorecard,
    PerformanceTrendPoint,
)
from app.services.partner_governance_service import get_partner_governance_status
from app.services.partner_scoring_service import (
    get_all_partner_rankings,
    get_partner_performance_history,
    get_partner_scorecard,
)

router = APIRouter()


@router.get(
    "/rankings",
    response_model=PartnerRankingsResponse,
    dependencies=[Depends(require_internal)],
)
async def partner_rankings(
    db: DB,
    skip: int = 0,
    limit: int = 50,
) -> PartnerRankingsResponse:
    """Get all partners ranked by overall score."""
    rankings, total = await get_all_partner_rankings(db, skip=skip, limit=limit)
    return PartnerRankingsResponse(
        rankings=[PartnerRanking(**r) for r in rankings],
        total=total,
    )


@router.get(
    "/{partner_id}/scorecard",
    response_model=PartnerScorecard,
    dependencies=[Depends(require_internal)],
)
async def partner_scorecard(
    partner_id: uuid.UUID,
    db: DB,
) -> PartnerScorecard:
    """Get full partner scorecard."""
    scorecard = await get_partner_scorecard(db, partner_id)
    if scorecard is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Partner not found",
        )
    return PartnerScorecard(**scorecard)


@router.get(
    "/{partner_id}/performance-history",
    response_model=list[PartnerPerformanceEntry],
    dependencies=[Depends(require_internal)],
)
async def partner_performance_history(
    partner_id: uuid.UUID,
    db: DB,
) -> list[PartnerPerformanceEntry]:
    """Get partner rating history over time."""
    history = await get_partner_performance_history(db, partner_id)
    return [PartnerPerformanceEntry(**entry) for entry in history]


@router.get(
    "/{partner_id}/governance",
    response_model=PartnerGovernanceStatus,
    dependencies=[Depends(require_internal)],
)
async def partner_governance(
    partner_id: uuid.UUID,
    db: DB,
) -> PartnerGovernanceStatus:
    """Get governance status for a partner — probation, review status, performance trend."""
    data = await get_partner_governance_status(db, partner_id)
    if "error" in data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Partner not found",
        )
    return PartnerGovernanceStatus(
        is_probationary=data["is_probationary"],
        last_review_date=data["last_review_date"],
        last_review_status=data["last_review_status"],
        performance_trend=[PerformanceTrendPoint(**p) for p in data["performance_trend"]],
        governance_flags=[GovernanceFlag(**f) for f in data["governance_flags"]],
    )
