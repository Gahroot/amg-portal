"""Generic data export endpoint — returns CSV or XLSX for any resource."""

import csv
import io
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, RLSContext, require_internal
from app.core.exceptions import NotFoundException
from app.models.client_profile import ClientProfile
from app.models.communication import Communication
from app.models.communication_log import CommunicationLog
from app.models.deliverable import Deliverable
from app.models.document import Document
from app.models.escalation import Escalation
from app.models.milestone import Milestone
from app.models.partner import PartnerProfile
from app.models.program import Program
from app.models.task import Task
from app.models.user import User

router = APIRouter()

_SUPPORTED = {
    "programs",
    "clients",
    "partners",
    "tasks",
    "communication_logs",
    "communications",
    "documents",
    "deliverables",
    "escalations",
}


def _escape_xml(value: object) -> str:
    s = "" if value is None else str(value)
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _build_xlsx(headers: list[str], rows: list[list[object]]) -> str:
    def cell(v: object) -> str:
        return f'<Cell><Data ss:Type="String">{_escape_xml(v)}</Data></Cell>'

    def make_row(cells: list[str], style: str = "") -> str:
        attr = f' ss:StyleID="{style}"' if style else ""
        return f"<Row{attr}>{''.join(cells)}</Row>"

    header_row = make_row([cell(h) for h in headers], "header")
    data_rows = [make_row([cell(v) for v in r]) for r in rows]

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<?mso-application progid="Excel.Sheet"?>\n'
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n'
        '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n'
        "  <Styles>\n"
        '    <Style ss:ID="header"><Font ss:Bold="1"/></Style>\n'
        "  </Styles>\n"
        '  <Worksheet ss:Name="Export">\n'
        "    <Table>\n"
        f"      {header_row}\n" + "".join(f"      {r}\n" for r in data_rows) + "    </Table>\n"
        "  </Worksheet>\n"
        "</Workbook>"
    )


def _csv_response(headers: list[str], rows: list[list[object]], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    buf.write("\ufeff")  # BOM for Excel UTF-8
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )


def _xlsx_response(
    headers: list[str], rows: list[list[object]], filename: str
) -> StreamingResponse:
    content = _build_xlsx(headers, rows)
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.ms-excel",
        headers={"Content-Disposition": f'attachment; filename="{filename}.xls"'},
    )


async def _export_programs(
    db: DB,
    *,
    status: str | None,
    client_id: uuid.UUID | None,
    search: str | None,
    limit: int,
) -> tuple[list[str], list[list[object]]]:
    query = select(Program).options(selectinload(Program.client))
    if status:
        query = query.where(Program.status == status)
    if client_id:
        query = query.where(Program.client_id == client_id)
    if search:
        query = query.where(Program.title.ilike(f"%{search}%"))
    result = await db.execute(query.order_by(Program.created_at.desc()).limit(limit))
    programs = result.scalars().unique().all()
    headers = [
        "Title",
        "Client",
        "Status",
        "RAG Status",
        "Start Date",
        "End Date",
        "Budget",
        "Created",
    ]
    rows: list[list[object]] = [
        [
            p.title,
            p.client.legal_name if p.client else "",
            p.status,
            getattr(p, "rag_status", ""),
            str(p.start_date) if p.start_date else "",
            str(p.end_date) if p.end_date else "",
            str(p.budget_envelope) if p.budget_envelope else "",
            p.created_at.strftime("%Y-%m-%d") if p.created_at else "",
        ]
        for p in programs
    ]
    return headers, rows


async def _export_clients(
    db: DB,
    *,
    status: str | None,
    search: str | None,
    limit: int,
) -> tuple[list[str], list[list[object]]]:
    query = select(ClientProfile)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            ClientProfile.legal_name.ilike(pattern) | ClientProfile.primary_email.ilike(pattern)
        )
    if status:
        query = query.where(ClientProfile.compliance_status == status)
    result = await db.execute(query.order_by(ClientProfile.created_at.desc()).limit(limit))
    profiles = result.scalars().all()
    headers = [
        "Legal Name",
        "Display Name",
        "Entity Type",
        "Jurisdiction",
        "Primary Email",
        "Compliance Status",
        "Approval Status",
        "Created",
    ]
    rows: list[list[object]] = [
        [
            p.legal_name,
            p.display_name or "",
            p.entity_type or "",
            p.jurisdiction or "",
            p.primary_email,
            p.compliance_status,
            p.approval_status,
            p.created_at.strftime("%Y-%m-%d") if p.created_at else "",
        ]
        for p in profiles
    ]
    return headers, rows


