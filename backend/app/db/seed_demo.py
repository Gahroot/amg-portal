"""Seed demo data for Phase 2 presentation.

Fills in the gaps: scheduled events, invoices, approvals, document requests,
meetings, RM availability, vault documents, and richer document variety.

Idempotent — checks before creating. Run with:
    cd backend && python3 -m app.db.seed_demo
"""
import asyncio
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.approval import ProgramApproval
from app.models.communication import Communication
from app.models.conversation import Conversation
from app.models.decision_request import DecisionRequest
from app.models.document import Document
from app.models.document_request import DocumentRequest
from app.models.enums import (
    ApprovalType,
    CommunicationApprovalStatus,
    CommunicationChannel,
    ConversationType,
    DecisionRequestStatus,
    DecisionResponseType,
    DocumentCategory,
    DocumentEntityType,
    DocumentRequestStatus,
    DocumentRequestType,
    EventStatus,
    EventType,
    MessageStatus,
    NotificationType,
    ProgramApprovalStatus,
    VaultStatus,
)
from app.models.invoice import Invoice
from app.models.meeting_slot import Meeting, RMAvailability
from app.models.notification import Notification
from app.models.scheduled_event import ScheduledEvent


async def get_ids(db: AsyncSession) -> Any:
    """Fetch all the existing entity IDs we need to reference."""
    ids = {}

    # Users by email
    r = await db.execute(text("SELECT id, email FROM users"))
    for row in r.fetchall():
        ids[row.email] = row.id

    # Programs by title
    r = await db.execute(text("SELECT id, title FROM programs"))
    for row in r.fetchall():
        ids[f"program:{row.title}"] = row.id

    # Clients by name
    r = await db.execute(text("SELECT id, name FROM clients"))
    for row in r.fetchall():
        ids[f"client:{row.name}"] = row.id

    # Client profiles by legal_name
    r = await db.execute(text("SELECT id, legal_name FROM client_profiles"))
    for row in r.fetchall():
        ids[f"profile:{row.legal_name}"] = row.id

    # Partner profiles by firm_name
    r = await db.execute(text("SELECT id, firm_name FROM partner_profiles"))
    for row in r.fetchall():
        ids[f"partner:{row.firm_name}"] = row.id

    # Partner assignments by title
    r = await db.execute(text("SELECT id, title FROM partner_assignments"))
    for row in r.fetchall():
        ids[f"assignment:{row.title}"] = row.id

    # Meeting types by slug
    r = await db.execute(text("SELECT id, slug FROM meeting_types"))
    for row in r.fetchall():
        ids[f"meeting_type:{row.slug}"] = row.id

    # Milestones by title
    r = await db.execute(text("SELECT id, title FROM milestones"))
    for row in r.fetchall():
        ids[f"milestone:{row.title}"] = row.id

    return ids


