"""Risk forecast endpoints — predictive at-risk alerts & health forecasting."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import DB, CurrentUser, require_internal
from app.schemas.risk_forecast import (
    ClientRiskOverview,
    PredictiveRiskListResponse,
    ProgramHealthSummary,
    RiskAlertListResponse,
    RiskForecastListResponse,
)
from app.services.risk_scoring_service import (
    get_all_program_risks,
    get_client_risk_overview,
    get_predictive_risk_alerts,
    get_program_health_detail,
    get_risk_alerts,
)

router = APIRouter()


@router.get(
    "/programs",
    response_model=RiskForecastListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_program_risk_scores(
    db: DB,
    current_user: CurrentUser,
    risk_status: str | None = Query(
        None, description="Filter by risk status: healthy, at_risk, critical"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> RiskForecastListResponse:
    """List all programs with computed risk scores.

    Returns paginated programs sorted by risk score (highest first),
    along with aggregate counts by risk classification.
    """
    return await get_all_program_risks(
        db,
        risk_status_filter=risk_status,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/programs/{program_id}",
    response_model=ProgramHealthSummary,
    dependencies=[Depends(require_internal)],
)
async def get_program_health(
    program_id: UUID,
    db: DB,
    current_user: CurrentUser,
) -> ProgramHealthSummary:
    """Get detailed health summary for a single program.

    Includes full risk factor breakdown, task metrics, SLA metrics,
    escalation counts, budget data, and NPS scores.
    """
    health = await get_program_health_detail(db, program_id)
    if not health:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Program not found",
        )
    return health


@router.get(
    "/clients/{client_id}",
    response_model=ClientRiskOverview,
    dependencies=[Depends(require_internal)],
)
async def get_client_risk(
    client_id: UUID,
    db: DB,
    current_user: CurrentUser,
) -> ClientRiskOverview:
    """Get client-level risk overview across all their programs.

    Aggregates risk scores and counts by classification,
    identifies the highest-risk program, and includes per-program scores.
    """
    overview = await get_client_risk_overview(db, client_id)
    if not overview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return overview


@router.get(
    "/alerts",
    response_model=RiskAlertListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_risk_alerts(
    db: DB,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> RiskAlertListResponse:
    """List high-risk items needing attention.

    Returns only at_risk and critical programs, sorted by risk score descending,
    with the primary risk driver identified for each alert.
    """
    return await get_risk_alerts(db, skip=skip, limit=limit)


@router.get(
    "/predictive",
    response_model=PredictiveRiskListResponse,
    dependencies=[Depends(require_internal)],
)
async def list_predictive_risk_alerts(
    db: DB,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> PredictiveRiskListResponse:
    """Predictive risk alerts — programs with milestones predicted to breach.

    Uses task completion velocity and timeline analysis to identify
    programs at risk of missing milestones before the breach occurs.
    Warning-level alerts are issued within 7 days; critical within 3 days.
    """
    return await get_predictive_risk_alerts(db, skip=skip, limit=limit)