async def _export_partners(
    db: DB,
    *,
    status: str | None,
    availability: str | None,
    search: str | None,
    limit: int,
) -> tuple[list[str], list[list[object]]]:
    query = select(PartnerProfile)
    if status:
        query = query.where(PartnerProfile.status == status)
    if availability:
        query = query.where(PartnerProfile.availability_status == availability)
    if search:
        query = query.where(
            PartnerProfile.firm_name.ilike(f"%{search}%")
            | PartnerProfile.contact_name.ilike(f"%{search}%")
        )
    result = await db.execute(query.order_by(PartnerProfile.firm_name).limit(limit))
    partners = result.scalars().all()
    headers = [
        "Firm Name",
        "Contact Name",
        "Contact Email",
        "Status",
        "Availability",
        "Capabilities",
        "Geographies",
        "Rating",
        "Total Assignments",
        "Created",
    ]
    rows: list[list[object]] = [
        [
            p.firm_name,
            p.contact_name,
            p.contact_email,
            p.status,
            p.availability_status,
            ", ".join(p.capabilities or []),
            ", ".join(p.geographies or []),
            str(p.performance_rating) if p.performance_rating else "",
            str(p.total_assignments),
            p.created_at.strftime("%Y-%m-%d") if p.created_at else "",
        ]
        for p in partners
    ]
    return headers, rows


async def _export_tasks(
    db: DB,
    *,
    status: str | None,
    priority: str | None,
    assignee_id: uuid.UUID | None,
    program_id: uuid.UUID | None,
    limit: int,
) -> tuple[list[str], list[list[object]]]:
    query = (
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.milestone).selectinload(Milestone.program),
        )
        .join(Milestone, Task.milestone_id == Milestone.id)
        .join(Program, Milestone.program_id == Program.id)
    )
    if status:
        query = query.where(Task.status == status)
    if priority:
        query = query.where(Task.priority == priority)
    if assignee_id:
        query = query.where(Task.assigned_to == assignee_id)
    if program_id:
        query = query.where(Program.id == program_id)
    result = await db.execute(query.order_by(Task.due_date.asc().nullsfirst()).limit(limit))
    tasks = result.scalars().unique().all()
    headers = [
        "Title",
        "Status",
        "Priority",
        "Due Date",
        "Assigned To",
        "Program",
        "Milestone",
        "Created",
    ]
    rows: list[list[object]] = [
        [
            t.title,
            t.status,
            t.priority,
            str(t.due_date) if t.due_date else "",
            t.assignee.full_name if t.assignee else "",
            (t.milestone.program.title if t.milestone and t.milestone.program else ""),
            t.milestone.title if t.milestone else "",
            t.created_at.strftime("%Y-%m-%d") if t.created_at else "",
        ]
        for t in tasks
    ]
    return headers, rows


async def _export_communication_logs(
    db: DB,
    *,
    channel: str | None,
    direction: str | None,
    search: str | None,
    limit: int,
) -> tuple[list[str], list[list[object]]]:
    query = select(CommunicationLog).options(
        selectinload(CommunicationLog.client),
        selectinload(CommunicationLog.partner),
        selectinload(CommunicationLog.program),
        selectinload(CommunicationLog.logger),
    )
    if channel:
        query = query.where(CommunicationLog.channel == channel)
    if direction:
        query = query.where(CommunicationLog.direction == direction)
    if search:
        query = query.where(
            CommunicationLog.subject.ilike(f"%{search}%")
            | CommunicationLog.contact_name.ilike(f"%{search}%")
        )
    result = await db.execute(query.order_by(CommunicationLog.occurred_at.desc()).limit(limit))
    logs = result.scalars().all()
    headers = [
        "Date",
        "Channel",
        "Direction",
        "Subject",
        "Contact Name",
        "Contact Email",
        "Client",
        "Partner",
        "Program",
        "Logged By",
        "Tags",
    ]
    rows: list[list[object]] = [
        [
            log.occurred_at.strftime("%Y-%m-%d %H:%M") if log.occurred_at else "",
            log.channel,
            log.direction,
            log.subject,
            log.contact_name or "",
            log.contact_email or "",
            log.client.legal_name if log.client else "",
            log.partner.firm_name if log.partner else "",
            log.program.title if log.program else "",
            log.logger.full_name if log.logger else "",
            ", ".join(log.tags or []),
        ]
        for log in logs
    ]
    return headers, rows


