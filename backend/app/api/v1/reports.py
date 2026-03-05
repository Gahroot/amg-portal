"""Report endpoints — client-facing reports with CSV export."""

import csv
import io
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api.deps import (
    DB,
    CurrentUser,
)
from app.api.v1.client_portal import require_client
from app.models.client import Client
from app.schemas.report import (
    AnnualReviewReport,
    CompletionReport,
    PortfolioOverviewReport,
    ProgramStatusReport,
)
from app.services.report_service import report_service

router = APIRouter()


async def get_client_id_from_user(db: DB, current_user: CurrentUser) -> uuid.UUID:
    """Get the client ID for a client user."""
    result = await db.execute(select(Client).where(Client.rm_id == current_user.id))
    client = result.scalar_one_or_none()
    if not client:
        # Also check if user has a client relationship via other means
        # For now, raise an error
        raise ValueError("Client profile not found")
    return client.id


@router.get(
    "/portfolio",
    response_model=PortfolioOverviewReport,
    dependencies=[Depends(require_client)],
)
async def get_portfolio_report(
    db: DB,
    current_user: CurrentUser,
):
    """
    Get portfolio overview report showing all client programs.

    Returns status breakdown, RAG summary, total budget, and milestone progress.
    """
    client_id = await get_client_id_from_user(db, current_user)
    report = await report_service.get_portfolio_overview(db, client_id)
    if not report:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return report


@router.get("/portfolio/export", dependencies=[Depends(require_client)])
async def export_portfolio_report_csv(
    db: DB,
    current_user: CurrentUser,
):
    """Export portfolio overview as CSV."""
    client_id = await get_client_id_from_user(db, current_user)
    report = await report_service.get_portfolio_overview(db, client_id)
    if not report:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

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
):
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
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    report = await report_service.get_program_status_report(db, program_id)
    if not report:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return report


@router.get("/program-status/export", dependencies=[Depends(require_client)])
async def export_program_status_report_csv(
    db: DB,
    current_user: CurrentUser,
    program_id: uuid.UUID = Query(..., description="Program ID"),
):
    """Export program status report as CSV."""
    client_id = await get_client_id_from_user(db, current_user)

    # Check program belongs to client
    from app.models.program import Program

    program_result = await db.execute(
        select(Program).where(Program.id == program_id, Program.client_id == client_id)
    )
    program = program_result.scalar_one_or_none()
    if not program:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    report = await report_service.get_program_status_report(db, program_id)
    if not report:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

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
):
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
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    report = await report_service.get_completion_report(db, program_id)
    if not report:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return report


@router.get("/completion/{program_id}/export", dependencies=[Depends(require_client)])
async def export_completion_report_csv(
    program_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Export completion report as CSV."""
    client_id = await get_client_id_from_user(db, current_user)

    # Check program belongs to client
    from app.models.program import Program

    program_result = await db.execute(
        select(Program).where(Program.id == program_id, Program.client_id == client_id)
    )
    program = program_result.scalar_one_or_none()
    if not program:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    report = await report_service.get_completion_report(db, program_id)
    if not report:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

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
):
    """
    Get annual relationship review across all programs.

    Includes programs by status, monthly breakdown, and partner performance.
    """
    client_id = await get_client_id_from_user(db, current_user)
    report = await report_service.get_annual_review(db, client_id, year)
    if not report:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return report


@router.get("/annual/{year}/export", dependencies=[Depends(require_client)])
async def export_annual_review_csv(
    year: int,
    db: DB,
    current_user: CurrentUser,
):
    """Export annual review as CSV."""
    client_id = await get_client_id_from_user(db, current_user)
    report = await report_service.get_annual_review(db, client_id, year)
    if not report:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

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
