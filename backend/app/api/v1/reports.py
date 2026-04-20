"""Report endpoints — client-facing reports with CSV and PDF export."""

import contextlib
import csv
import io
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api.deps import (
    DB,
    CurrentUser,
    require_client,
    require_compliance,
    require_internal,
    require_rm_or_above,
)
from app.core.exceptions import NotFoundException, ValidationException
from app.models.client import Client
from app.models.client_profile import ClientProfile
from app.models.enums import UserRole
from app.models.report_schedule import ReportSchedule
from app.schemas.report import (
    AnnualReviewReport,
    CompletionReport,
    ComplianceAuditReport,
    EscalationLogReport,
    PortfolioOverviewReport,
    ProgramStatusReport,
    RMPortfolioReport,
)
from app.schemas.report_schedule import (
    ReportScheduleCreate,
    ReportScheduleResponse,
    ReportScheduleUpdate,
)
from app.schemas.user import ReportFavoritesResponse
from app.services.pdf_service import pdf_service
from app.services.report_service import report_service

router = APIRouter()

# Valid report types that can be favorited
VALID_FAVORITE_REPORT_TYPES = {
    "rm_portfolio",
    "escalation_log",
    "compliance",
    "annual_review",
    "portfolio",
    "program_status",
    "completion",
    "partner_performance",
}


async def get_client_id_from_user(db: DB, current_user: CurrentUser) -> uuid.UUID:
    """Get the client ID for a client role user.

    Resolves: portal user → ClientProfile (via user_id) → Client (via legal_name + assigned_rm_id).
    """
    # Step 1: find the ClientProfile linked to this portal user
    profile_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Client profile not found for this user")

    # Step 2: find the Client record that corresponds to this profile
    client_query = select(Client).where(Client.name == profile.legal_name)
    if profile.assigned_rm_id is not None:
        client_query = client_query.where(Client.rm_id == profile.assigned_rm_id)
    client_result = await db.execute(client_query.limit(1))
    client = client_result.scalar_one_or_none()
    if not client:
        raise NotFoundException("Client record not found for this user")

    return client.id


@router.get(
    "/portfolio",
    response_model=PortfolioOverviewReport,
    dependencies=[Depends(require_client)],
)
async def get_portfolio_report(
    db: DB,
    current_user: CurrentUser,
) -> Any:
    """
    Get portfolio overview report showing all client programs.

    Returns status breakdown, RAG summary, total budget, and milestone progress.
    """
    client_id = await get_client_id_from_user(db, current_user)
    report = await report_service.get_portfolio_overview(db, client_id)
    if not report:
        raise NotFoundException("Client not found")
    return report


@router.get("/portfolio/export", dependencies=[Depends(require_client)])
async def export_portfolio_report_csv(
    db: DB,
    current_user: CurrentUser,
) -> Any:
    """Export portfolio overview as CSV."""
    client_id = await get_client_id_from_user(db, current_user)
    report = await report_service.get_portfolio_overview(db, client_id)
    if not report:
        raise NotFoundException("Client not found")

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(["Portfolio Overview Report"])
    writer.writerow([f"Client: {report['client_name']}"])
    writer.writerow([f"Generated: {report['generated_at']}"])
    writer.writerow([])

    # Summary
    writer.writerow(["Summary"])
    writer.writerow(["Total Programs", report["total_programs"]])
    writer.writerow(["Active Programs", report["active_programs"]])
    writer.writerow(["Completed Programs", report["completed_programs"]])
    writer.writerow(["Total Budget", report["total_budget"] or "N/A"])
    writer.writerow(["Overall Milestone Progress", f"{report['overall_milestone_progress']}%"])
    writer.writerow([])

    # Status breakdown
    writer.writerow(["Status Breakdown"])
    for status_val, count in report.get("status_breakdown", {}).items():
        writer.writerow([status_val, count])
    writer.writerow([])

    # RAG summary
    writer.writerow(["RAG Status Summary"])
    for rag_val, count in report.get("rag_summary", {}).items():
        writer.writerow([rag_val.upper(), count])
    writer.writerow([])

    # Programs
    writer.writerow(
        [
            "Program Title",
            "Status",
            "RAG Status",
            "Start Date",
            "End Date",
            "Budget",
            "Milestones",
            "Completed",
            "Progress (%)",
        ]
    )
    for prog in report["programs"]:
        writer.writerow(
            [
                prog["title"],
                prog["status"],
                prog["rag_status"],
                prog["start_date"] or "N/A",
                prog["end_date"] or "N/A",
                prog["budget_envelope"] or "N/A",
                prog["milestone_count"],
                prog["completed_milestone_count"],
                f"{prog['milestone_progress']}%",
            ]
        )

    output.seek(0)
    filename = f"portfolio_overview_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/program-status",
    response_model=ProgramStatusReport,
    dependencies=[Depends(require_client)],
)
async def get_program_status_report_endpoint(
    db: DB,
    current_user: CurrentUser,
    program_id: uuid.UUID = Query(..., description="Program ID"),
) -> Any:
    """
    Get program status report showing active milestones,
    completed deliverables, and pending decisions.
    """
    # Verify the user has access to this program
    client_id = await get_client_id_from_user(db, current_user)

    # Check program belongs to client
    from app.models.program import Program

    program_result = await db.execute(
        select(Program).where(Program.id == program_id, Program.client_id == client_id)
    )
    program = program_result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    report = await report_service.get_program_status_report(db, program_id)
    if not report:
        raise NotFoundException("Program not found")
    return report