async def seed_scheduled_events(db: AsyncSession, ids: dict[str, Any]) -> Any:
    """Seed calendar events — meetings, calls, reviews, deadlines."""
    r = await db.execute(select(ScheduledEvent).limit(1))
    if r.scalar_one_or_none():
        print("  Events already exist, skipping.")
        return

    now = datetime.now(UTC)
    admin_id = ids["admin@anchormillgroup.com"]
    rm_sarah = ids["sarah.blackwood@amg.com"]
    rm_james = ids["james.chen@amg.com"]
    coord_elena = ids["elena.vasquez@amg.com"]
    client_philippe = ids["philippe.beaumont@amg.com"]
    client_diana = ids["diana.northcott@amg.com"]
    client_robert = ids["robert.tanaka@amg.com"]

    beaumont_prog = ids["program:Beaumont Global Estate Plan"]
    northcott_prog = ids["program:Northcott Executive Relocation"]
    tanaka_prog = ids["program:Tanaka Investment Portfolio Review"]
    art_prog = ids["program:Beaumont Art Collection Acquisition"]

    beaumont_client = ids["client:Beaumont Family Office"]
    northcott_client = ids["client:Northcott Global Enterprises"]
    tanaka_client = ids["client:Tanaka Holdings"]

    events = [
        # Past events (show history)
        ScheduledEvent(
            title="Beaumont Estate Plan Kickoff",
            description="Initial meeting to discuss estate planning objectives, jurisdictional considerations, and timeline.",  # noqa: E501
            event_type=EventType.meeting,
            start_time=now - timedelta(days=45, hours=2),
            end_time=now - timedelta(days=45, hours=1),
            timezone="Europe/Zurich",
            location="AMG Zurich Office",
            organizer_id=rm_sarah,
            program_id=beaumont_prog,
            client_id=beaumont_client,
            attendee_ids=[rm_sarah, client_philippe, coord_elena],
            status=EventStatus.completed,
            notes="Discussed Swiss, UK, and French holdings. Client wants aggressive tax optimization.",  # noqa: E501
        ),
        ScheduledEvent(
            title="Tanaka Portfolio Final Review",
            description="Final review of investment portfolio rebalancing results and performance report.",  # noqa: E501
            event_type=EventType.review,
            start_time=now - timedelta(days=20, hours=5),
            end_time=now - timedelta(days=20, hours=4),
            timezone="Asia/Tokyo",
            virtual_link="https://meet.amg-portal.com/tanaka-review",
            organizer_id=rm_james,
            program_id=tanaka_prog,
            client_id=tanaka_client,
            attendee_ids=[rm_james, client_robert],
            status=EventStatus.completed,
            notes="Client satisfied with results. Program marked complete.",
        ),
        # Today / this week
        ScheduledEvent(
            title="Beaumont Trust Structure Review",
            description="Review proposed trust structures with legal team recommendations. Discuss trustee shortlist.",  # noqa: E501
            event_type=EventType.meeting,
            start_time=now.replace(hour=14, minute=0, second=0, microsecond=0) + timedelta(hours=2),
            end_time=now.replace(hour=15, minute=0, second=0, microsecond=0) + timedelta(hours=2),
            timezone="Europe/Zurich",
            virtual_link="https://meet.amg-portal.com/beaumont-trust",
            organizer_id=rm_sarah,
            program_id=beaumont_prog,
            client_id=beaumont_client,
            attendee_ids=[rm_sarah, client_philippe, coord_elena],
            status=EventStatus.confirmed,
            reminder_minutes=30,
        ),
        ScheduledEvent(
            title="Northcott Relocation — Immigration Check-in",
            description="Weekly check-in on visa application progress and housing search status.",
            event_type=EventType.call,
            start_time=now.replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1),
            end_time=now.replace(hour=10, minute=30, second=0, microsecond=0) + timedelta(days=1),
            timezone="Asia/Singapore",
            virtual_link="https://meet.amg-portal.com/northcott-weekly",
            organizer_id=rm_james,
            program_id=northcott_prog,
            client_id=northcott_client,
            attendee_ids=[rm_james, client_diana, coord_elena],
            status=EventStatus.confirmed,
            reminder_minutes=15,
        ),
        # This week
        ScheduledEvent(
            title="Tax Optimization Strategy Deadline",
            description="Deadline for tax optimization memo delivery. Must be reviewed before client meeting.",  # noqa: E501
            event_type=EventType.deadline,
            start_time=now.replace(hour=17, minute=0, second=0, microsecond=0) + timedelta(days=3),
            end_time=now.replace(hour=17, minute=0, second=0, microsecond=0) + timedelta(days=3),
            timezone="Europe/London",
            organizer_id=coord_elena,
            program_id=beaumont_prog,
            client_id=beaumont_client,
            status=EventStatus.scheduled,
        ),
        ScheduledEvent(
            title="Art Collection — Curator Shortlist Presentation",
            description="Present curator candidates for the Beaumont art acquisition program.",
            event_type=EventType.meeting,
            start_time=now.replace(hour=11, minute=0, second=0, microsecond=0) + timedelta(days=4),
            end_time=now.replace(hour=12, minute=0, second=0, microsecond=0) + timedelta(days=4),
            timezone="Europe/Zurich",
            location="AMG Zurich Office — Gallery Room",
            organizer_id=rm_sarah,
            program_id=art_prog,
            client_id=beaumont_client,
            attendee_ids=[rm_sarah, client_philippe, admin_id],
            status=EventStatus.scheduled,
        ),
        # Next week
        ScheduledEvent(
            title="Monthly Portfolio Review — All Clients",
            description="Internal monthly review of all active client portfolios and program health.",  # noqa: E501
            event_type=EventType.review,
            start_time=now.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=7),
            end_time=now.replace(hour=11, minute=0, second=0, microsecond=0) + timedelta(days=7),
            timezone="Europe/London",
            location="AMG London HQ — Board Room",
            organizer_id=admin_id,
            attendee_ids=[admin_id, rm_sarah, rm_james, coord_elena, ids["olivia.grant@amg.com"]],
            status=EventStatus.scheduled,
        ),
        ScheduledEvent(
            title="Northcott — Site Visit: International Schools",
            description="Accompanied school visits for the Northcott family. Three schools in Singapore shortlisted.",  # noqa: E501
            event_type=EventType.site_visit,
            start_time=now.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=10),
            end_time=now.replace(hour=16, minute=0, second=0, microsecond=0) + timedelta(days=10),
            timezone="Asia/Singapore",
            location="Singapore — Various Schools",
            organizer_id=coord_elena,
            program_id=northcott_prog,
            client_id=northcott_client,
            attendee_ids=[coord_elena, client_diana],
            status=EventStatus.scheduled,
        ),
    ]

    db.add_all(events)
    print(f"  Created {len(events)} scheduled events.")


async def seed_invoices(db: AsyncSession, ids: dict[str, Any]) -> Any:
    """Seed invoices for finance dashboard."""
    r = await db.execute(select(Invoice).limit(1))
    if r.scalar_one_or_none():
        print("  Invoices already exist, skipping.")
        return

    finance_id = ids["olivia.grant@amg.com"]

    beaumont_client = ids["client:Beaumont Family Office"]
    northcott_client = ids["client:Northcott Global Enterprises"]
    tanaka_client = ids["client:Tanaka Holdings"]

    beaumont_prog = ids["program:Beaumont Global Estate Plan"]
    northcott_prog = ids["program:Northcott Executive Relocation"]
    tanaka_prog = ids["program:Tanaka Investment Portfolio Review"]
    art_prog = ids["program:Beaumont Art Collection Acquisition"]

    today = date.today()

    invoices = [
        # Beaumont Estate — active program, mix of paid and outstanding
        Invoice(
            client_id=beaumont_client,
            program_id=beaumont_prog,
            amount=Decimal("125000.00"),
            status="paid",
            due_date=today - timedelta(days=30),
            notes="Phase 1 — Jurisdictional analysis and initial consultations",
            created_by=finance_id,
        ),
        Invoice(
            client_id=beaumont_client,
            program_id=beaumont_prog,
            amount=Decimal("250000.00"),
            status="sent",
            due_date=today + timedelta(days=15),
            notes="Phase 2 — Trust structure design and legal review",
            created_by=finance_id,
        ),
        Invoice(
            client_id=beaumont_client,
            program_id=beaumont_prog,
            amount=Decimal("175000.00"),
            status="draft",
            due_date=today + timedelta(days=45),
            notes="Phase 3 — Tax optimization implementation",
            created_by=finance_id,
        ),
        # Beaumont Art — on hold but initial deposit paid
        Invoice(
            client_id=beaumont_client,
            program_id=art_prog,
            amount=Decimal("500000.00"),
            status="paid",
            due_date=today - timedelta(days=60),
            notes="Retainer — Art collection curation and sourcing",
            created_by=finance_id,
        ),
        # Northcott — intake phase, initial invoice
        Invoice(
            client_id=northcott_client,
            program_id=northcott_prog,
            amount=Decimal("75000.00"),
            status="sent",
            due_date=today + timedelta(days=7),
            notes="Initial assessment — Immigration and relocation planning",
            created_by=finance_id,
        ),
        # Tanaka — completed program, all paid
        Invoice(
            client_id=tanaka_client,
            program_id=tanaka_prog,
            amount=Decimal("150000.00"),
            status="paid",
            due_date=today - timedelta(days=90),
            notes="Full program — Investment portfolio review and rebalancing",
            created_by=finance_id,
        ),
        Invoice(
            client_id=tanaka_client,
            program_id=tanaka_prog,
            amount=Decimal("35000.00"),
            status="paid",
            due_date=today - timedelta(days=45),
            notes="Final report and compliance documentation",
            created_by=finance_id,
        ),
        # Overdue invoice for urgency in demo
        Invoice(
            client_id=northcott_client,
            program_id=northcott_prog,
            amount=Decimal("50000.00"),
            status="overdue",
            due_date=today - timedelta(days=14),
            notes="Compliance review and due diligence assessment",
            created_by=finance_id,
        ),
    ]

    db.add_all(invoices)
    print(f"  Created {len(invoices)} invoices.")


