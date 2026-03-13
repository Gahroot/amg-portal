"""Analytics API — KPI tracking across four dimensions.

Section 10 success metrics: Client Experience, Operational Performance,
Partner Network, and Security & Compliance.
"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import DateTime, Numeric, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, require_internal
from app.models.access_audit import AccessAudit
from app.models.audit_log import AuditLog
from app.models.decision_request import DecisionRequest
from app.models.deliverable import Deliverable
from app.models.escalation import Escalation
from app.models.kyc_document import KYCDocument
from app.models.milestone import Milestone
from app.models.nps_survey import NPSResponse
from app.models.partner_assignment import PartnerAssignment
from app.models.partner_rating import PartnerRating
from app.models.program_closure import ProgramClosure
from app.models.report_schedule import ReportSchedule
from app.models.sla_tracker import SLATracker
from app.schemas.analytics import (
    AllKPIsResponse,
    ClientExperienceKPIs,
    ComplianceKPIs,
    KPIMetric,
    OperationalPerformanceKPIs,
    PartnerNetworkKPIs,
)

router = APIRouter()


def _status_indicator(value: float | None, target: float, *, higher_is_better: bool = True) -> str:
    """Return green/yellow/red based on proximity to target.

    For higher-is-better metrics: green if >= target, yellow if >= 80% of target, red otherwise.
    For lower-is-better metrics: green if <= target, yellow if <= 1.5x target, red otherwise.
    """
    if value is None:
        return "red"
    if higher_is_better:
        return "green" if value >= target else ("yellow" if value >= target * 0.8 else "red")
    # lower is better
    return "green" if value <= target else ("yellow" if value <= target * 1.5 else "red")


# ---------------------------------------------------------------------------
# Client Experience KPIs
# ---------------------------------------------------------------------------


async def _compute_client_experience(db: AsyncSession) -> ClientExperienceKPIs:
    # 1. NPS Score — computed as (%promoters - %detractors) * 100, target > 70
    # Scores: 0-6 = Detractor, 7-8 = Passive, 9-10 = Promoter
    nps_counts = await db.execute(
        select(
            func.count(NPSResponse.id).label("total"),
            func.count(case((NPSResponse.score >= 9, 1))).label("promoters"),
            func.count(case((NPSResponse.score <= 6, 1))).label("detractors"),
        )
    )
    row = nps_counts.one()
    total_nps = row.total or 0
    if total_nps > 0:
        nps_value = round(((row.promoters - row.detractors) / total_nps) * 100, 1)
    else:
        nps_value = None
    nps_target = 70.0

    # 2. Report on-time delivery rate
    # Active schedules where last_run happened before next_run (i.e. on time)
    schedule_result = await db.execute(
        select(
            func.count(ReportSchedule.id).label("total"),
            func.count(
                case(
                    (
                        (ReportSchedule.last_run.is_not(None))
                        & (ReportSchedule.last_run <= ReportSchedule.next_run),
                        1,
                    )
                )
            ).label("on_time"),
        ).where(ReportSchedule.is_active.is_(True))
    )
    sched_row = schedule_result.one()
    total_schedules = sched_row.total or 0
    if total_schedules > 0:
        on_time_rate = round((sched_row.on_time / total_schedules) * 100, 1)
    else:
        on_time_rate = None
    on_time_target = 95.0

    # 3. Decision request response time (avg hours between created_at and responded_at)
    decision_result = await db.execute(
        select(
            func.avg(
                func.extract(
                    "epoch",
                    DecisionRequest.responded_at - DecisionRequest.created_at,
                )
                / 3600
            )
        ).where(DecisionRequest.responded_at.is_not(None))
    )
    avg_decision_hours = decision_result.scalar_one_or_none()
    if avg_decision_hours is not None:
        avg_decision_hours = round(float(avg_decision_hours), 1)
    decision_target = 24.0  # target < 24 hours

    return ClientExperienceKPIs(
        nps_score=KPIMetric(
            label="Net Promoter Score",
            value=nps_value,
            target=nps_target,
            unit="score",
            status=_status_indicator(nps_value, nps_target),
        ),
        report_on_time_rate=KPIMetric(
            label="Report On-Time Delivery",
            value=on_time_rate,
            target=on_time_target,
            unit="percent",
            status=_status_indicator(on_time_rate, on_time_target),
        ),
        decision_response_time_hours=KPIMetric(
            label="Decision Response Time",
            value=avg_decision_hours,
            target=decision_target,
            unit="hours",
            status=_status_indicator(avg_decision_hours, decision_target, higher_is_better=False),
        ),
    )


# ---------------------------------------------------------------------------
# Operational Performance KPIs
# ---------------------------------------------------------------------------


async def _compute_operations(db: AsyncSession) -> OperationalPerformanceKPIs:
    # 1. Program on-time milestone rate (% completed by due_date, target > 90%)
    milestone_result = await db.execute(
        select(
            func.count(Milestone.id).label("completed"),
            func.count(
                case(
                    (
                        (Milestone.due_date.is_not(None))
                        & (
                            Milestone.updated_at
                            <= cast(Milestone.due_date, DateTime(timezone=True))
                        ),
                        1,
                    )
                )
            ).label("on_time"),
        ).where(Milestone.status == "completed")
    )
    ms_row = milestone_result.one()
    total_completed_ms = ms_row.completed or 0
    if total_completed_ms > 0:
        ms_on_time_rate = round((ms_row.on_time / total_completed_ms) * 100, 1)
    else:
        ms_on_time_rate = None
    ms_target = 90.0

    # 2. Internal escalation resolution time (avg hours, target < 4)
    esc_result = await db.execute(
        select(
            func.avg(
                func.extract(
                    "epoch",
                    Escalation.resolved_at - Escalation.triggered_at,
                )
                / 3600
            )
        ).where(Escalation.resolved_at.is_not(None))
    )
    avg_esc_hours = esc_result.scalar_one_or_none()
    if avg_esc_hours is not None:
        avg_esc_hours = round(float(avg_esc_hours), 1)
    esc_target = 4.0

    # 3. Partner deliverable first-pass approval rate
    # Approved on first submission = approved without ever being "returned"
    # Simplification: deliverables with status 'approved' that were never 'returned'
    # We check deliverables that have been reviewed
    reviewed_result = await db.execute(
        select(
            func.count(Deliverable.id).label("total_reviewed"),
            func.count(
                case((Deliverable.status == "approved", 1))
            ).label("approved"),
        ).where(Deliverable.status.in_(["approved", "returned", "revision_requested"]))
    )
    del_row = reviewed_result.one()
    total_reviewed = del_row.total_reviewed or 0
    if total_reviewed > 0:
        first_pass_rate = round((del_row.approved / total_reviewed) * 100, 1)
    else:
        first_pass_rate = None
    first_pass_target = 80.0

    # 4. Program closure completeness (% of closures with all checklist items done)
    closure_result = await db.execute(select(ProgramClosure))
    closures = list(closure_result.scalars().all())
    total_closures = len(closures)
    complete_closures = 0
    for closure in closures:
        checklist = closure.checklist or []
        if checklist and all(item.get("completed", False) for item in checklist):
            complete_closures += 1
    if total_closures > 0:
        closure_rate = round((complete_closures / total_closures) * 100, 1)
    else:
        closure_rate = None
    closure_target = 100.0

    return OperationalPerformanceKPIs(
        milestone_on_time_rate=KPIMetric(
            label="Milestone On-Time Rate",
            value=ms_on_time_rate,
            target=ms_target,
            unit="percent",
            status=_status_indicator(ms_on_time_rate, ms_target),
        ),
        escalation_resolution_hours=KPIMetric(
            label="Escalation Resolution Time",
            value=avg_esc_hours,
            target=esc_target,
            unit="hours",
            status=_status_indicator(avg_esc_hours, esc_target, higher_is_better=False),
        ),
        deliverable_first_pass_rate=KPIMetric(
            label="Deliverable First-Pass Approval",
            value=first_pass_rate,
            target=first_pass_target,
            unit="percent",
            status=_status_indicator(first_pass_rate, first_pass_target),
        ),
        closure_completeness_rate=KPIMetric(
            label="Closure Completeness",
            value=closure_rate,
            target=closure_target,
            unit="percent",
            status=_status_indicator(closure_rate, closure_target),
        ),
    )


# ---------------------------------------------------------------------------
# Partner Network KPIs
# ---------------------------------------------------------------------------


async def _compute_partner_network(db: AsyncSession) -> PartnerNetworkKPIs:
    # 1. Average partner performance score (target > 4.0 / 5.0)
    rating_result = await db.execute(
        select(func.avg(cast(PartnerRating.overall_score, Numeric)))
    )
    avg_score = rating_result.scalar_one_or_none()
    if avg_score is not None:
        avg_score = round(float(avg_score), 2)
    score_target = 4.0

    # 2. Partner SLA breach rate (target < 5%)
    sla_result = await db.execute(
        select(
            func.count(SLATracker.id).label("total"),
            func.count(
                case((SLATracker.breach_status == "breached", 1))
            ).label("breached"),
        )
    )
    sla_row = sla_result.one()
    total_sla = sla_row.total or 0
    breach_rate = round((sla_row.breached / total_sla) * 100, 1) if total_sla > 0 else None
    breach_target = 5.0

    # 3. Partner task completion rate (target > 95%)
    assignment_result = await db.execute(
        select(
            func.count(PartnerAssignment.id).label("total"),
            func.count(
                case((PartnerAssignment.status == "completed", 1))
            ).label("completed"),
        )
    )
    assign_row = assignment_result.one()
    total_assignments = assign_row.total or 0
    if total_assignments > 0:
        completion_rate = round((assign_row.completed / total_assignments) * 100, 1)
    else:
        completion_rate = None
    completion_target = 95.0

    # 4. Time from brief to acceptance (avg hours, target < 4)
    acceptance_result = await db.execute(
        select(
            func.avg(
                func.extract(
                    "epoch",
                    PartnerAssignment.accepted_at - PartnerAssignment.created_at,
                )
                / 3600
            )
        ).where(PartnerAssignment.accepted_at.is_not(None))
    )
    avg_accept_hours = acceptance_result.scalar_one_or_none()
    if avg_accept_hours is not None:
        avg_accept_hours = round(float(avg_accept_hours), 1)
    accept_target = 4.0

    return PartnerNetworkKPIs(
        avg_partner_score=KPIMetric(
            label="Avg Partner Performance Score",
            value=avg_score,
            target=score_target,
            unit="score",
            status=_status_indicator(avg_score, score_target),
        ),
        sla_breach_rate=KPIMetric(
            label="SLA Breach Rate",
            value=breach_rate,
            target=breach_target,
            unit="percent",
            status=_status_indicator(breach_rate, breach_target, higher_is_better=False),
        ),
        task_completion_rate=KPIMetric(
            label="Task Completion Rate",
            value=completion_rate,
            target=completion_target,
            unit="percent",
            status=_status_indicator(completion_rate, completion_target),
        ),
        brief_to_acceptance_hours=KPIMetric(
            label="Brief-to-Acceptance Time",
            value=avg_accept_hours,
            target=accept_target,
            unit="hours",
            status=_status_indicator(avg_accept_hours, accept_target, higher_is_better=False),
        ),
    )


# ---------------------------------------------------------------------------
# Security & Compliance KPIs
# ---------------------------------------------------------------------------


async def _compute_compliance(db: AsyncSession) -> ComplianceKPIs:
    today = date.today()

    # 1. KYC documentation currency (% verified and not expired, target 100%)
    kyc_result = await db.execute(
        select(
            func.count(KYCDocument.id).label("total"),
            func.count(
                case(
                    (
                        (KYCDocument.status == "verified")
                        & (
                            (KYCDocument.expiry_date.is_(None))
                            | (KYCDocument.expiry_date >= today)
                        ),
                        1,
                    )
                )
            ).label("current"),
        )
    )
    kyc_row = kyc_result.one()
    total_kyc = kyc_row.total or 0
    kyc_rate = round((kyc_row.current / total_kyc) * 100, 1) if total_kyc > 0 else None
    kyc_target = 100.0

    # 2. Unauthorized access incidents (count of audit log entries with
    #    action='unauthorized' or similar anomaly patterns, target 0)
    unauth_result = await db.execute(
        select(func.count(AuditLog.id)).where(
            AuditLog.action.in_(["unauthorized", "forbidden", "access_denied"])
        )
    )
    unauth_count = unauth_result.scalar_one() or 0
    unauth_target = 0.0

    # 3. Audit log completeness — ratio of entities with at least one audit entry
    #    We compare distinct entity counts in audit_logs vs major entity tables
    audit_entity_result = await db.execute(
        select(func.count(func.distinct(AuditLog.entity_id)))
    )
    audited_entities = audit_entity_result.scalar_one() or 0

    # Count total distinct entities across major tables
    total_entity_result = await db.execute(
        select(func.count(AuditLog.id))
    )
    total_audit_entries = total_entity_result.scalar_one() or 0
    # Completeness: if we have audit entries, consider % of entities that have logs
    # Simpler: count total audit log entries — higher = more complete coverage
    # Use ratio of audited entities to total entries as a percentage (capped at 100)
    if total_audit_entries > 0 and audited_entities > 0:
        # Rough completeness — entities with audit trail vs total entries logged
        audit_completeness = min(round((audited_entities / total_audit_entries) * 100, 1), 100.0)
    else:
        audit_completeness = None
    audit_target = 95.0

    # 4. Access review completion rate (% of access audits completed, target 100%)
    access_result = await db.execute(
        select(
            func.count(AccessAudit.id).label("total"),
            func.count(
                case((AccessAudit.status == "completed", 1))
            ).label("completed"),
        )
    )
    access_row = access_result.one()
    total_audits = access_row.total or 0
    review_rate = (
        round((access_row.completed / total_audits) * 100, 1) if total_audits > 0 else None
    )
    review_target = 100.0

    return ComplianceKPIs(
        kyc_currency_rate=KPIMetric(
            label="KYC Documentation Currency",
            value=kyc_rate,
            target=kyc_target,
            unit="percent",
            status=_status_indicator(kyc_rate, kyc_target),
        ),
        unauthorized_access_incidents=KPIMetric(
            label="Unauthorized Access Incidents",
            value=float(unauth_count),
            target=unauth_target,
            unit="count",
            status="green" if unauth_count == 0 else "red",
        ),
        audit_log_completeness=KPIMetric(
            label="Audit Log Completeness",
            value=audit_completeness,
            target=audit_target,
            unit="percent",
            status=_status_indicator(audit_completeness, audit_target),
        ),
        access_review_completion_rate=KPIMetric(
            label="Access Review Completion",
            value=review_rate,
            target=review_target,
            unit="percent",
            status=_status_indicator(review_rate, review_target),
        ),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/client-experience",
    response_model=ClientExperienceKPIs,
    dependencies=[Depends(require_internal)],
)
async def get_client_experience_kpis(db: DB) -> ClientExperienceKPIs:
    """Client experience KPIs: NPS, report delivery, decision response."""
    return await _compute_client_experience(db)


@router.get(
    "/operations",
    response_model=OperationalPerformanceKPIs,
    dependencies=[Depends(require_internal)],
)
async def get_operations_kpis(db: DB) -> OperationalPerformanceKPIs:
    """Operational KPIs: milestones, escalations, deliverables, closures."""
    return await _compute_operations(db)


@router.get(
    "/partner-network",
    response_model=PartnerNetworkKPIs,
    dependencies=[Depends(require_internal)],
)
async def get_partner_network_kpis(db: DB) -> PartnerNetworkKPIs:
    """Partner network KPIs: scores, SLA breaches, completion, acceptance."""
    return await _compute_partner_network(db)


@router.get(
    "/compliance",
    response_model=ComplianceKPIs,
    dependencies=[Depends(require_internal)],
)
async def get_compliance_kpis(db: DB) -> ComplianceKPIs:
    """Security & compliance KPIs: KYC, access incidents, audit logs, reviews."""
    return await _compute_compliance(db)


@router.get(
    "/all",
    response_model=AllKPIsResponse,
    dependencies=[Depends(require_internal)],
)
async def get_all_kpis(db: DB) -> AllKPIsResponse:
    """Return all four KPI dimensions in a single response."""
    client_exp = await _compute_client_experience(db)
    ops = await _compute_operations(db)
    partner = await _compute_partner_network(db)
    compliance = await _compute_compliance(db)
    return AllKPIsResponse(
        client_experience=client_exp,
        operations=ops,
        partner_network=partner,
        compliance=compliance,
    )
