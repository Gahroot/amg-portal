"""Predictive analytics API endpoints.

Per design doc Section 09 Phase 3:
"Predictive alerts and capacity planning tools — Program at-risk flags issued
before milestones are breached."
"""

import logging
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, RLSContext, get_rm_client_ids, require_internal
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.enums import UserRole
from app.models.program import Program
from app.schemas.predictive import (
    MilestoneRiskDetail,
    PredictedRiskItem,
    PredictedRisksResponse,
    RunPredictionRequest,
    StoredRiskPrediction,
    StoredRiskPredictionList,
)
from app.services.predictive_service import (
    RISK_SCORE_HIGH,
    calculate_milestone_risk_score,
    get_at_risk_milestones,
)
from app.services.risk_prediction import (
    RISK_HIGH,
    compute_program_risk,
    get_latest_predictions,
    get_programs_at_risk,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Real-time at-risk milestones (existing predictive_service logic) ──────────


@router.get(
    "/predicted-risks",
    response_model=PredictedRisksResponse,
    dependencies=[Depends(require_internal)],
    summary="List programs with at-risk milestones (real-time score > 70)",
)
async def get_predicted_risks(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> PredictedRisksResponse:
    """Return programs that have at least one milestone with a predicted risk score > 70.

    Relationship managers see only their own clients' programs; all other internal
    roles see the full portfolio.
    """
    rm_client_ids: list[uuid.UUID] | None = None
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)

    at_risk_milestones = await get_at_risk_milestones(db, rm_client_ids=rm_client_ids)

    # Group by program
    programs_map: dict[uuid.UUID, PredictedRiskItem] = {}
    for risk in at_risk_milestones:
        if risk.program_id not in programs_map:
            score = risk.risk_score
            level = "critical" if score >= 85 else "high" if score >= RISK_SCORE_HIGH else "medium"
            programs_map[risk.program_id] = PredictedRiskItem(
                program_id=risk.program_id,
                program_title=risk.program_title,
                client_name=risk.client_name,
                highest_risk_score=score,
                risk_level=level,
                at_risk_milestone_count=0,
                at_risk_milestones=[],
            )

        item = programs_map[risk.program_id]
        item.at_risk_milestone_count += 1
        item.at_risk_milestones.append({
            "milestone_id": str(risk.milestone_id),
            "milestone_title": risk.milestone_title,
            "risk_score": risk.risk_score,
            "days_remaining": risk.days_remaining,
            "task_completion_rate": risk.task_completion_rate,
        })
        if risk.risk_score > item.highest_risk_score:
            item.highest_risk_score = risk.risk_score
            level = "critical" if risk.risk_score >= 85 else "high"
            item.risk_level = level

    programs = sorted(programs_map.values(), key=lambda p: p.highest_risk_score, reverse=True)
    return PredictedRisksResponse(programs=programs, total=len(programs))


@router.get(
    "/milestone-risk/{milestone_id}",
    response_model=MilestoneRiskDetail,
    dependencies=[Depends(require_internal)],
    summary="Real-time risk breakdown for a single milestone",
)
async def get_milestone_risk(
    milestone_id: uuid.UUID,
    db: DB,
    _rls: RLSContext,
) -> MilestoneRiskDetail:
    """Return a detailed risk score breakdown for a single milestone, computed on-the-fly."""
    risk = await calculate_milestone_risk_score(db, milestone_id)
    if risk is None:
        raise NotFoundException("Milestone not found or already completed/cancelled.")
    score = risk.risk_score
    if score >= 85:
        level = "critical"
    elif score >= RISK_SCORE_HIGH:
        level = "high"
    elif score >= 55:
        level = "medium"
    else:
        level = "low"
    return MilestoneRiskDetail(
        milestone_id=risk.milestone_id,
        milestone_title=risk.milestone_title,
        program_id=risk.program_id,
        program_title=risk.program_title,
        client_name=risk.client_name,
        risk_score=risk.risk_score,
        risk_level=level,
        days_remaining=risk.days_remaining,
        task_completion_rate=risk.task_completion_rate,
        partner_responsiveness_score=risk.partner_responsiveness_score,
        sla_breach_rate=risk.sla_breach_rate,
        risk_factors=risk.risk_factors,
    )


# ─── Stored risk predictions (risk_prediction service) ────────────────────────


@router.post(
    "/risk-predictions/run",
    response_model=StoredRiskPrediction,
    dependencies=[Depends(require_internal)],
    summary="Compute and persist a risk prediction for a program",
    status_code=status.HTTP_201_CREATED,
)
async def run_risk_prediction(
    body: RunPredictionRequest,
    db: DB,
    _rls: RLSContext,
) -> StoredRiskPrediction:
    """Trigger a full risk prediction run for the specified program (and optional milestone).

    The result is saved to the `predicted_risks` table and returned immediately.
    Includes task completion rate, milestone velocity moving-average, z-score
    anomaly detection, and schedule variance.
    """
    prediction = await compute_program_risk(db, body.program_id, body.milestone_id)
    if prediction is None:
        raise NotFoundException("Program (or milestone) not found.")
    await db.commit()
    return StoredRiskPrediction.model_validate(prediction)


@router.get(
    "/risk-predictions",
    response_model=StoredRiskPredictionList,
    dependencies=[Depends(require_internal)],
    summary="List stored risk predictions",
)
async def list_risk_predictions(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    program_id: uuid.UUID | None = Query(default=None, description="Filter by program"),
    min_score: int = Query(default=0, ge=0, le=100, description="Minimum risk score filter"),
    limit: int = Query(default=50, ge=1, le=200),
) -> StoredRiskPredictionList:
    """Return stored (pre-computed) risk predictions, newest first.

    Relationship managers are automatically scoped to their own clients' programs.
    """
    # RM scope: resolve allowed program IDs
    allowed_program_ids: list[uuid.UUID] | None = None
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)
        prog_result = await db.execute(
            select(Program.id).where(Program.client_id.in_(rm_client_ids))
        )
        allowed_program_ids = [row[0] for row in prog_result.all()]

    if program_id and allowed_program_ids is not None and program_id not in allowed_program_ids:
        raise ForbiddenException("Access denied.")

    predictions = await get_latest_predictions(
        db,
        program_id=program_id,
        min_risk_score=min_score,
        limit=limit,
    )

    # Apply RM scope post-query if needed
    if allowed_program_ids is not None:
        predictions = [p for p in predictions if p.program_id in allowed_program_ids]

    return StoredRiskPredictionList(
        predictions=[StoredRiskPrediction.model_validate(p) for p in predictions],
        total=len(predictions),
    )


@router.get(
    "/risk-predictions/at-risk",
    response_model=StoredRiskPredictionList,
    dependencies=[Depends(require_internal)],
    summary="Latest high-risk predictions per program",
)
async def list_at_risk_predictions(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    min_score: int = Query(default=RISK_HIGH, ge=0, le=100),
    limit: int = Query(default=50, ge=1, le=200),
) -> StoredRiskPredictionList:
    """Return the most-recent stored prediction for each program that exceeds the risk threshold.

    Deduplicates by program_id so only the latest snapshot per program is returned.
    """
    rm_program_ids: list[uuid.UUID] | None = None
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)
        prog_result = await db.execute(
            select(Program.id).where(Program.client_id.in_(rm_client_ids))
        )
        rm_program_ids = [row[0] for row in prog_result.all()]

    predictions = await get_programs_at_risk(
        db,
        min_risk_score=min_score,
        rm_program_ids=rm_program_ids,
        limit=limit,
    )

    return StoredRiskPredictionList(
        predictions=[StoredRiskPrediction.model_validate(p) for p in predictions],
        total=len(predictions),
    )