async def seed_approvals(db: AsyncSession, ids: dict[str, Any]) -> Any:
    """Seed program approvals for the approvals dashboard."""
    r = await db.execute(select(ProgramApproval).limit(1))
    if r.scalar_one_or_none():
        print("  Approvals already exist, skipping.")
        return

    rm_sarah = ids["sarah.blackwood@amg.com"]
    rm_james = ids["james.chen@amg.com"]
    admin_id = ids["admin@anchormillgroup.com"]
    coord_elena = ids["elena.vasquez@amg.com"]

    beaumont_prog = ids["program:Beaumont Global Estate Plan"]
    northcott_prog = ids["program:Northcott Executive Relocation"]
    tanaka_prog = ids["program:Tanaka Investment Portfolio Review"]
    art_prog = ids["program:Beaumont Art Collection Acquisition"]

    now = datetime.now(UTC)

    approvals = [
        # Approved — Beaumont estate (active program)
        ProgramApproval(
            program_id=beaumont_prog,
            approval_type=ApprovalType.elevated,
            requested_by=rm_sarah,
            approved_by=admin_id,
            status=ProgramApprovalStatus.approved,
            comments="Approved. High-value client, elevated oversight warranted. Proceed with trust design phase.",  # noqa: E501
            decided_at=now - timedelta(days=40),
        ),
        # Pending — Northcott relocation (needs MD sign-off)
        ProgramApproval(
            program_id=northcott_prog,
            approval_type=ApprovalType.standard,
            requested_by=rm_james,
            status=ProgramApprovalStatus.pending,
            comments="Requesting approval to proceed with executive relocation program. Immigration counsel retained.",  # noqa: E501
        ),
        # Approved — Tanaka (completed)
        ProgramApproval(
            program_id=tanaka_prog,
            approval_type=ApprovalType.standard,
            requested_by=rm_james,
            approved_by=admin_id,
            status=ProgramApprovalStatus.approved,
            comments="Standard portfolio review. Approved.",
            decided_at=now - timedelta(days=120),
        ),
        # Pending — Art collection (strategic, high budget)
        ProgramApproval(
            program_id=art_prog,
            approval_type=ApprovalType.strategic,
            requested_by=rm_sarah,
            status=ProgramApprovalStatus.pending,
            comments="Strategic acquisition program — £5M budget envelope. Requesting MD approval to resume after hold. Curator shortlisted.",  # noqa: E501
        ),
        # Pending — Budget increase for Beaumont
        ProgramApproval(
            program_id=beaumont_prog,
            approval_type=ApprovalType.elevated,
            requested_by=coord_elena,
            status=ProgramApprovalStatus.pending,
            comments="Requesting budget increase of £300K for additional jurisdictional analysis (Monaco, Dubai). Client expanding scope.",  # noqa: E501
        ),
    ]

    db.add_all(approvals)
    print(f"  Created {len(approvals)} approvals.")


async def seed_document_requests(db: AsyncSession, ids: dict[str, Any]) -> Any:
    """Seed document requests for client portal."""
    r = await db.execute(select(DocumentRequest).limit(1))
    if r.scalar_one_or_none():
        print("  Document requests already exist, skipping.")
        return

    rm_sarah = ids["sarah.blackwood@amg.com"]
    rm_james = ids["james.chen@amg.com"]
    coord_elena = ids["elena.vasquez@amg.com"]

    beaumont_profile = ids["profile:Beaumont Family Office SA"]
    northcott_profile = ids["profile:Northcott Global Enterprises Ltd"]
    tanaka_profile = ids["profile:Tanaka Holdings KK"]

    now = datetime.now(UTC)

    requests = [
        # Beaumont — various statuses
        DocumentRequest(
            client_id=beaumont_profile,
            requested_by=rm_sarah,
            document_type=DocumentRequestType.bank_statement,
            title="Q1 2026 Bank Statements — All Jurisdictions",
            description="Please provide bank statements for all accounts across Switzerland, UK, and France for Q1 2026.",  # noqa: E501
            message="Philippe, we need these for the trust structure analysis. Please upload at your earliest convenience.",  # noqa: E501
            status=DocumentRequestStatus.pending,
            deadline=now + timedelta(days=10),
            requested_at=now - timedelta(days=2),
        ),
        DocumentRequest(
            client_id=beaumont_profile,
            requested_by=coord_elena,
            document_type=DocumentRequestType.tax_return,
            title="2025 Tax Returns — Swiss Entity",
            description="Annual tax return for the Swiss family office entity.",
            message="Required for the tax optimization review currently underway.",
            status=DocumentRequestStatus.in_progress,
            deadline=now + timedelta(days=21),
            requested_at=now - timedelta(days=7),
            in_progress_at=now - timedelta(days=3),
            estimated_completion=now + timedelta(days=5),
            client_notes="Working with our accountant. Should have this by end of week.",
        ),
        DocumentRequest(
            client_id=beaumont_profile,
            requested_by=rm_sarah,
            document_type=DocumentRequestType.signed_agreement,
            title="Trust Deed Signature — Beaumont Family Trust",
            description="Signed copy of the proposed trust deed for the Beaumont Family Trust structure.",  # noqa: E501
            status=DocumentRequestStatus.complete,
            deadline=now - timedelta(days=5),
            requested_at=now - timedelta(days=20),
            completed_at=now - timedelta(days=8),
        ),
        # Northcott — immigration docs
        DocumentRequest(
            client_id=northcott_profile,
            requested_by=rm_james,
            document_type=DocumentRequestType.passport,
            title="Passport Copies — All Family Members",
            description="Certified passport copies for Diana, spouse, and dependents for EP application.",  # noqa: E501
            message="Diana, the immigration counsel needs these urgently for the Employment Pass application.",  # noqa: E501
            status=DocumentRequestStatus.pending,
            deadline=now + timedelta(days=5),
            requested_at=now - timedelta(days=1),
            rm_notes="Priority — EP application timeline depends on this.",
        ),
        DocumentRequest(
            client_id=northcott_profile,
            requested_by=coord_elena,
            document_type=DocumentRequestType.corporate_documents,
            title="Company Registration — Northcott Global SG Branch",
            description="ACRA registration documents for the Singapore branch entity.",
            status=DocumentRequestStatus.received,
            deadline=now + timedelta(days=14),
            requested_at=now - timedelta(days=10),
            received_at=now - timedelta(days=2),
        ),
        # Tanaka — completed program, all done
        DocumentRequest(
            client_id=tanaka_profile,
            requested_by=rm_james,
            document_type=DocumentRequestType.financial_statement,
            title="Annual Financial Statement 2025",
            description="Audited financial statements for Tanaka Holdings for the portfolio review.",  # noqa: E501
            status=DocumentRequestStatus.complete,
            deadline=now - timedelta(days=60),
            requested_at=now - timedelta(days=90),
            completed_at=now - timedelta(days=65),
        ),
    ]

    db.add_all(requests)
    print(f"  Created {len(requests)} document requests.")


