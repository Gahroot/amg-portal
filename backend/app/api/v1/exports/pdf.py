"""PDF export endpoints for generating professional PDF exports of reports and data."""

import io
import uuid
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, require_rm_or_above
from app.core.exceptions import NotFoundException
from app.models.client_profile import ClientProfile
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.program import Program
from app.models.user import User
from app.services.pdf_export_service import PDFExportOptions, pdf_export_service

router = APIRouter()


class PDFExportRequest(BaseModel):
    """Request body for PDF export options."""

    orientation: str = Field(default="portrait", pattern="^(portrait|landscape)$")
    include_header: bool = Field(default=True)
    include_footer: bool = Field(default=True)
    include_timestamp: bool = Field(default=True)
    include_filters: bool = Field(default=False)
    page_size: str = Field(default="A4", pattern="^(A4|Letter|Legal)$")


class TableExportRequest(PDFExportRequest):
    """Request for exporting tabular data as PDF."""

    title: str = Field(min_length=1, max_length=200)
    headers: list[str] = Field(min_length=1)
    rows: list[list[Any]] = Field(default_factory=list)
    filters: dict[str, Any] | None = Field(default=None)
    summary: dict[str, Any] | None = Field(default=None)


# ---------------------------------------------------------------------------
# Generic table PDF export
# ---------------------------------------------------------------------------


@router.post("/table")
async def export_table_pdf(
    request: TableExportRequest,
    current_user: CurrentUser,
) -> StreamingResponse:
    """
    Export tabular data as a PDF.

    This endpoint accepts arbitrary table data and generates a formatted PDF.
    Useful for exporting filtered/sorted views from data tables.
    """
    options = PDFExportOptions(
        orientation=request.orientation,
        include_header=request.include_header,
        include_footer=request.include_footer,
        include_timestamp=request.include_timestamp,
        include_filters=request.include_filters,
        page_size=request.page_size,
    )

    pdf_bytes = await pdf_export_service.generate_table_pdf(
        title=request.title,
        headers=request.headers,
        rows=request.rows,
        options=options,
        filters=request.filters,
        summary=request.summary,
        user_name=current_user.full_name,
    )

    safe_title = request.title.replace(" ", "_").replace("/", "")[:50]
    filename = f"{safe_title}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Program Summary PDF
# ---------------------------------------------------------------------------


@router.get("/programs/{program_id}/summary")
async def export_program_summary_pdf(
    program_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    orientation: str = Query(default="portrait", pattern="^(portrait|landscape)$"),
    include_notes: bool = Query(default=True),
) -> StreamingResponse:
    """
    Export a program summary as a professional PDF.

    Includes program overview, timeline, budget, milestones, deliverables,
    and assigned partners.
    """
    # Fetch program with related data
    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones),
            selectinload(Program.partner_assignments).selectinload(
                PartnerAssignment.partner
            ),
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one_or_none()

    if not program:
        raise NotFoundException("Program not found")

    # Get RM name
    rm_name = None
    if program.client and program.client.rm_id:
        rm_result = await db.execute(
            select(User).where(User.id == program.client.rm_id)
        )
        rm = rm_result.scalar_one_or_none()
        rm_name = rm.full_name if rm else None

    # Build program data
    milestones = [
        {
            "title": m.title,
            "status": m.status,
            "due_date": str(m.due_date) if m.due_date else None,
            "completed_at": str(m.completed_at) if m.completed_at else None,
        }
        for m in (program.milestones or [])
    ]

    assigned_partners = [
        {
            "firm_name": pa.partner.firm_name if pa.partner else "Unknown",
            "contact_name": pa.partner.contact_name if pa.partner else "N/A",
            "contact_email": pa.partner.contact_email if pa.partner else "N/A",
            "status": pa.status,
        }
        for pa in (program.partner_assignments or [])
    ]

    # Calculate milestone progress
    total_milestones = len(milestones)
    completed_milestones = sum(1 for m in milestones if m["status"] == "completed")
    milestone_progress = (
        round((completed_milestones / total_milestones) * 100)
        if total_milestones > 0
        else 0
    )

    program_data = {
        "program_title": program.title,
        "program_status": program.status,
        "rag_status": getattr(program, "rag_status", "green"),
        "client_name": program.client.legal_name if program.client else "Unknown",
        "rm_name": rm_name,
        "start_date": str(program.start_date) if program.start_date else None,
        "end_date": str(program.end_date) if program.end_date else None,
        "created_at": program.created_at.strftime("%Y-%m-%d") if program.created_at else None,
        "updated_at": program.updated_at.strftime("%Y-%m-%d %H:%M") if program.updated_at else None,
        "budget_envelope": float(program.budget_envelope) if program.budget_envelope else None,
        "milestone_progress": milestone_progress,
        "milestones": milestones,
        "assigned_partners": assigned_partners,
        "objectives": getattr(program, "objectives", None),
        "scope": getattr(program, "scope", None),
        "notes": getattr(program, "notes", None) if include_notes else None,
    }

    options = PDFExportOptions(orientation=orientation)

    pdf_bytes = await pdf_export_service.generate_program_summary_pdf(
        program_data=program_data,
        options=options,
        user_name=current_user.full_name,
    )

    safe_title = program.title.replace(" ", "_").replace("/", "")[:30]
    filename = f"program_summary_{safe_title}_{datetime.now().strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Client Profile PDF