async def _export_documents(
    db: DB,
    *,
    entity_type: str | None,
    entity_id: uuid.UUID | None,
    category: str | None,
    limit: int,
) -> tuple[list[str], list[list[object]]]:
    query = select(Document)
    if entity_type:
        query = query.where(Document.entity_type == entity_type)
    if entity_id:
        query = query.where(Document.entity_id == entity_id)
    if category:
        query = query.where(Document.category == category)
    result = await db.execute(query.order_by(Document.created_at.desc()).limit(limit))
    documents = result.scalars().all()
    headers = [
        "File Name",
        "Content Type",
        "Size (bytes)",
        "Category",
        "Version",
        "Entity Type",
        "Entity ID",
        "Description",
        "Uploaded",
    ]
    rows: list[list[object]] = [
        [
            d.file_name,
            d.content_type or "",
            str(d.file_size),
            d.category,
            str(d.version),
            d.entity_type,
            str(d.entity_id),
            d.description or "",
            d.created_at.strftime("%Y-%m-%d") if d.created_at else "",
        ]
        for d in documents
    ]
    return headers, rows


async def _export_communications(
    db: DB,
    *,
    status: str | None,
    channel: str | None,
    search: str | None,
    limit: int,
) -> tuple[list[str], list[list[object]]]:
    query = select(Communication).options(
        selectinload(Communication.sender),
        selectinload(Communication.client),
        selectinload(Communication.program),
    )
    if status:
        query = query.where(Communication.status == status)
    if channel:
        query = query.where(Communication.channel == channel)
    if search:
        query = query.where(Communication.subject.ilike(f"%{search}%"))
    result = await db.execute(query.order_by(Communication.created_at.desc()).limit(limit))
    comms = result.scalars().unique().all()
    headers = [
        "Subject",
        "Channel",
        "Status",
        "Approval Status",
        "Sender",
        "Client",
        "Program",
        "Sent At",
        "Created",
    ]
    rows: list[list[object]] = [
        [
            c.subject or "",
            c.channel,
            c.status,
            c.approval_status,
            c.sender.full_name if c.sender else "",
            c.client.legal_name if c.client else "",
            c.program.title if c.program else "",
            c.sent_at.strftime("%Y-%m-%d %H:%M") if c.sent_at else "",
            c.created_at.strftime("%Y-%m-%d") if c.created_at else "",
        ]
        for c in comms
    ]
    return headers, rows


async def _export_deliverables(
    db: DB,
    *,
    status: str | None,
    search: str | None,
    limit: int,
) -> tuple[list[str], list[list[object]]]:
    from app.models.partner_assignment import PartnerAssignment

    query = select(Deliverable).options(
        selectinload(Deliverable.submitter),
        selectinload(Deliverable.reviewer),
        selectinload(Deliverable.assignment).selectinload(PartnerAssignment.partner),
    )
    if status:
        query = query.where(Deliverable.status == status)
    if search:
        query = query.where(Deliverable.title.ilike(f"%{search}%"))
    result = await db.execute(query.order_by(Deliverable.created_at.desc()).limit(limit))
    deliverables = result.scalars().unique().all()
    headers = [
        "Title",
        "Type",
        "Status",
        "Due Date",
        "Submitted By",
        "Submitted At",
        "Reviewed By",
        "Partner",
        "Client Visible",
        "Created",
    ]
    rows: list[list[object]] = [
        [
            d.title,
            d.deliverable_type,
            d.status,
            str(d.due_date) if d.due_date else "",
            d.submitter.full_name if d.submitter else "",
            d.submitted_at.strftime("%Y-%m-%d %H:%M") if d.submitted_at else "",
            d.reviewer.full_name if d.reviewer else "",
            (d.assignment.partner.firm_name if d.assignment and d.assignment.partner else ""),
            "Yes" if d.client_visible else "No",
            d.created_at.strftime("%Y-%m-%d") if d.created_at else "",
        ]
        for d in deliverables
    ]
    return headers, rows