async def seed_rm_availability(db: AsyncSession, ids: dict[str, Any]) -> Any:
    """Seed RM availability slots for meeting booking."""
    r = await db.execute(select(RMAvailability).limit(1))
    if r.scalar_one_or_none():
        print("  RM availability already exists, skipping.")
        return

    rm_sarah = ids["sarah.blackwood@amg.com"]
    rm_james = ids["james.chen@amg.com"]

    slots = []
    # Sarah: Mon-Fri 9am-12pm and 2pm-5pm
    for day in range(5):  # Mon=0 through Fri=4
        slots.append(RMAvailability(
            rm_id=rm_sarah,
            day_of_week=day,
            start_time=time(9, 0),
            end_time=time(12, 0),
            buffer_minutes=15,
        ))
        slots.append(RMAvailability(
            rm_id=rm_sarah,
            day_of_week=day,
            start_time=time(14, 0),
            end_time=time(17, 0),
            buffer_minutes=15,
        ))
    # James: Mon-Thu 10am-1pm and 3pm-6pm (later timezone)
    for day in range(4):  # Mon-Thu
        slots.append(RMAvailability(
            rm_id=rm_james,
            day_of_week=day,
            start_time=time(10, 0),
            end_time=time(13, 0),
            buffer_minutes=15,
        ))
        slots.append(RMAvailability(
            rm_id=rm_james,
            day_of_week=day,
            start_time=time(15, 0),
            end_time=time(18, 0),
            buffer_minutes=15,
        ))

    db.add_all(slots)
    print(f"  Created {len(slots)} RM availability slots.")


async def seed_meetings(db: AsyncSession, ids: dict[str, Any]) -> Any:
    """Seed booked meetings for the scheduling pages."""
    r = await db.execute(select(Meeting).limit(1))
    if r.scalar_one_or_none():
        print("  Meetings already exist, skipping.")
        return

    rm_sarah = ids["sarah.blackwood@amg.com"]
    rm_james = ids["james.chen@amg.com"]
    client_philippe = ids["philippe.beaumont@amg.com"]
    client_diana = ids["diana.northcott@amg.com"]
    client_robert = ids["robert.tanaka@amg.com"]

    beaumont_client = ids["client:Beaumont Family Office"]
    northcott_client = ids["client:Northcott Global Enterprises"]
    tanaka_client = ids["client:Tanaka Holdings"]

    mt_quick = ids["meeting_type:quick_checkin"]
    mt_standard = ids["meeting_type:standard"]
    mt_extended = ids["meeting_type:extended"]

    now = datetime.now(UTC)

    meetings = [
        # Past — completed
        Meeting(
            meeting_type_id=mt_extended,
            rm_id=rm_james,
            client_id=tanaka_client,
            booked_by_user_id=client_robert,
            start_time=now - timedelta(days=14, hours=3),
            end_time=now - timedelta(days=14, hours=2),
            timezone="Asia/Tokyo",
            status="completed",
            agenda="Review final portfolio rebalancing results",
            notes="Excellent session. Client very pleased with returns.",
            virtual_link="https://meet.amg-portal.com/tanaka-final",
        ),
        # Upcoming — confirmed
        Meeting(
            meeting_type_id=mt_standard,
            rm_id=rm_sarah,
            client_id=beaumont_client,
            booked_by_user_id=client_philippe,
            start_time=now + timedelta(days=2, hours=4),
            end_time=now + timedelta(days=2, hours=4, minutes=30),
            timezone="Europe/Zurich",
            status="confirmed",
            agenda="Discuss trust structure options and shortlisted trustees",
            virtual_link="https://meet.amg-portal.com/beaumont-trust-2",
        ),
        Meeting(
            meeting_type_id=mt_quick,
            rm_id=rm_james,
            client_id=northcott_client,
            booked_by_user_id=client_diana,
            start_time=now + timedelta(days=1, hours=2),
            end_time=now + timedelta(days=1, hours=2, minutes=15),
            timezone="Asia/Singapore",
            status="confirmed",
            agenda="Quick update on EP application status",
            virtual_link="https://meet.amg-portal.com/northcott-ep",
        ),
        # Upcoming — pending confirmation
        Meeting(
            meeting_type_id=mt_extended,
            rm_id=rm_sarah,
            client_id=beaumont_client,
            booked_by_user_id=client_philippe,
            start_time=now + timedelta(days=8, hours=5),
            end_time=now + timedelta(days=8, hours=6),
            timezone="Europe/Zurich",
            status="pending",
            agenda="Art collection strategy review and curator interviews",
        ),
    ]

    db.add_all(meetings)
    print(f"  Created {len(meetings)} meetings.")