# ---------------------------------------------------------------------------


@router.get("/clients/{client_id}/profile")
async def export_client_profile_pdf(
    client_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    orientation: str = Query(default="portrait", pattern="^(portrait|landscape)$"),
    include_programs: bool = Query(default=True),
    include_family: bool = Query(default=True),
) -> StreamingResponse:
    """
    Export a client profile as a professional PDF.

    Includes contact information, relationship management details,
    program summary, and communication preferences.
    """
    # Fetch client profile
    result = await db.execute(
        select(ClientProfile)
        .where(ClientProfile.id == client_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise NotFoundException("Client profile not found")

    # Get RM name
    rm_name = None
    if profile.assigned_rm_id:
        rm_result = await db.execute(
            select(User).where(User.id == profile.assigned_rm_id)
        )
        rm = rm_result.scalar_one_or_none()
        rm_name = rm.full_name if rm else None

    # Get programs if requested
    programs = []
    total_programs = 0
    active_programs = 0
    completed_programs = 0

    if include_programs:
        from app.models.client import Client

        # Find matching client record
        client_result = await db.execute(
            select(Client).where(Client.name == profile.legal_name).limit(1)
        )
        client = client_result.scalar_one_or_none()

        if client:
            programs_result = await db.execute(
                select(Program)
                .where(Program.client_id == client.id)
                .order_by(Program.created_at.desc())
                .limit(10)
            )
            program_list = programs_result.scalars().all()

            programs = [
                {
                    "title": p.title,
                    "status": p.status,
                    "rag_status": getattr(p, "rag_status", "green"),
                    "start_date": str(p.start_date) if p.start_date else None,
                }
                for p in program_list
            ]

            total_programs = len(program_list)
            active_programs = sum(1 for p in program_list if p.status in ("active", "design"))
            completed_programs = sum(1 for p in program_list if p.status == "completed")

    # Get family members if requested
    family_members = []
    if include_family:
        from app.models.family_member import FamilyMember

        family_result = await db.execute(
            select(FamilyMember).where(FamilyMember.client_profile_id == client_id)
        )
        family_list = family_result.scalars().all()
        family_members = [
            {
                "name": fm.name,
                "relationship": fm.relationship_type or "N/A",
            }
            for fm in family_list
        ]

    client_data = {
        "legal_name": profile.legal_name,
        "display_name": profile.display_name,
        "entity_type": profile.entity_type,
        "jurisdiction": profile.jurisdiction,
        "compliance_status": profile.compliance_status,
        "primary_email": profile.primary_email,
        "secondary_email": profile.secondary_email,
        "phone": profile.phone,
        "address": profile.address,
        "rm_name": rm_name,
        "client_since": profile.created_at.strftime("%Y-%m-%d") if profile.created_at else None,
        "approval_status": profile.approval_status,
        "risk_profile": getattr(profile, "risk_profile", None),
        "family_members": family_members,
        "programs": programs,
        "total_programs": total_programs,
        "active_programs": active_programs,
        "completed_programs": completed_programs,
        "notes": getattr(profile, "notes", None),
    }

    options = PDFExportOptions(orientation=orientation)

    pdf_bytes = await pdf_export_service.generate_client_profile_pdf(
        client_data=client_data,
        options=options,
        user_name=current_user.full_name,
    )

    safe_name = profile.legal_name.replace(" ", "_").replace("/", "")[:30]
    filename = f"client_profile_{safe_name}_{datetime.now().strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Financial Report PDF
# ---------------------------------------------------------------------------


@router.get("/financial")
async def export_financial_report_pdf(
    db: DB,
    current_user: Annotated[User, Depends(require_rm_or_above)],
    orientation: str = Query(default="landscape", pattern="^(portrait|landscape)$"),
    year: int | None = Query(default=None, description="Filter by year"),
    program_id: uuid.UUID | None = Query(default=None, description="Filter by program"),
    client_id: uuid.UUID | None = Query(default=None, description="Filter by client"),
) -> StreamingResponse:
    """
    Export a financial report as a professional PDF.

    Includes budget overview, program costs, partner payments, and invoices.
    Requires RM or above role.
    """
    # Build financial data from database
    financial_data: dict[str, Any] = {
        "title": "Financial Report",
        "report_period": f"Year {year}" if year else "All Time",
        "summary": {},
        "budget_overview": [],
        "program_costs": [],
        "partner_payments": [],
    }

    # Get program financials
    program_query = select(Program)
    if program_id:
        program_query = program_query.where(Program.id == program_id)
    if client_id:
        program_query = program_query.where(Program.client_id == client_id)

    program_query = program_query.options(selectinload(Program.client))

    programs_result = await db.execute(program_query.order_by(Program.created_at.desc()))
    programs = programs_result.scalars().all()

    total_budget = 0.0
    total_spent = 0.0

    program_costs = []
    for p in programs:
        budget = float(p.budget_envelope) if p.budget_envelope else 0.0
        # For now, estimate spent based on milestone completion
        # In a real implementation, this would come from actuals
        spent = 0.0  # Would be calculated from actual expenses

        program_costs.append({
            "program_title": p.title,
            "client_name": p.client.legal_name if p.client else "Unknown",
            "budget": budget,
            "spent": spent,
            "remaining": budget - spent,
            "progress": 0,  # Would be calculated from actuals
        })

        total_budget += budget
        total_spent += spent

    financial_data["program_costs"] = program_costs
    financial_data["summary"] = {
        "Total Programs": len(programs),
        "Total Budget": f"${total_budget:,.2f}",
        "Total Spent": f"${total_spent:,.2f}",
        "Remaining": f"${total_budget - total_spent:,.2f}",
    }

    options = PDFExportOptions(orientation=orientation)

    pdf_bytes = await pdf_export_service.generate_financial_report_pdf(
        financial_data=financial_data,
        options=options,
        user_name=current_user.full_name,
    )

    filename = f"financial_report_{datetime.now().strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Partner Performance PDF
# ---------------------------------------------------------------------------


@router.get("/partners/{partner_id}/performance")
async def export_partner_performance_pdf(
    partner_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    orientation: str = Query(default="portrait", pattern="^(portrait|landscape)$"),
) -> StreamingResponse:
    """
    Export a partner performance report as a professional PDF.
    """
    # Fetch partner profile
    result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == partner_id)
    )
    partner = result.scalar_one_or_none()

    if not partner:
        raise NotFoundException("Partner not found")

    partner_data: dict[str, Any] = {
        "title": f"Partner Performance: {partner.firm_name}",
        "firm_name": partner.firm_name,
        "contact_name": partner.contact_name,
        "contact_email": partner.contact_email,
        "status": partner.status,
        "availability_status": partner.availability_status,
        "capabilities": partner.capabilities or [],
        "geographies": partner.geographies or [],
        "performance_rating": partner.performance_rating,
        "total_assignments": partner.total_assignments,
        "summary": {
            "Status": partner.status.title(),
            "Availability": (
                partner.availability_status.title()
                if partner.availability_status
                else "Unknown"
            ),
            "Rating": (
                f"{partner.performance_rating:.1f}"
                if partner.performance_rating
                else "N/A"
            ),
            "Total Assignments": partner.total_assignments,
        },
    }

    options = PDFExportOptions(orientation=orientation)

    pdf_bytes = await pdf_export_service.generate_table_pdf(
        title=partner_data["title"],
        headers=["Metric", "Value"],
        rows=[
            ["Firm Name", partner.firm_name],
            ["Contact Name", partner.contact_name],
            ["Contact Email", partner.contact_email or "N/A"],
            ["Status", partner.status.title()],
            [
                "Availability",
                (
                    partner.availability_status.title()
                    if partner.availability_status
                    else "Unknown"
                ),
            ],
            ["Capabilities", ", ".join(partner.capabilities or [])],
            ["Geographies", ", ".join(partner.geographies or [])],
            [
                "Performance Rating",
                (
                    f"{partner.performance_rating:.1f}"
                    if partner.performance_rating
                    else "N/A"
                ),
            ],
            ["Total Assignments", str(partner.total_assignments)],
        ],
        options=options,
        summary=partner_data["summary"],
        user_name=current_user.full_name,
    )

    safe_name = partner.firm_name.replace(" ", "_").replace("/", "")[:30]
    filename = f"partner_performance_{safe_name}_{datetime.now().strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