@router.get("/program-status/export", dependencies=[Depends(require_client)])
async def export_program_status_report_csv(
    db: DB,
    current_user: CurrentUser,
    program_id: uuid.UUID = Query(..., description="Program ID"),
) -> Any:
    """Export program status report as CSV."""
    client_id = await get_client_id_from_user(db, current_user)

    # Check program belongs to client
    from app.models.program import Program

    program_result = await db.execute(
        select(Program).where(Program.id == program_id, Program.client_id == client_id)
    )
    program = program_result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    report = await report_service.get_program_status_report(db, program_id)
    if not report:
        raise NotFoundException("Program not found")

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(["Program Status Report"])
    writer.writerow([f"Program: {report['program_title']}"])
    writer.writerow([f"Status: {report['program_status']}"])
    writer.writerow([f"RAG: {report['rag_status'].upper()}"])
    writer.writerow([f"Generated: {report['generated_at']}"])
    writer.writerow([])

    # Active Milestones
    writer.writerow(["Active Milestones"])
    writer.writerow(["Title", "Description", "Due Date", "Status"])
    for m in report["active_milestones"]:
        writer.writerow([m["title"], m["description"] or "", m["due_date"] or "N/A", m["status"]])
    writer.writerow([])

    # Completed Deliverables
    writer.writerow(["Completed Deliverables"])
    writer.writerow(["Title", "Type", "Due Date", "Status", "Submitted", "Reviewed"])
    for d in report["completed_deliverables"]:
        writer.writerow(
            [
                d["title"],
                d["deliverable_type"],
                d["due_date"] or "N/A",
                d["status"],
                d["submitted_at"] or "N/A",
                d["reviewed_at"] or "N/A",
            ]
        )
    writer.writerow([])

    # Pending Decisions
    writer.writerow(["Pending Decisions"])
    writer.writerow(["Title", "Description", "Requested At"])
    for decision in report["pending_decisions"]:
        writer.writerow(
            [
                decision["title"],
                decision["description"] or "",
                decision["requested_at"],
            ]
        )
    writer.writerow([])

    # Assigned Partners
    writer.writerow(["Assigned Partners"])
    writer.writerow(["Firm", "Contact", "Email"])
    for partner in report["assigned_partners"]:
        writer.writerow([partner["firm_name"], partner["contact_name"], partner["contact_email"]])

    output.seek(0)
    safe_title = report["program_title"].replace(" ", "_").replace("/", "")[:30]
    filename = f"program_status_{safe_title}_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/completion/{program_id}",
    response_model=CompletionReport,
    dependencies=[Depends(require_client)],
)
async def get_completion_report_endpoint(
    program_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> Any:
    """
    Get program completion report showing outcomes,
    timeline adherence, and deliverables summary.
    """
    client_id = await get_client_id_from_user(db, current_user)

    # Check program belongs to client
    from app.models.program import Program

    program_result = await db.execute(
        select(Program).where(Program.id == program_id, Program.client_id == client_id)
    )
    program = program_result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    report = await report_service.get_completion_report(db, program_id)
    if not report:
        raise NotFoundException("Program not found")
    return report


@router.get("/completion/{program_id}/export", dependencies=[Depends(require_client)])
async def export_completion_report_csv(
    program_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> Any:
    """Export completion report as CSV."""
    client_id = await get_client_id_from_user(db, current_user)

    # Check program belongs to client
    from app.models.program import Program

    program_result = await db.execute(
        select(Program).where(Program.id == program_id, Program.client_id == client_id)
    )
    program = program_result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    report = await report_service.get_completion_report(db, program_id)
    if not report:
        raise NotFoundException("Program not found")

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(["Program Completion Report"])
    writer.writerow([f"Program: {report['program_title']}"])
    writer.writerow([f"Client: {report['client_name']}"])
    writer.writerow([f"Generated: {report['generated_at']}"])
    writer.writerow([])

    # Objectives & Scope
    writer.writerow(["Objectives & Scope"])
    writer.writerow(["Objectives", report["objectives"] or "N/A"])
    writer.writerow(["Scope", report["scope"] or "N/A"])
    writer.writerow([])

    # Timeline
    writer.writerow(["Timeline"])
    writer.writerow(["Planned Start", report["planned_start_date"] or "N/A"])
    writer.writerow(["Planned End", report["planned_end_date"] or "N/A"])
    writer.writerow(["Actual Start", report["actual_start_date"]])
    writer.writerow(["Actual End", report["actual_end_date"] or "N/A"])
    writer.writerow(["Timeline Adherence", report["timeline_adherence"] or "N/A"])
    writer.writerow([])

    # Budget
    writer.writerow(["Budget"])
    writer.writerow(["Planned Budget", report["planned_budget"] or "N/A"])
    writer.writerow(["Actual Budget", report["actual_budget"] or "N/A"])
    writer.writerow([])

    # Milestones
    writer.writerow(["Milestones"])
    writer.writerow(["Title", "Planned Due Date", "Actual Completed", "Status", "On Time"])
    for m in report["milestone_timeline"]:
        writer.writerow(
            [
                m["title"],
                m["planned_due_date"] or "N/A",
                m["actual_completed_at"] or "N/A",
                m["status"],
                "Yes" if m["on_time"] else "No" if m["on_time"] is not None else "N/A",
            ]
        )
    writer.writerow([])

    # Deliverables
    writer.writerow(["Deliverables"])
    writer.writerow(["Title", "Type", "Due Date", "Status"])
    for d in report["deliverables"]:
        writer.writerow([d["title"], d["deliverable_type"], d["due_date"] or "N/A", d["status"]])

    output.seek(0)
    safe_title = report["program_title"].replace(" ", "_").replace("/", "")[:30]
    filename = f"completion_{safe_title}_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/annual/{year}",
    response_model=AnnualReviewReport,
    dependencies=[Depends(require_client)],
)
async def get_annual_review_endpoint(
    year: int,
    db: DB,
    current_user: CurrentUser,
) -> Any:
    """
    Get annual relationship review across all programs.

    Includes programs by status, monthly breakdown, and partner performance.
    """
    client_id = await get_client_id_from_user(db, current_user)
    report = await report_service.get_annual_review(db, client_id, year)
    if not report:
        raise NotFoundException("Client not found")
    return report


@router.get("/annual/{year}/export", dependencies=[Depends(require_client)])
async def export_annual_review_csv(
    year: int,
    db: DB,
    current_user: CurrentUser,
) -> Any:
    """Export annual review as CSV."""
    client_id = await get_client_id_from_user(db, current_user)
    report = await report_service.get_annual_review(db, client_id, year)
    if not report:
        raise NotFoundException("Client not found")

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([f"Annual Relationship Review — {year}"])
    writer.writerow([f"Client: {report['client_name']}"])
    writer.writerow([f"Generated: {report['generated_at']}"])
    writer.writerow([])

    # Summary
    writer.writerow(["Summary"])
    writer.writerow(["Total Programs", report["total_programs"]])
    writer.writerow(["New Programs", report["new_programs"]])
    writer.writerow(["Completed Programs", report["completed_programs"]])
    writer.writerow(["Active Programs", report["active_programs"]])
    writer.writerow(["Total Engagement Value", report["total_engagement_value"] or "N/A"])
    writer.writerow([])

    # Status breakdown
    writer.writerow(["Programs by Status"])
    for status_val, count in report.get("programs_by_status", {}).items():
        writer.writerow([status_val, count])
    writer.writerow([])

    # Monthly breakdown
    writer.writerow(["Programs by Month"])
    writer.writerow(["Month", "New Programs", "Completed Programs"])
    for month_data in report["programs_by_month"]:
        if month_data["new_programs"] > 0 or month_data["completed_programs"] > 0:
            writer.writerow(
                [
                    month_data["month_name"],
                    month_data["new_programs"],
                    month_data["completed_programs"],
                ]
            )
    writer.writerow([])

    # Partner performance
    writer.writerow(["Partner Performance"])
    writer.writerow(["Firm", "Assignments", "Completed", "Avg Rating"])
    for partner in report["partner_performance"]:
        writer.writerow(
            [
                partner["firm_name"],
                partner["total_assignments"],
                partner["completed_assignments"],
                partner["avg_performance_rating"] or "N/A",
            ]
        )
    writer.writerow([])

    # All programs
    writer.writerow(["All Programs"])
    writer.writerow(["Title", "Status", "Start Date", "End Date", "Budget", "RAG"])
    for prog in report["programs"]:
        writer.writerow(
            [
                prog["title"],
                prog["status"],
                prog["start_date"] or "N/A",
                prog["end_date"] or "N/A",
                prog["budget_envelope"] or "N/A",
                prog["rag_status"],
            ]
        )

    output.seek(0)
    filename = f"annual_review_{year}_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# PDF export endpoints
# ---------------------------------------------------------------------------


@router.get("/portfolio/pdf", dependencies=[Depends(require_client)])
async def export_portfolio_report_pdf(
    db: DB,
    current_user: CurrentUser,
) -> StreamingResponse:
    """Export portfolio overview as PDF."""
    client_id = await get_client_id_from_user(db, current_user)
    report = await report_service.get_portfolio_overview(db, client_id)
    if not report:
        raise NotFoundException("Client not found")

    pdf_bytes = await pdf_service.generate_portfolio_pdf(report)
    filename = f"portfolio_overview_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
        },
    )