async def seed_additional_documents(db: AsyncSession, ids: dict[str, Any]) -> Any:
    """Seed richer documents — reports, contracts, vault items."""
    # Check if we already have non-compliance docs
    r = await db.execute(
        select(Document).where(Document.category != DocumentCategory.compliance).limit(1)
    )
    if r.scalar_one_or_none():
        print("  Additional documents already exist, skipping.")
        return

    admin_id = ids["admin@anchormillgroup.com"]
    rm_sarah = ids["sarah.blackwood@amg.com"]
    rm_james = ids["james.chen@amg.com"]
    coord_elena = ids["elena.vasquez@amg.com"]
    finance_id = ids["olivia.grant@amg.com"]

    beaumont_client = ids["client:Beaumont Family Office"]
    northcott_client = ids["client:Northcott Global Enterprises"]
    tanaka_client = ids["client:Tanaka Holdings"]

    beaumont_prog = ids["program:Beaumont Global Estate Plan"]
    tanaka_prog = ids["program:Tanaka Investment Portfolio Review"]

    now = datetime.now(UTC)

    documents = [
        # Program reports
        Document(
            file_path="programs/beaumont-estate/jurisdictional-analysis-v2.pdf",
            file_name="Jurisdictional Analysis Report v2.pdf",
            file_size=2_450_000,
            content_type="application/pdf",
            entity_type=DocumentEntityType.program,
            entity_id=beaumont_prog,
            category=DocumentCategory.report,
            description="Comprehensive analysis of trust jurisdictions — Switzerland, UK, France, and Jersey.",  # noqa: E501
            version=2,
            uploaded_by=rm_sarah,
            vault_status=VaultStatus.active,
        ),
        Document(
            file_path="programs/beaumont-estate/trust-structure-proposal.pdf",
            file_name="Trust Structure Proposal.pdf",
            file_size=1_800_000,
            content_type="application/pdf",
            entity_type=DocumentEntityType.program,
            entity_id=beaumont_prog,
            category=DocumentCategory.legal,
            description="Proposed trust structures with tax implications for each jurisdiction.",
            uploaded_by=rm_sarah,
            vault_status=VaultStatus.active,
        ),
        Document(
            file_path="programs/tanaka-portfolio/final-performance-report.pdf",
            file_name="Final Performance Report.pdf",
            file_size=3_200_000,
            content_type="application/pdf",
            entity_type=DocumentEntityType.program,
            entity_id=tanaka_prog,
            category=DocumentCategory.report,
            description="Final portfolio performance report with attribution analysis.",
            uploaded_by=rm_james,
            vault_status=VaultStatus.active,
        ),
        # Contracts
        Document(
            file_path="clients/beaumont/engagement-letter-2026.pdf",
            file_name="Engagement Letter 2026.pdf",
            file_size=450_000,
            content_type="application/pdf",
            entity_type=DocumentEntityType.client,
            entity_id=beaumont_client,
            category=DocumentCategory.contract,
            description="Signed engagement letter for 2026 advisory services.",
            uploaded_by=admin_id,
            vault_status=VaultStatus.active,
        ),
        Document(
            file_path="clients/northcott/nda-signed.pdf",
            file_name="NDA — Northcott Global.pdf",
            file_size=320_000,
            content_type="application/pdf",
            entity_type=DocumentEntityType.client,
            entity_id=northcott_client,
            category=DocumentCategory.contract,
            description="Non-disclosure agreement — fully executed.",
            uploaded_by=rm_james,
            vault_status=VaultStatus.active,
        ),
        # Financial docs
        Document(
            file_path="programs/beaumont-estate/budget-forecast-q2.xlsx",
            file_name="Budget Forecast Q2 2026.xlsx",
            file_size=780_000,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            entity_type=DocumentEntityType.program,
            entity_id=beaumont_prog,
            category=DocumentCategory.financial,
            description="Detailed budget forecast for Q2 program activities.",
            uploaded_by=finance_id,
            vault_status=VaultStatus.active,
        ),
        # Vault — sealed documents (evidence vault)
        Document(
            file_path="vault/beaumont/due-diligence-report.pdf",
            file_name="Due Diligence Report — Beaumont Family.pdf",
            file_size=5_600_000,
            content_type="application/pdf",
            entity_type=DocumentEntityType.client,
            entity_id=beaumont_client,
            category=DocumentCategory.compliance,
            description="Comprehensive due diligence report. Sealed for compliance audit trail.",
            uploaded_by=finance_id,
            vault_status=VaultStatus.sealed,
            sealed_at=now - timedelta(days=30),
            sealed_by=admin_id,
            retention_policy="7_years",
            chain_of_custody=[
                {"action": "created", "user": "olivia.grant@amg.com", "at": (now - timedelta(days=35)).isoformat()},  # noqa: E501
                {"action": "reviewed", "user": "admin@anchormillgroup.com", "at": (now - timedelta(days=32)).isoformat()},  # noqa: E501
                {"action": "sealed", "user": "admin@anchormillgroup.com", "at": (now - timedelta(days=30)).isoformat()},  # noqa: E501
            ],
        ),
        Document(
            file_path="vault/tanaka/compliance-certificate.pdf",
            file_name="Compliance Certificate — Tanaka Holdings.pdf",
            file_size=890_000,
            content_type="application/pdf",
            entity_type=DocumentEntityType.client,
            entity_id=tanaka_client,
            category=DocumentCategory.compliance,
            description="Program completion compliance certificate. Sealed and archived.",
            uploaded_by=finance_id,
            vault_status=VaultStatus.sealed,
            sealed_at=now - timedelta(days=15),
            sealed_by=admin_id,
            retention_policy="7_years",
            chain_of_custody=[
                {"action": "created", "user": "olivia.grant@amg.com", "at": (now - timedelta(days=20)).isoformat()},  # noqa: E501
                {"action": "sealed", "user": "admin@anchormillgroup.com", "at": (now - timedelta(days=15)).isoformat()},  # noqa: E501
            ],
        ),
        Document(
            file_path="vault/northcott/security-assessment.pdf",
            file_name="Security Assessment — Northcott Relocation.pdf",
            file_size=2_100_000,
            content_type="application/pdf",
            entity_type=DocumentEntityType.client,
            entity_id=northcott_client,
            category=DocumentCategory.compliance,
            description="Pre-relocation security assessment for Singapore move. Archived.",
            uploaded_by=coord_elena,
            vault_status=VaultStatus.archived,
            retention_policy="5_years",
            chain_of_custody=[
                {"action": "created", "user": "elena.vasquez@amg.com", "at": (now - timedelta(days=10)).isoformat()},  # noqa: E501
                {"action": "archived", "user": "elena.vasquez@amg.com", "at": (now - timedelta(days=5)).isoformat()},  # noqa: E501
            ],
        ),
        # Correspondence
        Document(
            file_path="clients/beaumont/meeting-notes-20260310.pdf",
            file_name="Meeting Notes — 10 Mar 2026.pdf",
            file_size=210_000,
            content_type="application/pdf",
            entity_type=DocumentEntityType.client,
            entity_id=beaumont_client,
            category=DocumentCategory.correspondence,
            description="Notes from Beaumont estate planning kickoff meeting.",
            uploaded_by=rm_sarah,
            vault_status=VaultStatus.active,
        ),
    ]

    db.add_all(documents)
    print(f"  Created {len(documents)} additional documents.")


