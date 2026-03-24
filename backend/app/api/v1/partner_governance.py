"""Partner governance API — composite scores, governance actions, and dashboard."""

import uuid

from fastapi import APIRouter, Depends, status

from app.api.deps import DB, CurrentUser, require_admin, require_internal
from app.core.exceptions import NotFoundException
from app.schemas.partner_governance import (
    CompositeScoreResponse,
    GovernanceActionCreate,
    GovernanceActionResponse,
    GovernanceDashboardEntry,
    GovernanceDashboardResponse,
    GovernanceHistoryResponse,
)
from app.services.partner_scoring_service import (
    apply_governance_action,
    calculate_composite_score,
    get_governance_dashboard,
    get_governance_history,
)

router = APIRouter()


@router.get(
    "/dashboard",
    response_model=GovernanceDashboardResponse,
    dependencies=[Depends(require_internal)],
)
async def governance_dashboard(
    db: DB,
    skip: int = 0,
    limit: int = 50,
) -> GovernanceDashboardResponse:
    """Get governance dashboard with all partners, scores, and status."""
    entries, total = await get_governance_dashboard(db, skip=skip, limit=limit)
    return GovernanceDashboardResponse(
        entries=[GovernanceDashboardEntry(**e) for e in entries],
        total=total,
    )


@router.get(
    "/{partner_id}/governance",
    response_model=GovernanceHistoryResponse,
    dependencies=[Depends(require_internal)],
)
async def partner_governance_history(
    partner_id: uuid.UUID,
    db: DB,
) -> GovernanceHistoryResponse:
    """Get governance action history for a partner."""
    records = await get_governance_history(db, partner_id)
    actions = []
    for r in records:
        actions.append(
            GovernanceActionResponse(
                id=r.id,
                partner_id=r.partner_id,
                action=r.action,
                reason=r.reason,
                evidence=r.evidence,
                effective_date=r.effective_date,
                expiry_date=r.expiry_date,
                issued_by=r.issued_by,
                issuer_name=r.issuer.full_name if r.issuer else None,
                partner_firm_name=r.partner.firm_name if r.partner else None,
                created_at=r.created_at,
            )
        )
    return GovernanceHistoryResponse(actions=actions, total=len(actions))


@router.post(
    "/{partner_id}/governance",
    response_model=GovernanceActionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_governance_action(
    partner_id: uuid.UUID,
    body: GovernanceActionCreate,
    db: DB,
    current_user: CurrentUser,
) -> GovernanceActionResponse:
    """Apply a governance action to a partner (MD only)."""
    record = await apply_governance_action(
        db,
        partner_id=partner_id,
        action=body.action,
        reason=body.reason,
        issued_by=current_user.id,
        evidence=body.evidence,
        expiry_date=body.expiry_date,
        effective_date=body.effective_date,
    )
    return GovernanceActionResponse(
        id=record.id,
        partner_id=record.partner_id,
        action=record.action,
        reason=record.reason,
        evidence=record.evidence,
        effective_date=record.effective_date,
        expiry_date=record.expiry_date,
        issued_by=record.issued_by,
        issuer_name=current_user.full_name,
        partner_firm_name=record.partner.firm_name if record.partner else None,
        created_at=record.created_at,
    )


@router.get(
    "/{partner_id}/composite-score",
    response_model=CompositeScoreResponse,
    dependencies=[Depends(require_internal)],
)
async def partner_composite_score(
    partner_id: uuid.UUID,
    db: DB,
) -> CompositeScoreResponse:
    """Get composite performance score for a partner."""
    data = await calculate_composite_score(db, partner_id)
    if not data:
        raise NotFoundException("Partner not found")
    return CompositeScoreResponse(**data)