@router.get("/program-status/pdf", dependencies=[Depends(require_client)])
async def export_program_status_report_pdf(
    db: DB,
    current_user: CurrentUser,
    program_id: uuid.UUID = Query(..., description="Program ID"),
) -> StreamingResponse:
    """Export program status report as PDF."""
    client_id = await get_client_id_from_user(db, current_user)

    from app.models.program import Program

    program_result = await db.execute(
        select(Program).where(Program.id == program_id, Program.client_id == client_id)
    )
    program = program_result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    report = await report_service.get_program_status_report(db, program_id)
    if not report:
        raise NotFoundException("Program not found")

    pdf_bytes = await pdf_service.generate_program_status_pdf(report)
    safe_title = report["program_title"].replace(" ", "_").replace("/", "")[:30]
    filename = f"program_status_{safe_title}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
        },
    )


@router.get(
    "/completion/{program_id}/pdf",
    dependencies=[Depends(require_client)],
)
async def export_completion_report_pdf(
    program_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> StreamingResponse:
    """Export completion report as PDF."""
    client_id = await get_client_id_from_user(db, current_user)

    from app.models.program import Program

    program_result = await db.execute(
        select(Program).where(Program.id == program_id, Program.client_id == client_id)
    )
    program = program_result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

    report = await report_service.get_completion_report(db, program_id)
    if not report:
        raise NotFoundException("Program not found")

    pdf_bytes = await pdf_service.generate_completion_pdf(report)
    safe_title = report["program_title"].replace(" ", "_").replace("/", "")[:30]
    filename = f"completion_{safe_title}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
        },
    )