async def seed_additional_notifications(db: AsyncSession, ids: dict[str, Any]) -> Any:
    """Seed fresh notifications for the admin to see on login."""
    # Check if there are recent notifications (last 24h)
    now = datetime.now(UTC)
    r = await db.execute(
        select(Notification).where(
            Notification.created_at > now - timedelta(hours=24),
            Notification.user_id == ids["admin@anchormillgroup.com"],
        ).limit(1)
    )
    if r.scalar_one_or_none():
        print("  Recent notifications already exist, skipping.")
        return

    admin_id = ids["admin@anchormillgroup.com"]

    notifications = [
        Notification(
            user_id=admin_id,
            notification_type=NotificationType.approval_required,
            title="Approval Required: Northcott Executive Relocation",
            body="James Chen has submitted the Northcott Executive Relocation program for your approval. Immigration counsel has been retained and is awaiting sign-off to proceed.",  # noqa: E501
            action_url="/approvals",
            action_label="Review Approval",
            priority="high",
            is_read=False,
            created_at=now - timedelta(hours=2),
        ),
        Notification(
            user_id=admin_id,
            notification_type=NotificationType.approval_required,
            title="Strategic Approval: Beaumont Art Collection — Resume Program",
            body="Sarah Blackwood is requesting approval to resume the £5M art acquisition program. Curator shortlist ready for review.",  # noqa: E501
            action_url="/approvals",
            action_label="Review Approval",
            priority="high",
            is_read=False,
            created_at=now - timedelta(hours=4),
        ),
        Notification(
            user_id=admin_id,
            notification_type=NotificationType.deliverable_ready,
            title="Deliverable Submitted: Cross-Border Tax Memo",
            body="Meridian Advisors has submitted the Cross-Border Tax Memo for the Beaumont Estate Plan. Ready for your review.",  # noqa: E501
            action_url="/deliverables",
            action_label="Review Deliverable",
            priority="normal",
            is_read=False,
            created_at=now - timedelta(hours=6),
        ),
        Notification(
            user_id=admin_id,
            notification_type=NotificationType.milestone_update,
            title="Milestone At Risk: Tax Optimization Review",
            body="The Tax Optimization Review milestone for Beaumont Estate Plan is flagged at-risk. Due date: April 15. Tax filings collection is behind schedule.",  # noqa: E501
            action_url="/programs",
            action_label="View Program",
            priority="high",
            is_read=False,
            created_at=now - timedelta(hours=8),
        ),
        Notification(
            user_id=admin_id,
            notification_type=NotificationType.communication,
            title="New Message: Philippe Beaumont",
            body="Philippe has sent a message regarding the trust structure timeline. He's asking about Monaco options.",  # noqa: E501
            action_url="/communications",
            action_label="View Message",
            priority="normal",
            is_read=False,
            created_at=now - timedelta(hours=10),
        ),
        Notification(
            user_id=admin_id,
            notification_type=NotificationType.system,
            title="Invoice Overdue: Northcott Compliance Review",
            body="Invoice for £50,000 (Compliance review and due diligence) is 14 days overdue. Client: Northcott Global Enterprises.",  # noqa: E501
            action_url="/finance",
            action_label="View Invoice",
            priority="urgent",
            is_read=False,
            created_at=now - timedelta(hours=1),
        ),
        # A couple of read ones so it doesn't look brand new
        Notification(
            user_id=admin_id,
            notification_type=NotificationType.assignment_update,
            title="Assignment Completed: Portfolio Rebalancing Advisory",
            body="Alpine Wealth has completed the Portfolio Rebalancing Advisory for the Tanaka program. All deliverables approved.",  # noqa: E501
            action_url="/assignments",
            action_label="View Assignment",
            priority="normal",
            is_read=True,
            read_at=now - timedelta(days=1),
            created_at=now - timedelta(days=2),
        ),
        Notification(
            user_id=admin_id,
            notification_type=NotificationType.system,
            title="Weekly Report: Program Health Summary",
            body="3 active programs, 1 on hold, 1 completed. 2 milestones at-risk. 3 pending approvals. See dashboard for details.",  # noqa: E501
            action_url="/analytics",
            action_label="View Analytics",
            priority="normal",
            is_read=True,
            read_at=now - timedelta(days=1),
            created_at=now - timedelta(days=3),
        ),
    ]

    db.add_all(notifications)
    print(f"  Created {len(notifications)} notifications.")