async def _export_escalations(
    db: DB,
    *,
    status: str | None,
    level: str | None,
    search: str | None,
    limit: int,
) -> tuple[list[str], list[list[object]]]:
    owner_alias = User.__table__.alias("owner_user")
    query = select(Escalation, owner_alias.c.full_name.label("owner_name")).outerjoin(
        owner_alias, Escalation.owner_id == owner_alias.c.id
    )
    if status:
        query = query.where(Escalation.status == status)
    if level:
        query = query.where(Escalation.level == level)
    if search:
        query = query.where(Escalation.title.ilike(f"%{search}%"))
    result = await db.execute(query.order_by(Escalation.triggered_at.desc()).limit(limit))
    rows_data = result.all()
    headers = [
        "Title",
        "Level",
        "Status",
        "Entity Type",
        "Owner",
        "Triggered At",
        "Acknowledged At",
        "Resolved At",
        "Created",
    ]
    rows: list[list[object]] = [
        [
            e.title,
            e.level,
            e.status,
            e.entity_type,
            owner_name or "",
            e.triggered_at.strftime("%Y-%m-%d %H:%M") if e.triggered_at else "",
            e.acknowledged_at.strftime("%Y-%m-%d %H:%M") if e.acknowledged_at else "",
            e.resolved_at.strftime("%Y-%m-%d %H:%M") if e.resolved_at else "",
            e.created_at.strftime("%Y-%m-%d") if e.created_at else "",
        ]
        for e, owner_name in rows_data
    ]
    return headers, rows


@router.get("/{resource}")
async def export_resource(
    resource: str,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    format: str = Query("csv", pattern="^(csv|xlsx)$"),  # noqa: A002
    search: str | None = Query(None),
    status: str | None = Query(None),
    level: str | None = Query(None),
    client_id: uuid.UUID | None = Query(None),
    availability: str | None = Query(None),
    program_id: uuid.UUID | None = Query(None),
    assignee_id: uuid.UUID | None = Query(None),
    priority: str | None = Query(None),
    channel: str | None = Query(None),
    direction: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: uuid.UUID | None = Query(None),
    category: str | None = Query(None),
    limit: int = Query(5000, ge=1, le=10000),
) -> StreamingResponse:
    """Stream a CSV or Excel export of the requested resource."""
    if resource not in _SUPPORTED:
        raise NotFoundException(f"Unknown resource '{resource}'")

    if resource == "programs":
        headers, rows = await _export_programs(
            db, status=status, client_id=client_id, search=search, limit=limit
        )
    elif resource == "clients":
        headers, rows = await _export_clients(db, status=status, search=search, limit=limit)
    elif resource == "partners":
        headers, rows = await _export_partners(
            db,
            status=status,
            availability=availability,
            search=search,
            limit=limit,
        )
    elif resource == "tasks":
        headers, rows = await _export_tasks(
            db,
            status=status,
            priority=priority,
            assignee_id=assignee_id,
            program_id=program_id,
            limit=limit,
        )
    elif resource == "communication_logs":
        headers, rows = await _export_communication_logs(
            db,
            channel=channel,
            direction=direction,
            search=search,
            limit=limit,
        )
    elif resource == "communications":
        headers, rows = await _export_communications(
            db,
            status=status,
            channel=channel,
            search=search,
            limit=limit,
        )
    elif resource == "deliverables":
        headers, rows = await _export_deliverables(
            db,
            status=status,
            search=search,
            limit=limit,
        )
    elif resource == "escalations":
        headers, rows = await _export_escalations(
            db,
            status=status,
            level=level,
            search=search,
            limit=limit,
        )
    else:  # documents
        headers, rows = await _export_documents(
            db,
            entity_type=entity_type,
            entity_id=entity_id,
            category=category,
            limit=limit,
        )

    timestamp = datetime.now().strftime("%Y%m%d")
    filename = f"{resource}-export-{timestamp}"

    if format == "xlsx":
        return _xlsx_response(headers, rows, filename)
    return _csv_response(headers, rows, filename)