@router.get("/annual/{year}/pdf", dependencies=[Depends(require_client)])
async def export_annual_review_pdf(
    year: int,
    db: DB,
    current_user: CurrentUser,
) -> StreamingResponse:
    """Export annual review as PDF."""
    client_id = await get_client_id_from_user(db, current_user)
    report = await report_service.get_annual_review(db, client_id, year)
    if not report:
        raise NotFoundException("Client not found")

    pdf_bytes = await pdf_service.generate_annual_review_pdf(report)
    filename = f"annual_review_{year}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
        },
    )


# ---------------------------------------------------------------------------
# Report scheduling endpoints
# ---------------------------------------------------------------------------

VALID_REPORT_TYPES = {
    "portfolio",
    "program_status",
    "completion",
    "annual_review",
    "partner_performance",
}
VALID_FREQUENCIES = {"daily", "weekly", "monthly", "quarterly"}
VALID_FORMATS = {"pdf", "csv"}


def _calculate_initial_next_run(frequency: str) -> datetime:
    """Calculate the first next_run based on frequency."""
    now = datetime.now(UTC)
    if frequency == "daily":
        # Tomorrow at 06:00 UTC
        tomorrow = now + timedelta(days=1)
        return tomorrow.replace(hour=6, minute=0, second=0, microsecond=0)
    elif frequency == "weekly":
        # Next Monday at 06:00 UTC
        days_ahead = 7 - now.weekday()  # Monday = 0
        if days_ahead <= 0:
            days_ahead += 7
        next_monday = now + timedelta(days=days_ahead)
        return next_monday.replace(hour=6, minute=0, second=0, microsecond=0)
    elif frequency == "monthly":
        # 1st of next month at 06:00 UTC
        if now.month == 12:
            return now.replace(
                year=now.year + 1,
                month=1,
                day=1,
                hour=6,
                minute=0,
                second=0,
                microsecond=0,
            )
        return now.replace(
            month=now.month + 1,
            day=1,
            hour=6,
            minute=0,
            second=0,
            microsecond=0,
        )
    elif frequency == "quarterly":
        # 1st of next quarter at 06:00 UTC
        quarter_start_months = [1, 4, 7, 10]
        current_quarter_idx = (now.month - 1) // 3
        next_quarter_idx = (current_quarter_idx + 1) % 4
        next_quarter_month = quarter_start_months[next_quarter_idx]
        next_year = now.year if next_quarter_idx > 0 else now.year + 1
        return now.replace(
            year=next_year,
            month=next_quarter_month,
            day=1,
            hour=6,
            minute=0,
            second=0,
            microsecond=0,
        )
    # Fallback: tomorrow
    tomorrow = now + timedelta(days=1)
    return tomorrow.replace(hour=6, minute=0, second=0, microsecond=0)