async def seed_additional_conversations(db: AsyncSession, ids: dict[str, Any]) -> Any:
    """Seed more conversation messages to make threads feel alive."""
    # Check if we have enough messages
    r = await db.execute(text("SELECT count(*) FROM communications"))
    count: int = r.scalar() or 0
    if count > 15:
        print(f"  Already {count} messages, skipping additional conversations.")
        return

    rm_sarah = ids["sarah.blackwood@amg.com"]
    rm_james = ids["james.chen@amg.com"]
    client_philippe = ids["philippe.beaumont@amg.com"]
    client_diana = ids["diana.northcott@amg.com"]
    coord_elena = ids["elena.vasquez@amg.com"]

    now = datetime.now(UTC)

    # Get existing conversations
    r = await db.execute(select(Conversation.id, Conversation.title))
    convos = {row.title: row.id for row in r.fetchall()}

    beaumont_convo = convos.get("Beaumont Estate Planning Discussion")
    tanaka_convo = convos.get("Tanaka Portfolio Review Follow-up")

    messages = []

    if beaumont_convo:
        # Add more messages to the Beaumont thread
        messages.extend([
            Communication(
                conversation_id=beaumont_convo,
                channel=CommunicationChannel.in_portal,
                status=MessageStatus.read,
                sender_id=client_philippe,
                subject=None,
                body="Sarah, I've been thinking about the Monaco option we discussed. My wife is quite keen on the lifestyle there, and I understand the tax advantages are significant. Could you include it in the jurisdictional analysis?",  # noqa: E501
                approval_status=CommunicationApprovalStatus.sent,
                sent_at=now - timedelta(hours=12),
            ),
            Communication(
                conversation_id=beaumont_convo,
                channel=CommunicationChannel.in_portal,
                status=MessageStatus.read,
                sender_id=rm_sarah,
                subject=None,
                body="Absolutely, Philippe. Monaco is an excellent addition to the analysis. I'll have Elena coordinate with Fortress Legal to include Monaco in the trust structure evaluation. The residency requirements are quite specific, so we'll want to factor that into the timeline. I'll have an updated brief to you by end of week.",  # noqa: E501
                approval_status=CommunicationApprovalStatus.sent,
                sent_at=now - timedelta(hours=11),
            ),
            Communication(
                conversation_id=beaumont_convo,
                channel=CommunicationChannel.in_portal,
                status=MessageStatus.delivered,
                sender_id=client_philippe,
                subject=None,
                body="Perfect. Also, I wanted to mention — I'll be travelling to Dubai next month. Perhaps worth considering as well? Let's discuss at our meeting this week.",  # noqa: E501
                approval_status=CommunicationApprovalStatus.sent,
                sent_at=now - timedelta(hours=3),
            ),
        ])

    if tanaka_convo:
        messages.extend([
            Communication(
                conversation_id=tanaka_convo,
                channel=CommunicationChannel.in_portal,
                status=MessageStatus.read,
                sender_id=rm_james,
                subject=None,
                body="Robert, the final performance report is now available in your documents portal. We achieved a 12.3% return against the 9% benchmark. Very pleased with the results.",  # noqa: E501
                approval_status=CommunicationApprovalStatus.sent,
                sent_at=now - timedelta(days=5),
            ),
        ])

    # Create a new conversation — Northcott relocation thread
    northcott_profile = ids.get("profile:Northcott Global Enterprises Ltd")
    if northcott_profile and "Northcott Relocation Planning" not in convos:
        new_convo = Conversation(
            conversation_type=ConversationType.rm_client,
            client_id=northcott_profile,
            title="Northcott Relocation Planning",
            participant_ids=[rm_james, client_diana, coord_elena],
            last_activity_at=now - timedelta(hours=5),
        )
        db.add(new_convo)
        await db.flush()

        messages.extend([
            Communication(
                conversation_id=new_convo.id,
                channel=CommunicationChannel.in_portal,
                status=MessageStatus.read,
                sender_id=rm_james,
                subject=None,
                body="Diana, welcome to the AMG Portal. I've set up this thread for our relocation planning discussions. Elena Vasquez will be coordinating the logistics side. First priority: we need passport copies for the EP application. I've sent a formal document request through the portal.",  # noqa: E501
                approval_status=CommunicationApprovalStatus.sent,
                sent_at=now - timedelta(days=3),
            ),
            Communication(
                conversation_id=new_convo.id,
                channel=CommunicationChannel.in_portal,
                status=MessageStatus.read,
                sender_id=client_diana,
                subject=None,
                body="Thank you, James. I'll get the passport copies uploaded this week. Quick question — for the school enrollment, do we need to start that process now or can it wait until the EP is approved?",  # noqa: E501
                approval_status=CommunicationApprovalStatus.sent,
                sent_at=now - timedelta(days=2, hours=18),
            ),
            Communication(
                conversation_id=new_convo.id,
                channel=CommunicationChannel.in_portal,
                status=MessageStatus.read,
                sender_id=coord_elena,
                subject=None,
                body="Diana, I'd recommend we start the school applications now. The top international schools in Singapore have wait lists. I've shortlisted three schools and arranged site visits for next week. I'll send you the details shortly.",  # noqa: E501
                approval_status=CommunicationApprovalStatus.sent,
                sent_at=now - timedelta(days=2, hours=12),
            ),
            Communication(
                conversation_id=new_convo.id,
                channel=CommunicationChannel.in_portal,
                status=MessageStatus.delivered,
                sender_id=client_diana,
                subject=None,
                body="Brilliant, thank you Elena. The site visits sound great. My husband will want to join as well. Can you send calendar invites?",  # noqa: E501
                approval_status=CommunicationApprovalStatus.sent,
                sent_at=now - timedelta(hours=5),
            ),
        ])

    if messages:
        db.add_all(messages)
        print(f"  Created {len(messages)} additional messages.")
    else:
        print("  No additional messages needed.")


async def seed_decision_requests(db: AsyncSession, ids: dict[str, Any]) -> Any:
    """Ensure decision requests have good variety."""
    # Count existing
    r = await db.execute(text("SELECT count(*) FROM decision_requests"))
    count: int = r.scalar() or 0
    if count >= 5:
        print(f"  Already {count} decision requests, skipping.")
        return

    rm_sarah = ids["sarah.blackwood@amg.com"]
    coord_elena = ids["elena.vasquez@amg.com"]
    client_philippe = ids["philippe.beaumont@amg.com"]

    beaumont_profile = ids["profile:Beaumont Family Office SA"]
    northcott_profile = ids["profile:Northcott Global Enterprises Ltd"]

    beaumont_prog = ids["program:Beaumont Global Estate Plan"]
    northcott_prog = ids["program:Northcott Executive Relocation"]
    art_prog = ids["program:Beaumont Art Collection Acquisition"]

    now = datetime.now(UTC)

    decisions = [
        DecisionRequest(
            client_id=beaumont_profile,
            program_id=beaumont_prog,
            title="Trust Jurisdiction Selection",
            prompt="Based on our jurisdictional analysis, we've narrowed the trust structure options to three jurisdictions. Each has distinct advantages regarding tax efficiency, regulatory oversight, and asset protection. Please select your preferred jurisdiction.",  # noqa: E501
            response_type=DecisionResponseType.choice,
            options=[
                {"id": "ch", "label": "Switzerland (Zurich)", "description": "Strongest asset protection. Higher setup costs. Established banking relationships."},  # noqa: E501
                {"id": "je", "label": "Jersey (Channel Islands)", "description": "Tax neutral. Lower ongoing costs. Excellent for multi-jurisdictional families."},  # noqa: E501
                {"id": "uk", "label": "United Kingdom", "description": "Familiar legal framework. Easier administration. Higher tax exposure."},  # noqa: E501
            ],
            deadline_date=date.today() + timedelta(days=7),
            consequence_text="If no selection is made, we will proceed with the recommended option (Jersey) to maintain the project timeline.",  # noqa: E501
            status=DecisionRequestStatus.pending,
            created_by=rm_sarah,
        ),
        DecisionRequest(
            client_id=beaumont_profile,
            program_id=art_prog,
            title="Curator Appointment",
            prompt="We've interviewed three curators for the art collection acquisition program. Please confirm your preferred curator to proceed with the engagement.",  # noqa: E501
            response_type=DecisionResponseType.choice,
            options=[
                {"id": "em", "label": "Dr. Elisabeth Moreau", "description": "Former Sotheby's director. Specialises in Impressionist and Modern art. Based in Paris."},  # noqa: E501
                {"id": "jw", "label": "Jonathan Wei", "description": "Contemporary art specialist. Strong Asian market connections. Based in Hong Kong."},  # noqa: E501
                {"id": "ar", "label": "Anna Rossi", "description": "Old Masters and Renaissance specialist. Extensive private collection experience. Based in Milan."},  # noqa: E501
            ],
            deadline_date=date.today() + timedelta(days=5),
            status=DecisionRequestStatus.pending,
            created_by=rm_sarah,
        ),
        DecisionRequest(
            client_id=northcott_profile,
            program_id=northcott_prog,
            title="School Preference for Dependents",
            prompt="We've shortlisted three international schools in Singapore for your children. Elena has arranged site visits. Based on the initial profiles, do you have an early preference?",  # noqa: E501
            response_type=DecisionResponseType.multi_choice,
            options=[
                {"id": "uwcsea", "label": "UWCSEA (Dover)", "description": "IB curriculum. Strong community focus. Excellent facilities."},  # noqa: E501
                {"id": "tanglin", "label": "Tanglin Trust School", "description": "British curriculum. Strong pastoral care. Central location."},  # noqa: E501
                {"id": "sas", "label": "Singapore American School", "description": "AP curriculum. Large campus. Strong STEM program."},  # noqa: E501
            ],
            deadline_date=date.today() + timedelta(days=14),
            status=DecisionRequestStatus.pending,
            created_by=coord_elena,
        ),
        # Responded decision
        DecisionRequest(
            client_id=beaumont_profile,
            program_id=beaumont_prog,
            title="Trustee Shortlist Approval",
            prompt="Please review and approve the shortlist of potential trustees for the Beaumont Family Trust.",  # noqa: E501
            response_type=DecisionResponseType.yes_no,
            status=DecisionRequestStatus.responded,
            response={"value": "yes", "text": "Approved. Please proceed with due diligence on all three candidates."},  # noqa: E501
            responded_at=now - timedelta(days=5),
            responded_by=client_philippe,
            created_by=rm_sarah,
        ),
    ]

    db.add_all(decisions)
    print(f"  Created {len(decisions)} decision requests.")


async def seed_demo() -> None:
    """Main seed function — fills all Phase 2 gaps."""
    print("🌱 Seeding Phase 2 demo data...\n")

    async with AsyncSessionLocal() as db:
        ids = await get_ids(db)

        print("1. Scheduled Events (Calendar)")
        await seed_scheduled_events(db, ids)

        print("2. Invoices (Finance)")
        await seed_invoices(db, ids)

        print("3. Program Approvals")
        await seed_approvals(db, ids)

        print("4. Document Requests (Client Portal)")
        await seed_document_requests(db, ids)

        print("5. RM Availability (Meeting Booking)")
        await seed_rm_availability(db, ids)

        print("6. Meetings")
        await seed_meetings(db, ids)

        print("7. Additional Documents (Reports, Contracts, Vault)")
        await seed_additional_documents(db, ids)

        print("8. Notifications (Admin Bell)")
        await seed_additional_notifications(db, ids)

        print("9. Additional Conversation Messages")
        await seed_additional_conversations(db, ids)

        print("10. Decision Requests")
        await seed_decision_requests(db, ids)

        await db.commit()

    print("\n✅ Demo data seeded successfully!")
    print("\nDemo accounts:")
    print("  Admin:    admin@anchormillgroup.com / AdminPass123!")
    print("  Client:   philippe.beaumont@amg.com / DemoPass123!")
    print("  Client:   diana.northcott@amg.com / DemoPass123!")
    print("  Partner:  catherine.mercer@amg.com / DemoPass123!")


if __name__ == "__main__":
    asyncio.run(seed_demo())