@router.post(
    "/schedules",
    response_model=ReportScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal)],
)
async def create_report_schedule(
    body: ReportScheduleCreate,
    db: DB,
    current_user: CurrentUser,
) -> ReportSchedule:
    """Create a new report schedule."""
    if body.report_type not in VALID_REPORT_TYPES:
        raise ValidationException(
            f"Invalid report_type. Must be one of: {', '.join(sorted(VALID_REPORT_TYPES))}"
        )
    if body.frequency not in VALID_FREQUENCIES:
        raise ValidationException(
            f"Invalid frequency. Must be one of: {', '.join(sorted(VALID_FREQUENCIES))}"
        )
    if body.format not in VALID_FORMATS:
        raise ValidationException(
            f"Invalid format. Must be one of: {', '.join(sorted(VALID_FORMATS))}"
        )

    schedule = ReportSchedule(
        report_type=body.report_type,
        entity_id=body.entity_id,
        frequency=body.frequency,
        next_run=_calculate_initial_next_run(body.frequency),
        recipients=body.recipients,
        format=body.format,
        created_by=current_user.id,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.get(
    "/schedules",
    response_model=list[ReportScheduleResponse],
    dependencies=[Depends(require_internal)],
)
async def list_report_schedules(
    db: DB,
    current_user: CurrentUser,
) -> list[ReportSchedule]:
    """List all report schedules."""
    result = await db.execute(select(ReportSchedule).order_by(ReportSchedule.created_at.desc()))
    return list(result.scalars().all())


@router.patch(
    "/schedules/{schedule_id}",
    response_model=ReportScheduleResponse,
    dependencies=[Depends(require_internal)],
)
async def update_report_schedule(
    schedule_id: uuid.UUID,
    body: ReportScheduleUpdate,
    db: DB,
    current_user: CurrentUser,
) -> ReportSchedule:
    """Update a report schedule."""
    result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise NotFoundException("Schedule not found")

    if body.frequency is not None:
        if body.frequency not in VALID_FREQUENCIES:
            raise ValidationException(
                f"Invalid frequency. Must be one of: {', '.join(sorted(VALID_FREQUENCIES))}"
            )
        schedule.frequency = body.frequency
        schedule.next_run = _calculate_initial_next_run(body.frequency)
    if body.recipients is not None:
        schedule.recipients = body.recipients
    if body.format is not None:
        if body.format not in VALID_FORMATS:
            raise ValidationException(
                f"Invalid format. Must be one of: {', '.join(sorted(VALID_FORMATS))}"
            )
        schedule.format = body.format
    if body.is_active is not None:
        schedule.is_active = body.is_active

    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.delete(
    "/schedules/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_internal)],
)
async def delete_report_schedule(
    schedule_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> None:
    """Delete a report schedule."""
    result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise NotFoundException("Schedule not found")

    await db.delete(schedule)
    await db.commit()


@router.post(
    "/schedules/{schedule_id}/execute",
    response_model=ReportScheduleResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def execute_report_schedule(
    schedule_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> ReportSchedule:
    """Manually trigger execution of a report schedule."""
    from app.services.email_service import send_email_with_attachment
    from app.services.report_generator_service import (
        _generate_attachment_bytes,
        _get_report_data,
        generate_report_for_schedule,
    )

    result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise NotFoundException("Schedule not found")

    doc = await generate_report_for_schedule(db, schedule)
    if doc is None:
        raise ValidationException(
            "Could not generate report — no data available for this schedule."
        )

    now = datetime.now(UTC)
    schedule.last_run = now
    schedule.last_generated_document_id = doc.id
    await db.commit()
    await db.refresh(schedule)

    # Email the report to recipients in background (best-effort)
    report_data = await _get_report_data(schedule, db)
    if report_data:
        attachment_bytes = await _generate_attachment_bytes(schedule, report_data)
        ext = schedule.format or "pdf"
        content_type = "application/pdf" if ext == "pdf" else "text/csv"
        subject = f"AMG Portal — Scheduled Report: {schedule.report_type.replace('_', ' ').title()}"
        body_html = (
            "<html><body>"
            "<h2>Scheduled Report</h2>"
            "<p>Please find your scheduled "
            f"{schedule.report_type.replace('_', ' ')} "
            "report attached.</p>"
            "<p>Best regards,<br>AMG Portal</p>"
            "</body></html>"
        )
        recipients: list[str] = schedule.recipients or []
        for recipient in recipients:
            with contextlib.suppress(Exception):
                await send_email_with_attachment(
                    to=recipient,
                    subject=subject,
                    body_html=body_html,
                    attachment=attachment_bytes,
                    attachment_filename=str(doc.file_name),
                    attachment_content_type=content_type,
                )

    return schedule


# ---------------------------------------------------------------------------
# Class B — Internal operational reports
# ---------------------------------------------------------------------------


@router.get(
    "/rm-portfolio",
    response_model=RMPortfolioReport,
    dependencies=[Depends(require_rm_or_above)],
)
async def get_rm_portfolio_report_endpoint(
    db: DB,
    current_user: CurrentUser,
    rm_id: uuid.UUID | None = Query(None, description="RM User ID (MD only; omit to use own)"),
) -> dict[str, Any]:
    """
    RM portfolio report for MD review.

    RMs always see their own portfolio. MDs may pass rm_id to view any RM's portfolio.
    """
    if current_user.role == UserRole.relationship_manager.value:
        effective_rm_id = current_user.id
    elif rm_id is not None:
        effective_rm_id = rm_id
    else:
        effective_rm_id = current_user.id

    report = await report_service.get_rm_portfolio_report(db, effective_rm_id)
    if not report:
        raise NotFoundException("RM not found")
    return report


@router.get(
    "/escalation-log",
    response_model=EscalationLogReport,
    dependencies=[Depends(require_internal)],
)
async def get_escalation_log_report_endpoint(
    db: DB,
    current_user: CurrentUser,
    program_id: uuid.UUID | None = Query(None, description="Filter by program"),
    client_id: uuid.UUID | None = Query(None, description="Filter by client"),
    level: str | None = Query(None, description="Filter by escalation level"),
    esc_status: str | None = Query(None, alias="status", description="Filter by status"),
) -> dict[str, Any]:
    """
    Escalation log report with age, owner, and resolution metrics.

    Filterable by program, client, level, and status.
    """
    report = await report_service.get_escalation_log_report(
        db,
        program_id=program_id,
        client_id=client_id,
        level=level,
        status_filter=esc_status,
    )
    return report


@router.get(
    "/compliance",
    response_model=ComplianceAuditReport,
    dependencies=[Depends(require_compliance)],
)
async def get_compliance_audit_report_endpoint(
    db: DB,
    current_user: CurrentUser,
    start_date: date | None = Query(
        None, description="Filter records created on or after this date (YYYY-MM-DD)"
    ),
    end_date: date | None = Query(
        None, description="Filter records created on or before this date (YYYY-MM-DD)"
    ),
) -> dict[str, Any]:
    """
    Compliance audit report covering KYC status, access anomalies, and user accounts.

    Accessible by finance_compliance and managing_director roles only.

    Optional ``start_date`` / ``end_date`` query parameters restrict all record
    fetches to rows created within the given date range.
    """
    report = await report_service.get_compliance_audit_report(
        db,
        start_date=start_date,
        end_date=end_date,
    )
    return report


# ---------------------------------------------------------------------------
# Report favorites endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/favorites",
    response_model=ReportFavoritesResponse,
)
async def get_report_favorites(
    current_user: CurrentUser,
) -> ReportFavoritesResponse:
    """Get the current user's favorite report types."""
    return ReportFavoritesResponse(favorites=list(current_user.report_favorites or []))


@router.post(
    "/favorites/{report_type}",
    response_model=ReportFavoritesResponse,
    status_code=status.HTTP_200_OK,
)
async def add_report_favorite(
    report_type: str,
    db: DB,
    current_user: CurrentUser,
) -> ReportFavoritesResponse:
    """Add a report type to the current user's favorites."""
    if report_type not in VALID_FAVORITE_REPORT_TYPES:
        raise ValidationException(
            f"Invalid report_type. Must be one of: {', '.join(sorted(VALID_FAVORITE_REPORT_TYPES))}"
        )
    favorites = list(current_user.report_favorites or [])
    if report_type not in favorites:
        favorites.append(report_type)
        current_user.report_favorites = favorites
        await db.commit()
        await db.refresh(current_user)
    return ReportFavoritesResponse(favorites=list(current_user.report_favorites or []))


@router.delete(
    "/favorites/{report_type}",
    response_model=ReportFavoritesResponse,
    status_code=status.HTTP_200_OK,
)
async def remove_report_favorite(
    report_type: str,
    db: DB,
    current_user: CurrentUser,
) -> ReportFavoritesResponse:
    """Remove a report type from the current user's favorites."""
    favorites = list(current_user.report_favorites or [])
    if report_type in favorites:
        favorites.remove(report_type)
        current_user.report_favorites = favorites
        await db.commit()
        await db.refresh(current_user)
    return ReportFavoritesResponse(favorites=list(current_user.report_favorites or []))
