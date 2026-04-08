"""Seed demo data for the AMG Portal.

Run via:
    cd backend && python -m scripts.seed_demo_data
"""

import asyncio
import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.access_audit import AccessAudit, AccessAuditFinding
from app.models.budget_approval import (
    ApprovalChain,
    ApprovalChainStep,
    ApprovalThreshold,
    BudgetApprovalHistory,
    BudgetApprovalRequest,
    BudgetApprovalStep,
)
from app.models.capability_review import CapabilityReview
from app.models.clearance_certificate import (
    CertificateTemplate,
    ClearanceCertificate,
    ClearanceCertificateHistory,
)
from app.models.client import Client
from app.models.client_profile import ClientProfile
from app.models.communication import Communication
from app.models.conversation import Conversation
from app.models.decision_request import DecisionRequest
from app.models.deliverable import Deliverable
from app.models.document import Document
from app.models.document_delivery import DocumentDelivery
from app.models.document_request import DocumentRequest
from app.models.escalation import Escalation
from app.models.kyc_document import KYCDocument
from app.models.meeting_slot import Meeting, RMAvailability
from app.models.meeting_type import MeetingType
from app.models.milestone import Milestone
from app.models.notification import Notification
from app.models.nps_survey import NPSFollowUp, NPSResponse, NPSSurvey
from app.models.partner import PartnerProfile
from app.models.partner_assignment import PartnerAssignment
from app.models.partner_rating import PartnerRating
from app.models.program import Program
from app.models.program_closure import ProgramClosure
from app.models.report_schedule import ReportSchedule
from app.models.scheduled_event import ScheduledEvent
from app.models.sla_tracker import SLATracker
from app.models.task import Task
from app.models.user import User
from app.services.template_seeder import seed_default_templates

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TODAY = date(2026, 3, 17)
NOW = datetime(2026, 3, 17, 12, 0, 0, tzinfo=UTC)


def _uid(name: str) -> uuid.UUID:
    """Deterministic UUID from a seed name."""
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"amg.seed.{name}")


async def get_or_create(
    db: AsyncSession,
    model,  # type: ignore[no-untyped-def]
    defaults: dict,
    **kwargs,  # type: ignore[no-untyped-def]
):
    """Get existing record by unique fields or create new one."""
    query = select(model)
    for key, value in kwargs.items():
        query = query.where(getattr(model, key) == value)
    result = await db.execute(query)
    instance = result.scalar_one_or_none()
    if instance:
        logger.info(
            "  Found existing %s: %s", model.__name__, kwargs
        )
        return instance, False
    instance = model(**{**kwargs, **defaults})
    db.add(instance)
    logger.info("  Created %s: %s", model.__name__, kwargs)
    return instance, True


# ---------------------------------------------------------------------------
# Deterministic IDs
# ---------------------------------------------------------------------------

# Users
MARCUS_ID = _uid("user.marcus.wellington")
SARAH_ID = _uid("user.sarah.blackwood")
JAMES_ID = _uid("user.james.chen")
ELENA_ID = _uid("user.elena.vasquez")
DAVID_ID = _uid("user.david.park")
OLIVIA_ID = _uid("user.olivia.grant")
PHILIPPE_ID = _uid("user.philippe.beaumont")
DIANA_ID = _uid("user.diana.northcott")
ROBERT_ID = _uid("user.robert.tanaka")
CATHERINE_ID = _uid("user.catherine.mercer")
ALEXANDER_ID = _uid("user.alexander.volkov")
STEFAN_ID = _uid("user.stefan.brandt")

# Clients
CLIENT_BEAUMONT_ID = _uid("client.beaumont")
CLIENT_NORTHCOTT_ID = _uid("client.northcott")
CLIENT_TANAKA_ID = _uid("client.tanaka")

# Client Profiles
PROFILE_BEAUMONT_ID = _uid("profile.beaumont")
PROFILE_NORTHCOTT_ID = _uid("profile.northcott")
PROFILE_TANAKA_ID = _uid("profile.tanaka")

# Partners
PARTNER_MERIDIAN_ID = _uid("partner.meridian")
PARTNER_FORTRESS_ID = _uid("partner.fortress")
PARTNER_ALPINE_ID = _uid("partner.alpine")

# Programs
PROG_ESTATE_ID = _uid("program.beaumont.estate")
PROG_RELOCATION_ID = _uid("program.northcott.relocation")
PROG_PORTFOLIO_ID = _uid("program.tanaka.portfolio")
PROG_ART_ID = _uid("program.beaumont.art")

# Milestones
MS = {i: _uid(f"milestone.{i}") for i in range(1, 16)}

# Tasks
TK = {i: _uid(f"task.{i}") for i in range(1, 41)}

# Assignments
AS = {i: _uid(f"assignment.{i}") for i in range(1, 6)}

# Deliverables
DL = {i: _uid(f"deliverable.{i}") for i in range(1, 9)}

# Conversations
CV = {i: _uid(f"conversation.{i}") for i in range(1, 5)}

# Communications
CM = {i: _uid(f"communication.{i}") for i in range(1, 13)}

# Documents
DC = {i: _uid(f"document.{i}") for i in range(1, 7)}

# KYC Documents
KY = {i: _uid(f"kyc.{i}") for i in range(1, 7)}

# Notifications
NF = {i: _uid(f"notification.{i}") for i in range(1, 16)}

# Escalations
ES = {i: _uid(f"escalation.{i}") for i in range(1, 4)}

# SLA Trackers
SL = {i: _uid(f"sla.{i}") for i in range(1, 5)}

# Decision Requests
DR = {i: _uid(f"decision.{i}") for i in range(1, 4)}

# Program Closure
CLOSURE_ID = _uid("closure.tanaka.portfolio")

# Partner Ratings
RT = {i: _uid(f"rating.{i}") for i in range(1, 3)}

# Report Schedules
RS = {i: _uid(f"schedule.{i}") for i in range(1, 3)}

# NPS
NPS_SURVEY_ID = _uid("nps.survey.q1.2026")
NR = {i: _uid(f"nps.response.{i}") for i in range(1, 4)}
NPS_FOLLOWUP_ID = _uid("nps.followup.1")

# Budget Approval
CHAIN_ID = _uid("approval.chain.1")
CS = {i: _uid(f"chain.step.{i}") for i in range(1, 3)}
THRESHOLD_ID = _uid("approval.threshold.1")
BR = {i: _uid(f"budget.request.{i}") for i in range(1, 3)}
BS = {i: _uid(f"budget.step.{i}") for i in range(1, 3)}
BH = {i: _uid(f"budget.history.{i}") for i in range(1, 3)}

# Certificates
CERT_TEMPLATE_ID = _uid("cert.template.1")
CT = {i: _uid(f"certificate.{i}") for i in range(1, 3)}
CH = {i: _uid(f"cert.history.{i}") for i in range(1, 3)}

# Access Audit
AUDIT_ID = _uid("access.audit.q4.2025")
FN = {i: _uid(f"audit.finding.{i}") for i in range(1, 3)}

# Capability Review
CAP_REVIEW_ID = _uid("capability.review.meridian.2026")

# Phase 2 — Document Delivery, Scheduling, Evidence Vault
P2_DOC = {i: _uid(f"p2.document.{i}") for i in range(1, 8)}
P2_DELIVERY = {i: _uid(f"p2.delivery.{i}") for i in range(1, 5)}
P2_DOCREQ = {i: _uid(f"p2.docreq.{i}") for i in range(1, 4)}
P2_MTGTYPE = {i: _uid(f"p2.meetingtype.{i}") for i in range(1, 4)}
P2_AVAIL = {i: _uid(f"p2.availability.{i}") for i in range(1, 6)}
P2_MEETING = {i: _uid(f"p2.meeting.{i}") for i in range(1, 4)}
P2_EVENT = {i: _uid(f"p2.event.{i}") for i in range(1, 5)}


# ---------------------------------------------------------------------------
# Seed functions
# ---------------------------------------------------------------------------


async def seed_users(db: AsyncSession, pw_hash: str) -> None:
    """Seed 12 users."""
    logger.info("Seeding users...")
    users = [
        (MARCUS_ID, "marcus.wellington@amg.com",
         "Marcus Wellington", "managing_director"),
        (SARAH_ID, "sarah.blackwood@amg.com",
         "Sarah Blackwood", "relationship_manager"),
        (JAMES_ID, "james.chen@amg.com",
         "James Chen", "relationship_manager"),
        (ELENA_ID, "elena.vasquez@amg.com",
         "Elena Vasquez", "coordinator"),
        (DAVID_ID, "david.park@amg.com",
         "David Park", "coordinator"),
        (OLIVIA_ID, "olivia.grant@amg.com",
         "Olivia Grant", "finance_compliance"),
        (PHILIPPE_ID, "philippe.beaumont@amg.com",
         "Philippe Beaumont", "client"),
        (DIANA_ID, "diana.northcott@amg.com",
         "Diana Northcott", "client"),
        (ROBERT_ID, "robert.tanaka@amg.com",
         "Robert Tanaka", "client"),
        (CATHERINE_ID, "catherine.mercer@amg.com",
         "Catherine Mercer", "partner"),
        (ALEXANDER_ID, "alexander.volkov@amg.com",
         "Alexander Volkov", "partner"),
        (STEFAN_ID, "stefan.brandt@amg.com",
         "Stefan Brandt", "partner"),
    ]
    for uid, email, name, role in users:
        await get_or_create(
            db,
            User,
            defaults={
                "id": uid,
                "hashed_password": pw_hash,
                "full_name": name,
                "role": role,
                "status": "active",
                "mfa_enabled": False,
            },
            email=email,
        )


async def seed_clients(db: AsyncSession) -> None:
    """Seed 3 clients."""
    logger.info("Seeding clients...")
    clients = [
        (CLIENT_BEAUMONT_ID, "Beaumont Family Office",
         "family_office", SARAH_ID),
        (CLIENT_NORTHCOTT_ID, "Northcott Global Enterprises",
         "global_executive", SARAH_ID),
        (CLIENT_TANAKA_ID, "Tanaka Holdings",
         "uhnw_individual", JAMES_ID),
    ]
    for cid, name, ctype, rm_id in clients:
        await get_or_create(
            db,
            Client,
            defaults={
                "id": cid,
                "client_type": ctype,
                "rm_id": rm_id,
                "status": "active",
            },
            name=name,
        )


async def seed_client_profiles(db: AsyncSession) -> None:
    """Seed 3 client profiles."""
    logger.info("Seeding client profiles...")
    profiles = [
        {
            "id": PROFILE_BEAUMONT_ID,
            "legal_name": "Beaumont Family Office SA",
            "display_name": "Beaumont Family Office",
            "entity_type": "family_office",
            "jurisdiction": "Switzerland",
            "primary_email": "philippe.beaumont@amg.com",
            "compliance_status": "cleared",
            "approval_status": "approved",
            "compliance_reviewed_by": OLIVIA_ID,
            "compliance_reviewed_at": NOW - timedelta(days=60),
            "approved_by": MARCUS_ID,
            "approved_at": NOW - timedelta(days=58),
            "assigned_rm_id": SARAH_ID,
            "user_id": PHILIPPE_ID,
            "welcome_email_sent": True,
            "portal_access_enabled": True,
            "created_by": SARAH_ID,
        },
        {
            "id": PROFILE_NORTHCOTT_ID,
            "legal_name": "Northcott Global Enterprises Ltd",
            "display_name": "Northcott Global Enterprises",
            "entity_type": "global_executive",
            "jurisdiction": "United Kingdom",
            "primary_email": "diana.northcott@amg.com",
            "compliance_status": "under_review",
            "approval_status": "pending_md_approval",
            "compliance_reviewed_by": OLIVIA_ID,
            "compliance_reviewed_at": NOW - timedelta(days=5),
            "assigned_rm_id": SARAH_ID,
            "user_id": DIANA_ID,
            "welcome_email_sent": False,
            "portal_access_enabled": False,
            "created_by": SARAH_ID,
        },
        {
            "id": PROFILE_TANAKA_ID,
            "legal_name": "Tanaka Holdings KK",
            "display_name": "Tanaka Holdings",
            "entity_type": "uhnw_individual",
            "jurisdiction": "Japan",
            "primary_email": "robert.tanaka@amg.com",
            "compliance_status": "pending_review",
            "approval_status": "draft",
            "assigned_rm_id": JAMES_ID,
            "user_id": ROBERT_ID,
            "welcome_email_sent": False,
            "portal_access_enabled": False,
            "created_by": JAMES_ID,
        },
    ]
    for p in profiles:
        pid = p.pop("id")
        legal_name = p["legal_name"]
        await get_or_create(
            db,
            ClientProfile,
            defaults={"id": pid, **p},
            legal_name=legal_name,
        )


async def seed_partners(db: AsyncSession) -> None:
    """Seed 3 partner profiles."""
    logger.info("Seeding partner profiles...")
    partners = [
        {
            "id": PARTNER_MERIDIAN_ID,
            "user_id": CATHERINE_ID,
            "firm_name": "Meridian Advisors",
            "contact_name": "Catherine Mercer",
            "contact_email": "catherine.mercer@amg.com",
            "capabilities": [
                "investment_advisory", "tax_planning",
            ],
            "geographies": ["EMEA", "APAC"],
            "status": "active",
            "performance_rating": 4.5,
            "total_assignments": 8,
            "completed_assignments": 6,
            "compliance_verified": True,
            "created_by": ELENA_ID,
        },
        {
            "id": PARTNER_FORTRESS_ID,
            "user_id": ALEXANDER_ID,
            "firm_name": "Fortress Legal",
            "contact_name": "Alexander Volkov",
            "contact_email": "alexander.volkov@amg.com",
            "capabilities": ["legal", "estate_planning"],
            "geographies": ["EMEA", "Americas"],
            "status": "active",
            "performance_rating": 4.2,
            "total_assignments": 5,
            "completed_assignments": 4,
            "compliance_verified": True,
            "created_by": ELENA_ID,
        },
        {
            "id": PARTNER_ALPINE_ID,
            "user_id": STEFAN_ID,
            "firm_name": "Alpine Wealth",
            "contact_name": "Stefan Brandt",
            "contact_email": "stefan.brandt@amg.com",
            "capabilities": ["real_estate", "art_advisory"],
            "geographies": ["EMEA"],
            "status": "active",
            "performance_rating": 3.8,
            "total_assignments": 3,
            "completed_assignments": 2,
            "compliance_verified": True,
            "created_by": DAVID_ID,
        },
    ]
    for p in partners:
        pid = p.pop("id")
        firm = p["firm_name"]
        await get_or_create(
            db,
            PartnerProfile,
            defaults={"id": pid, **p},
            firm_name=firm,
        )


async def seed_programs(db: AsyncSession) -> None:
    """Seed 4 programs."""
    logger.info("Seeding programs...")
    programs = [
        {
            "id": PROG_ESTATE_ID,
            "client_id": CLIENT_BEAUMONT_ID,
            "title": "Beaumont Global Estate Plan",
            "objectives": (
                "Comprehensive estate planning across"
                " multi-jurisdictional holdings"
            ),
            "scope": (
                "Tax optimization, trust restructuring,"
                " succession planning"
            ),
            "budget_envelope": Decimal("2500000.00"),
            "start_date": date(2026, 1, 15),
            "end_date": None,
            "status": "active",
            "created_by": SARAH_ID,
        },
        {
            "id": PROG_RELOCATION_ID,
            "client_id": CLIENT_NORTHCOTT_ID,
            "title": "Northcott Executive Relocation",
            "objectives": (
                "Facilitate seamless executive"
                " relocation to Singapore"
            ),
            "scope": (
                "Immigration, housing, schooling,"
                " tax residency"
            ),
            "budget_envelope": Decimal("750000.00"),
            "start_date": None,
            "end_date": None,
            "status": "intake",
            "created_by": SARAH_ID,
        },
        {
            "id": PROG_PORTFOLIO_ID,
            "client_id": CLIENT_TANAKA_ID,
            "title": "Tanaka Investment Portfolio Review",
            "objectives": (
                "Annual portfolio review and rebalancing"
            ),
            "scope": (
                "Equity, fixed income, alternatives,"
                " real estate"
            ),
            "budget_envelope": Decimal("500000.00"),
            "start_date": date(2025, 10, 1),
            "end_date": date(2026, 2, 28),
            "status": "completed",
            "created_by": JAMES_ID,
        },
        {
            "id": PROG_ART_ID,
            "client_id": CLIENT_BEAUMONT_ID,
            "title": "Beaumont Art Collection Acquisition",
            "objectives": (
                "Acquire and curate contemporary"
                " art collection"
            ),
            "scope": (
                "Sourcing, authentication,"
                " insurance, storage"
            ),
            "budget_envelope": Decimal("5000000.00"),
            "start_date": date(2026, 2, 1),
            "end_date": None,
            "status": "on_hold",
            "created_by": SARAH_ID,
        },
    ]
    for p in programs:
        pid = p.pop("id")
        title = p["title"]
        await get_or_create(
            db,
            Program,
            defaults={"id": pid, **p},
            title=title,
        )


async def seed_milestones(db: AsyncSession) -> None:
    """Seed ~15 milestones across 4 programs."""
    logger.info("Seeding milestones...")
    # (id, program_id, title, status, due_date, position)
    milestones = [
        # Estate Plan - 4 milestones
        (MS[1], PROG_ESTATE_ID, "Jurisdictional Analysis",
         "completed", date(2026, 2, 15), 0),
        (MS[2], PROG_ESTATE_ID, "Trust Structure Design",
         "in_progress", date(2026, 4, 1), 1),
        (MS[3], PROG_ESTATE_ID, "Tax Optimization Review",
         "at_risk", date(2026, 4, 15), 2),
        (MS[4], PROG_ESTATE_ID, "Succession Plan Drafting",
         "pending", date(2026, 6, 1), 3),
        # Relocation - 3 milestones
        (MS[5], PROG_RELOCATION_ID, "Immigration Assessment",
         "pending", date(2026, 5, 1), 0),
        (MS[6], PROG_RELOCATION_ID, "Housing Search",
         "pending", date(2026, 6, 1), 1),
        (MS[7], PROG_RELOCATION_ID, "School Enrollment",
         "pending", date(2026, 7, 1), 2),
        # Portfolio Review - 5 milestones (all completed)
        (MS[8], PROG_PORTFOLIO_ID, "Portfolio Audit",
         "completed", date(2025, 10, 31), 0),
        (MS[9], PROG_PORTFOLIO_ID, "Risk Assessment",
         "completed", date(2025, 11, 30), 1),
        (MS[10], PROG_PORTFOLIO_ID, "Rebalancing Strategy",
         "completed", date(2025, 12, 31), 2),
        (MS[11], PROG_PORTFOLIO_ID, "Implementation",
         "completed", date(2026, 1, 31), 3),
        (MS[12], PROG_PORTFOLIO_ID, "Final Report",
         "completed", date(2026, 2, 28), 4),
        # Art Collection - 3 milestones
        (MS[13], PROG_ART_ID, "Curator Selection",
         "in_progress", date(2026, 3, 15), 0),
        (MS[14], PROG_ART_ID, "Artwork Sourcing",
         "pending", date(2026, 5, 1), 1),
        (MS[15], PROG_ART_ID, "Authentication & Insurance",
         "pending", date(2026, 7, 1), 2),
    ]
    for mid, prog_id, title, status, due, pos in milestones:
        await get_or_create(
            db,
            Milestone,
            defaults={
                "id": mid,
                "program_id": prog_id,
                "status": status,
                "due_date": due,
                "position": pos,
            },
            title=title,
            program_id=prog_id,
        )


async def seed_tasks(db: AsyncSession) -> None:
    """Seed ~40 tasks across milestones."""
    logger.info("Seeding tasks...")
    # (idx, ms_id, title, status, priority, due, assigned_to, pos)
    tasks = [
        # Estate Plan - MS1 (completed)
        (1, MS[1], "Review Swiss holdings",
         "done", "high", date(2026, 2, 1), ELENA_ID, 0),
        (2, MS[1], "Review UK holdings",
         "done", "high", date(2026, 2, 5), ELENA_ID, 1),
        (3, MS[1], "Review French holdings",
         "done", "medium", date(2026, 2, 10), DAVID_ID, 2),
        # Estate Plan - MS2 (in_progress)
        (4, MS[2], "Draft trust deed template",
         "in_progress", "high", date(2026, 3, 20), ELENA_ID, 0),
        (5, MS[2], "Identify trustee candidates",
         "todo", "medium", date(2026, 3, 25), DAVID_ID, 1),
        (6, MS[2], "Legal review of trust structures",
         "blocked", "urgent", date(2026, 3, 30), ELENA_ID, 2),
        # Estate Plan - MS3 (at_risk)
        (7, MS[3], "Gather tax filings (3 years)",
         "in_progress", "urgent", date(2026, 3, 20), DAVID_ID, 0),
        (8, MS[3], "Model tax scenarios",
         "todo", "high", date(2026, 4, 1), ELENA_ID, 1),
        (9, MS[3], "Prepare optimization memo",
         "todo", "medium", date(2026, 4, 10), DAVID_ID, 2),
        # Estate Plan - MS4 (pending)
        (10, MS[4], "Interview family members",
         "todo", "medium", date(2026, 5, 1), SARAH_ID, 0),
        (11, MS[4], "Draft succession framework",
         "todo", "high", date(2026, 5, 15), ELENA_ID, 1),
        (12, MS[4], "Legal validation",
         "todo", "medium", date(2026, 5, 25), DAVID_ID, 2),
        # Relocation - MS5
        (13, MS[5], "Gather visa requirements",
         "todo", "high", date(2026, 4, 15), DAVID_ID, 0),
        (14, MS[5], "Submit EP application",
         "todo", "urgent", date(2026, 4, 25), ELENA_ID, 1),
        (15, MS[5], "Tax residency analysis",
         "todo", "medium", date(2026, 5, 1), DAVID_ID, 2),
        # Relocation - MS6
        (16, MS[6], "Identify property options",
         "todo", "medium", date(2026, 5, 15), ELENA_ID, 0),
        (17, MS[6], "Schedule viewings",
         "todo", "low", date(2026, 5, 25), DAVID_ID, 1),
        (18, MS[6], "Negotiate lease terms",
         "todo", "medium", date(2026, 6, 1), ELENA_ID, 2),
        # Relocation - MS7
        (19, MS[7], "Research international schools",
         "todo", "medium", date(2026, 6, 1), DAVID_ID, 0),
        (20, MS[7], "Prepare applications",
         "todo", "high", date(2026, 6, 15), ELENA_ID, 1),
        # Portfolio Review - MS8 (completed)
        (21, MS[8], "Collect account statements",
         "done", "high", date(2025, 10, 15), DAVID_ID, 0),
        (22, MS[8], "Categorize holdings",
         "done", "medium", date(2025, 10, 25), ELENA_ID, 1),
        # Portfolio Review - MS9 (completed)
        (23, MS[9], "Run risk models",
         "done", "high", date(2025, 11, 15), ELENA_ID, 0),
        (24, MS[9], "Stress test portfolio",
         "done", "high", date(2025, 11, 25), DAVID_ID, 1),
        (25, MS[9], "Identify concentration risks",
         "done", "medium", date(2025, 11, 30), ELENA_ID, 2),
        # Portfolio Review - MS10 (completed)
        (26, MS[10], "Propose rebalancing targets",
         "done", "high", date(2025, 12, 15), ELENA_ID, 0),
        (27, MS[10], "Model tax implications",
         "done", "medium", date(2025, 12, 25), DAVID_ID, 1),
        (28, MS[10], "Get client sign-off",
         "done", "urgent", date(2025, 12, 31), JAMES_ID, 2),
        # Portfolio Review - MS11 (completed)
        (29, MS[11], "Execute equity trades",
         "done", "urgent", date(2026, 1, 15), ELENA_ID, 0),
        (30, MS[11], "Execute fixed income trades",
         "done", "high", date(2026, 1, 20), DAVID_ID, 1),
        (31, MS[11], "Update alternative allocations",
         "done", "medium", date(2026, 1, 31), ELENA_ID, 2),
        # Portfolio Review - MS12 (completed)
        (32, MS[12], "Draft performance summary",
         "done", "high", date(2026, 2, 15), DAVID_ID, 0),
        (33, MS[12], "Compile final report",
         "done", "high", date(2026, 2, 25), ELENA_ID, 1),
        (34, MS[12], "Client presentation",
         "done", "urgent", date(2026, 2, 28), JAMES_ID, 2),
        # Art Collection - MS13 (in_progress)
        (35, MS[13], "Research curator candidates",
         "in_progress", "high", date(2026, 3, 10), ELENA_ID, 0),
        (36, MS[13], "Interview shortlist",
         "todo", "medium", date(2026, 3, 15), DAVID_ID, 1),
        # Art Collection - MS14 (pending)
        (37, MS[14], "Identify target artworks",
         "todo", "medium", date(2026, 4, 15), ELENA_ID, 0),
        (38, MS[14], "Attend auctions",
         "todo", "high", date(2026, 4, 30), DAVID_ID, 1),
        # Art Collection - MS15 (pending)
        (39, MS[15], "Engage authentication experts",
         "todo", "medium", date(2026, 6, 1), ELENA_ID, 0),
        (40, MS[15], "Arrange insurance coverage",
         "todo", "high", date(2026, 6, 30), DAVID_ID, 1),
    ]
    for idx, ms_id, title, status, priority, due, assigned, pos in tasks:
        await get_or_create(
            db,
            Task,
            defaults={
                "id": TK[idx],
                "milestone_id": ms_id,
                "status": status,
                "priority": priority,
                "due_date": due,
                "assigned_to": assigned,
                "position": pos,
            },
            title=title,
            milestone_id=ms_id,
        )


async def seed_assignments(db: AsyncSession) -> None:
    """Seed 5 partner assignments."""
    logger.info("Seeding assignments...")
    assignments = [
        {
            "id": AS[1],
            "partner_id": PARTNER_FORTRESS_ID,
            "program_id": PROG_ESTATE_ID,
            "assigned_by": ELENA_ID,
            "title": "Estate Legal Review",
            "brief": (
                "Review and advise on multi-jurisdictional"
                " estate structures for the Beaumont family."
            ),
            "status": "in_progress",
            "due_date": date(2026, 5, 1),
            "accepted_at": NOW - timedelta(days=30),
        },
        {
            "id": AS[2],
            "partner_id": PARTNER_MERIDIAN_ID,
            "program_id": PROG_ESTATE_ID,
            "assigned_by": ELENA_ID,
            "title": "Tax Optimization Analysis",
            "brief": (
                "Analyze cross-border tax implications"
                " and propose optimization strategies."
            ),
            "status": "accepted",
            "due_date": date(2026, 4, 15),
            "accepted_at": NOW - timedelta(days=14),
        },
        {
            "id": AS[3],
            "partner_id": PARTNER_MERIDIAN_ID,
            "program_id": PROG_PORTFOLIO_ID,
            "assigned_by": DAVID_ID,
            "title": "Portfolio Rebalancing Advisory",
            "brief": (
                "Provide recommendations for portfolio"
                " rebalancing based on market conditions."
            ),
            "status": "completed",
            "due_date": date(2026, 1, 31),
            "accepted_at": NOW - timedelta(days=120),
            "completed_at": NOW - timedelta(days=20),
        },
        {
            "id": AS[4],
            "partner_id": PARTNER_FORTRESS_ID,
            "program_id": PROG_PORTFOLIO_ID,
            "assigned_by": DAVID_ID,
            "title": "Investment Compliance Review",
            "brief": (
                "Review portfolio compliance with"
                " regulatory requirements across"
                " jurisdictions."
            ),
            "status": "completed",
            "due_date": date(2026, 2, 15),
            "accepted_at": NOW - timedelta(days=90),
            "completed_at": NOW - timedelta(days=25),
        },
        {
            "id": AS[5],
            "partner_id": PARTNER_ALPINE_ID,
            "program_id": PROG_ART_ID,
            "assigned_by": ELENA_ID,
            "title": "Art Collection Valuation",
            "brief": (
                "Provide initial valuation and"
                " acquisition strategy for"
                " contemporary art pieces."
            ),
            "status": "accepted",
            "due_date": date(2026, 4, 30),
            "accepted_at": NOW - timedelta(days=7),
        },
    ]
    for a in assignments:
        aid = a.pop("id")
        title = a["title"]
        prog = a["program_id"]
        await get_or_create(
            db,
            PartnerAssignment,
            defaults={"id": aid, **a},
            title=title,
            program_id=prog,
        )


async def seed_deliverables(db: AsyncSession) -> None:
    """Seed 8 deliverables."""
    logger.info("Seeding deliverables...")
    deliverables = [
        # Assignment 1 - Estate Legal Review (in_progress)
        {
            "id": DL[1],
            "assignment_id": AS[1],
            "title": "Jurisdictional Analysis Report",
            "deliverable_type": "report",
            "status": "submitted",
            "due_date": date(2026, 3, 15),
            "submitted_by": ALEXANDER_ID,
            "submitted_at": NOW - timedelta(days=3),
        },
        {
            "id": DL[2],
            "assignment_id": AS[1],
            "title": "Trust Structure Recommendations",
            "deliverable_type": "document",
            "status": "pending",
            "due_date": date(2026, 4, 15),
        },
        # Assignment 2 - Tax Optimization (accepted)
        {
            "id": DL[3],
            "assignment_id": AS[2],
            "title": "Cross-Border Tax Memo",
            "deliverable_type": "document",
            "status": "under_review",
            "due_date": date(2026, 4, 1),
            "submitted_by": CATHERINE_ID,
            "submitted_at": NOW - timedelta(days=1),
            "reviewed_by": SARAH_ID,
        },
        # Assignment 3 - Portfolio Rebalancing (completed)
        {
            "id": DL[4],
            "assignment_id": AS[3],
            "title": "Rebalancing Strategy Deck",
            "deliverable_type": "presentation",
            "status": "approved",
            "due_date": date(2026, 1, 25),
            "submitted_by": CATHERINE_ID,
            "submitted_at": NOW - timedelta(days=50),
            "reviewed_by": JAMES_ID,
            "reviewed_at": NOW - timedelta(days=48),
            "client_visible": True,
        },
        {
            "id": DL[5],
            "assignment_id": AS[3],
            "title": "Performance Attribution Report",
            "deliverable_type": "report",
            "status": "approved",
            "due_date": date(2026, 2, 20),
            "submitted_by": CATHERINE_ID,
            "submitted_at": NOW - timedelta(days=25),
            "reviewed_by": JAMES_ID,
            "reviewed_at": NOW - timedelta(days=22),
            "client_visible": True,
        },
        # Assignment 4 - Compliance Review (completed)
        {
            "id": DL[6],
            "assignment_id": AS[4],
            "title": "Compliance Assessment Report",
            "deliverable_type": "report",
            "status": "approved",
            "due_date": date(2026, 2, 10),
            "submitted_by": ALEXANDER_ID,
            "submitted_at": NOW - timedelta(days=35),
            "reviewed_by": JAMES_ID,
            "reviewed_at": NOW - timedelta(days=30),
            "client_visible": True,
        },
        # Assignment 5 - Art Valuation (accepted)
        {
            "id": DL[7],
            "assignment_id": AS[5],
            "title": "Market Analysis Report",
            "deliverable_type": "report",
            "status": "pending",
            "due_date": date(2026, 4, 15),
        },
        {
            "id": DL[8],
            "assignment_id": AS[5],
            "title": "Acquisition Strategy Presentation",
            "deliverable_type": "presentation",
            "status": "pending",
            "due_date": date(2026, 4, 30),
        },
    ]
    for d in deliverables:
        did = d.pop("id")
        title = d["title"]
        assign = d["assignment_id"]
        await get_or_create(
            db,
            Deliverable,
            defaults={"id": did, **d},
            title=title,
            assignment_id=assign,
        )


async def seed_conversations(db: AsyncSession) -> None:
    """Seed 4 conversations."""
    logger.info("Seeding conversations...")
    convs = [
        {
            "id": CV[1],
            "conversation_type": "rm_client",
            "client_id": PROFILE_BEAUMONT_ID,
            "title": "Beaumont Estate Planning Discussion",
            "participant_ids": [SARAH_ID, PHILIPPE_ID],
            "last_activity_at": NOW - timedelta(hours=2),
        },
        {
            "id": CV[2],
            "conversation_type": "coordinator_partner",
            "partner_assignment_id": AS[1],
            "title": (
                "Estate Legal Review"
                " — Fortress Legal"
            ),
            "participant_ids": [ELENA_ID, ALEXANDER_ID],
            "last_activity_at": NOW - timedelta(hours=6),
        },
        {
            "id": CV[3],
            "conversation_type": "internal",
            "title": "Estate Plan Internal Coordination",
            "participant_ids": [
                SARAH_ID, ELENA_ID, DAVID_ID,
            ],
            "last_activity_at": NOW - timedelta(days=1),
        },
        {
            "id": CV[4],
            "conversation_type": "rm_client",
            "client_id": PROFILE_TANAKA_ID,
            "title": "Tanaka Portfolio Review Follow-up",
            "participant_ids": [JAMES_ID, ROBERT_ID],
            "last_activity_at": NOW - timedelta(days=3),
        },
    ]
    for c in convs:
        cid = c.pop("id")
        title = c["title"]
        await get_or_create(
            db,
            Conversation,
            defaults={"id": cid, **c},
            title=title,
        )


async def seed_communications(db: AsyncSession) -> None:
    """Seed 12 communications (threaded messages)."""
    logger.info("Seeding communications...")

    def _ts(dt: datetime) -> str:
        return dt.isoformat()

    comms = [
        # Conv 1 - RM <-> Client Beaumont (3 messages)
        {
            "id": CM[1],
            "conversation_id": CV[1],
            "channel": "in_portal",
            "status": "read",
            "sender_id": SARAH_ID,
            "recipients": {
                str(PHILIPPE_ID): {"role": "to"},
            },
            "subject": "Estate Plan Update",
            "body": (
                "Dear Philippe, I wanted to update you on"
                " the progress of your estate plan. We have"
                " completed the jurisdictional analysis and"
                " are now moving into trust structure design."
            ),
            "client_id": PROFILE_BEAUMONT_ID,
            "program_id": PROG_ESTATE_ID,
            "read_receipts": {
                str(PHILIPPE_ID): {
                    "read_at": _ts(NOW - timedelta(hours=5)),
                },
            },
            "sent_at": NOW - timedelta(hours=8),
        },
        {
            "id": CM[2],
            "conversation_id": CV[1],
            "channel": "in_portal",
            "status": "read",
            "sender_id": PHILIPPE_ID,
            "recipients": {
                str(SARAH_ID): {"role": "to"},
            },
            "body": (
                "Thank you Sarah. Could you provide more"
                " detail on the trust structure options"
                " being considered?"
            ),
            "client_id": PROFILE_BEAUMONT_ID,
            "program_id": PROG_ESTATE_ID,
            "read_receipts": {
                str(SARAH_ID): {
                    "read_at": _ts(NOW - timedelta(hours=4)),
                },
            },
            "sent_at": NOW - timedelta(hours=5),
        },
        {
            "id": CM[3],
            "conversation_id": CV[1],
            "channel": "in_portal",
            "status": "delivered",
            "sender_id": SARAH_ID,
            "recipients": {
                str(PHILIPPE_ID): {"role": "to"},
            },
            "body": (
                "Of course. Our partner Fortress Legal is"
                " preparing a comprehensive analysis. I will"
                " share the preliminary findings with you"
                " by end of this week."
            ),
            "client_id": PROFILE_BEAUMONT_ID,
            "program_id": PROG_ESTATE_ID,
            "read_receipts": {},
            "sent_at": NOW - timedelta(hours=2),
        },
        # Conv 2 - Coordinator <-> Partner (3 messages)
        {
            "id": CM[4],
            "conversation_id": CV[2],
            "channel": "in_portal",
            "status": "read",
            "sender_id": ELENA_ID,
            "recipients": {
                str(ALEXANDER_ID): {"role": "to"},
            },
            "subject": "Legal Review — Documents Needed",
            "body": (
                "Alexander, we need the jurisdictional"
                " analysis report by March 15th."
                " Please confirm you are on track."
            ),
            "partner_id": PARTNER_FORTRESS_ID,
            "program_id": PROG_ESTATE_ID,
            "read_receipts": {
                str(ALEXANDER_ID): {
                    "read_at": _ts(
                        NOW - timedelta(hours=12)
                    ),
                },
            },
            "sent_at": NOW - timedelta(days=1),
        },
        {
            "id": CM[5],
            "conversation_id": CV[2],
            "channel": "in_portal",
            "status": "read",
            "sender_id": ALEXANDER_ID,
            "recipients": {
                str(ELENA_ID): {"role": "to"},
            },
            "body": (
                "Confirmed. The report has been submitted"
                " via the portal. Please review at your"
                " convenience."
            ),
            "partner_id": PARTNER_FORTRESS_ID,
            "program_id": PROG_ESTATE_ID,
            "read_receipts": {
                str(ELENA_ID): {
                    "read_at": _ts(
                        NOW - timedelta(hours=8)
                    ),
                },
            },
            "sent_at": NOW - timedelta(hours=10),
        },
        {
            "id": CM[6],
            "conversation_id": CV[2],
            "channel": "in_portal",
            "status": "sent",
            "sender_id": ELENA_ID,
            "recipients": {
                str(ALEXANDER_ID): {"role": "to"},
            },
            "body": (
                "Received, thank you. I will review and"
                " provide feedback within 48 hours."
            ),
            "partner_id": PARTNER_FORTRESS_ID,
            "program_id": PROG_ESTATE_ID,
            "read_receipts": {},
            "sent_at": NOW - timedelta(hours=6),
        },
        # Conv 3 - Internal coordination (3 messages)
        {
            "id": CM[7],
            "conversation_id": CV[3],
            "channel": "in_portal",
            "status": "read",
            "sender_id": SARAH_ID,
            "recipients": {
                str(ELENA_ID): {"role": "to"},
                str(DAVID_ID): {"role": "cc"},
            },
            "subject": "Estate Plan — Coordination Meeting",
            "body": (
                "Team, let us schedule a sync this week to"
                " review milestone progress on the Beaumont"
                " estate plan. The tax optimization"
                " workstream is at risk."
            ),
            "program_id": PROG_ESTATE_ID,
            "read_receipts": {
                str(ELENA_ID): {
                    "read_at": _ts(NOW - timedelta(days=1)),
                },
                str(DAVID_ID): {
                    "read_at": _ts(NOW - timedelta(days=1)),
                },
            },
            "sent_at": NOW - timedelta(days=1, hours=4),
        },
        {
            "id": CM[8],
            "conversation_id": CV[3],
            "channel": "in_portal",
            "status": "read",
            "sender_id": ELENA_ID,
            "recipients": {
                str(SARAH_ID): {"role": "to"},
                str(DAVID_ID): {"role": "cc"},
            },
            "body": (
                "Agreed. I have flagged the blocked legal"
                " review task. Can we meet Wednesday"
                " at 10am?"
            ),
            "program_id": PROG_ESTATE_ID,
            "read_receipts": {
                str(SARAH_ID): {
                    "read_at": _ts(
                        NOW - timedelta(hours=20)
                    ),
                },
                str(DAVID_ID): {
                    "read_at": _ts(
                        NOW - timedelta(hours=20)
                    ),
                },
            },
            "sent_at": NOW - timedelta(days=1),
        },
        {
            "id": CM[9],
            "conversation_id": CV[3],
            "channel": "in_portal",
            "status": "delivered",
            "sender_id": DAVID_ID,
            "recipients": {
                str(SARAH_ID): {"role": "to"},
                str(ELENA_ID): {"role": "cc"},
            },
            "body": (
                "Wednesday 10am works for me. I will"
                " prepare the tax filing status update."
            ),
            "program_id": PROG_ESTATE_ID,
            "read_receipts": {},
            "sent_at": NOW - timedelta(hours=20),
        },
        # Conv 4 - RM <-> Client Tanaka (3 messages)
        {
            "id": CM[10],
            "conversation_id": CV[4],
            "channel": "in_portal",
            "status": "read",
            "sender_id": JAMES_ID,
            "recipients": {
                str(ROBERT_ID): {"role": "to"},
            },
            "subject": "Portfolio Review Complete",
            "body": (
                "Robert, I am pleased to confirm that the"
                " portfolio review has been completed. All"
                " deliverables are approved and available"
                " in the portal."
            ),
            "client_id": PROFILE_TANAKA_ID,
            "program_id": PROG_PORTFOLIO_ID,
            "read_receipts": {
                str(ROBERT_ID): {
                    "read_at": _ts(
                        NOW - timedelta(days=2)
                    ),
                },
            },
            "sent_at": NOW - timedelta(days=3),
        },
        {
            "id": CM[11],
            "conversation_id": CV[4],
            "channel": "in_portal",
            "status": "read",
            "sender_id": ROBERT_ID,
            "recipients": {
                str(JAMES_ID): {"role": "to"},
            },
            "body": (
                "Thank you James. The results look"
                " excellent. I would like to discuss next"
                " steps for Q2 when convenient."
            ),
            "client_id": PROFILE_TANAKA_ID,
            "program_id": PROG_PORTFOLIO_ID,
            "read_receipts": {
                str(JAMES_ID): {
                    "read_at": _ts(
                        NOW - timedelta(days=2)
                    ),
                },
            },
            "sent_at": NOW - timedelta(days=3, hours=-4),
        },
        {
            "id": CM[12],
            "conversation_id": CV[4],
            "channel": "in_portal",
            "status": "sent",
            "sender_id": JAMES_ID,
            "recipients": {
                str(ROBERT_ID): {"role": "to"},
            },
            "body": (
                "Absolutely. I will send a calendar invite"
                " for next week. In the meantime, the"
                " closure report is being finalized."
            ),
            "client_id": PROFILE_TANAKA_ID,
            "program_id": PROG_PORTFOLIO_ID,
            "read_receipts": {},
            "sent_at": NOW - timedelta(days=2),
        },
    ]
    for c in comms:
        cid = c.pop("id")
        await get_or_create(
            db,
            Communication,
            defaults={"id": cid, **c},
            id=cid,
        )


async def seed_documents(db: AsyncSession) -> None:
    """Seed 6 documents."""
    logger.info("Seeding documents...")
    base = "/uploads/clients"
    docs = [
        {
            "id": DC[1],
            "file_path": f"{base}/beaumont/passport_philippe.pdf",
            "file_name": "passport_philippe.pdf",
            "file_size": 245000,
            "content_type": "application/pdf",
            "entity_type": "client",
            "entity_id": CLIENT_BEAUMONT_ID,
            "category": "compliance",
            "description": "Philippe Beaumont — Passport",
            "uploaded_by": SARAH_ID,
        },
        {
            "id": DC[2],
            "file_path": f"{base}/beaumont/proof_of_address.pdf",
            "file_name": "proof_of_address.pdf",
            "file_size": 180000,
            "content_type": "application/pdf",
            "entity_type": "client",
            "entity_id": CLIENT_BEAUMONT_ID,
            "category": "compliance",
            "description": (
                "Philippe Beaumont — Proof of Address"
            ),
            "uploaded_by": SARAH_ID,
        },
        {
            "id": DC[3],
            "file_path": f"{base}/northcott/passport_diana.pdf",
            "file_name": "passport_diana.pdf",
            "file_size": 230000,
            "content_type": "application/pdf",
            "entity_type": "client",
            "entity_id": CLIENT_NORTHCOTT_ID,
            "category": "compliance",
            "description": "Diana Northcott — Passport",
            "uploaded_by": SARAH_ID,
        },
        {
            "id": DC[4],
            "file_path": f"{base}/northcott/utility_bill.pdf",
            "file_name": "utility_bill.pdf",
            "file_size": 120000,
            "content_type": "application/pdf",
            "entity_type": "client",
            "entity_id": CLIENT_NORTHCOTT_ID,
            "category": "compliance",
            "description": (
                "Diana Northcott — Utility Bill"
                " (Proof of Address)"
            ),
            "uploaded_by": SARAH_ID,
        },
        {
            "id": DC[5],
            "file_path": f"{base}/tanaka/passport_robert.pdf",
            "file_name": "passport_robert.pdf",
            "file_size": 260000,
            "content_type": "application/pdf",
            "entity_type": "client",
            "entity_id": CLIENT_TANAKA_ID,
            "category": "compliance",
            "description": "Robert Tanaka — Passport",
            "uploaded_by": JAMES_ID,
        },
        {
            "id": DC[6],
            "file_path": (
                f"{base}/tanaka/residence_certificate.pdf"
            ),
            "file_name": "residence_certificate.pdf",
            "file_size": 195000,
            "content_type": "application/pdf",
            "entity_type": "client",
            "entity_id": CLIENT_TANAKA_ID,
            "category": "compliance",
            "description": (
                "Robert Tanaka — Residence Certificate"
                " (Proof of Address)"
            ),
            "uploaded_by": JAMES_ID,
        },
    ]
    for d in docs:
        did = d.pop("id")
        await get_or_create(
            db,
            Document,
            defaults={"id": did, **d},
            id=did,
        )


async def seed_kyc_documents(db: AsyncSession) -> None:
    """Seed 6 KYC documents (2 per client)."""
    logger.info("Seeding KYC documents...")
    kyc_docs = [
        # Beaumont - verified
        {
            "id": KY[1],
            "client_id": CLIENT_BEAUMONT_ID,
            "document_id": DC[1],
            "document_type": "passport",
            "status": "verified",
            "expiry_date": date(2030, 6, 15),
            "verified_by": OLIVIA_ID,
            "verified_at": NOW - timedelta(days=60),
        },
        {
            "id": KY[2],
            "client_id": CLIENT_BEAUMONT_ID,
            "document_id": DC[2],
            "document_type": "proof_of_address",
            "status": "verified",
            "verified_by": OLIVIA_ID,
            "verified_at": NOW - timedelta(days=60),
        },
        # Northcott - pending
        {
            "id": KY[3],
            "client_id": CLIENT_NORTHCOTT_ID,
            "document_id": DC[3],
            "document_type": "passport",
            "status": "pending",
            "expiry_date": date(2029, 9, 20),
        },
        {
            "id": KY[4],
            "client_id": CLIENT_NORTHCOTT_ID,
            "document_id": DC[4],
            "document_type": "proof_of_address",
            "status": "pending",
        },
        # Tanaka - verified
        {
            "id": KY[5],
            "client_id": CLIENT_TANAKA_ID,
            "document_id": DC[5],
            "document_type": "passport",
            "status": "verified",
            "expiry_date": date(2031, 3, 10),
            "verified_by": OLIVIA_ID,
            "verified_at": NOW - timedelta(days=120),
        },
        {
            "id": KY[6],
            "client_id": CLIENT_TANAKA_ID,
            "document_id": DC[6],
            "document_type": "proof_of_address",
            "status": "verified",
            "verified_by": OLIVIA_ID,
            "verified_at": NOW - timedelta(days=120),
        },
    ]
    for k in kyc_docs:
        kid = k.pop("id")
        await get_or_create(
            db,
            KYCDocument,
            defaults={"id": kid, **k},
            id=kid,
        )


async def seed_notifications(db: AsyncSession) -> None:
    """Seed 15 notifications."""
    logger.info("Seeding notifications...")
    prog_url = f"/programs/{PROG_ESTATE_ID}"
    notifs = [
        # Sarah - 4 notifications
        (1, SARAH_ID, "milestone_update",
         "Milestone At Risk",
         "Tax Optimization Review is at risk.",
         f"{prog_url}/milestones", "View Milestone", False),
        (2, SARAH_ID, "deliverable_ready",
         "Deliverable Submitted",
         "Jurisdictional Analysis Report submitted.",
         f"/deliverables/{DL[1]}", "Review", False),
        (3, SARAH_ID, "communication",
         "New Message",
         "Philippe Beaumont sent a message.",
         "/communications", "View", True),
        (4, SARAH_ID, "approval_required",
         "Client Profile Approval",
         "Northcott profile requires MD approval.",
         "/clients", "Review", False),
        # Marcus - 2 notifications
        (5, MARCUS_ID, "approval_required",
         "Budget Approval Needed",
         "Budget increase request needs approval.",
         "/budget-approvals", "Review", False),
        (6, MARCUS_ID, "system",
         "Weekly Portfolio Summary",
         "Your weekly portfolio summary is ready.",
         "/reports", "View Report", True),
        # Elena - 3 notifications
        (7, ELENA_ID, "assignment_update",
         "Assignment Accepted",
         "Alpine Wealth accepted Art Valuation.",
         f"/assignments/{AS[5]}", "View", True),
        (8, ELENA_ID, "milestone_update",
         "Task Blocked",
         "Legal review of trust structures blocked.",
         prog_url, "View", False),
        (9, ELENA_ID, "communication",
         "New Message from Partner",
         "Alexander Volkov sent a message.",
         "/communications", "View", True),
        # James - 2 notifications
        (10, JAMES_ID, "decision_pending",
         "Decision Required",
         "Robert Tanaka needs to respond to Q2.",
         "/decisions", "View", False),
        (11, JAMES_ID, "system",
         "Program Closure Complete",
         "Tanaka Portfolio Review closure done.",
         f"/programs/{PROG_PORTFOLIO_ID}", "View", True),
        # Philippe - 2 notifications
        (12, PHILIPPE_ID, "communication",
         "Message from RM",
         "Sarah Blackwood sent an estate update.",
         "/communications", "View", False),
        (13, PHILIPPE_ID, "decision_pending",
         "Decision Required",
         "Pending decision on trust structure.",
         "/decisions", "Respond", False),
        # Olivia - 2 notifications
        (14, OLIVIA_ID, "system",
         "Access Audit Complete",
         "Q4 2025 access audit completed.",
         "/access-audits", "View", True),
        (15, OLIVIA_ID, "approval_required",
         "KYC Review Needed",
         "Northcott KYC documents need verification.",
         "/kyc", "Review", False),
    ]
    for row in notifs:
        idx, user_id, ntype, title, body, url, label, is_read = row
        await get_or_create(
            db,
            Notification,
            defaults={
                "id": NF[idx],
                "user_id": user_id,
                "notification_type": ntype,
                "title": title,
                "body": body,
                "action_url": url,
                "action_label": label,
                "priority": "medium",
                "is_read": is_read,
                "read_at": (
                    (NOW - timedelta(hours=4))
                    if is_read
                    else None
                ),
            },
            id=NF[idx],
        )


async def seed_escalations(db: AsyncSession) -> None:
    """Seed 3 escalations."""
    logger.info("Seeding escalations...")
    escalations = [
        # Open - task level
        {
            "id": ES[1],
            "level": "task",
            "status": "open",
            "title": "Blocked: Legal review of trust structures",
            "description": (
                "Task has been blocked for 5 days"
                " waiting on partner input."
            ),
            "entity_type": "task",
            "entity_id": str(TK[6]),
            "owner_id": ELENA_ID,
            "program_id": PROG_ESTATE_ID,
            "client_id": CLIENT_BEAUMONT_ID,
            "triggered_at": NOW - timedelta(days=2),
            "triggered_by": ELENA_ID,
            "risk_factors": {
                "days_blocked": 5,
                "milestone_at_risk": True,
            },
        },
        # Acknowledged - milestone level
        {
            "id": ES[2],
            "level": "milestone",
            "status": "acknowledged",
            "title": "At Risk: Tax Optimization Review",
            "description": (
                "Tax optimization milestone is at risk"
                " due to delayed tax filings."
            ),
            "entity_type": "milestone",
            "entity_id": str(MS[3]),
            "owner_id": SARAH_ID,
            "program_id": PROG_ESTATE_ID,
            "client_id": CLIENT_BEAUMONT_ID,
            "triggered_at": NOW - timedelta(days=5),
            "triggered_by": DAVID_ID,
            "acknowledged_at": NOW - timedelta(days=4),
            "risk_factors": {
                "days_overdue": 3,
                "budget_impact": False,
            },
        },
        # Resolved - program level
        {
            "id": ES[3],
            "level": "program",
            "status": "resolved",
            "title": (
                "Portfolio Review — Delayed Rebalancing"
            ),
            "description": (
                "Rebalancing implementation was delayed"
                " due to market volatility."
            ),
            "entity_type": "program",
            "entity_id": str(PROG_PORTFOLIO_ID),
            "owner_id": JAMES_ID,
            "program_id": PROG_PORTFOLIO_ID,
            "client_id": CLIENT_TANAKA_ID,
            "triggered_at": NOW - timedelta(days=60),
            "triggered_by": JAMES_ID,
            "acknowledged_at": NOW - timedelta(days=59),
            "resolved_at": NOW - timedelta(days=45),
            "resolution_notes": (
                "Market conditions stabilized."
                " Rebalancing executed successfully."
            ),
        },
    ]
    for e in escalations:
        eid = e.pop("id")
        await get_or_create(
            db,
            Escalation,
            defaults={"id": eid, **e},
            id=eid,
        )


async def seed_sla_trackers(db: AsyncSession) -> None:
    """Seed 4 SLA trackers."""
    logger.info("Seeding SLA trackers...")
    slas = [
        # Within SLA
        {
            "id": SL[1],
            "entity_type": "communication",
            "entity_id": str(CM[3]),
            "communication_type": "portal_message",
            "sla_hours": 24,
            "started_at": NOW - timedelta(hours=2),
            "breach_status": "within_sla",
            "assigned_to": PHILIPPE_ID,
        },
        # Approaching breach
        {
            "id": SL[2],
            "entity_type": "deliverable",
            "entity_id": str(DL[1]),
            "communication_type": "partner_submission",
            "sla_hours": 48,
            "started_at": NOW - timedelta(hours=40),
            "breach_status": "approaching_breach",
            "assigned_to": ELENA_ID,
        },
        # Breached
        {
            "id": SL[3],
            "entity_type": "communication",
            "entity_id": str(CM[6]),
            "communication_type": "client_inquiry",
            "sla_hours": 12,
            "started_at": NOW - timedelta(hours=18),
            "breach_status": "breached",
            "assigned_to": ALEXANDER_ID,
        },
        # Within SLA - responded
        {
            "id": SL[4],
            "entity_type": "communication",
            "entity_id": str(CM[2]),
            "communication_type": "portal_message",
            "sla_hours": 24,
            "started_at": NOW - timedelta(hours=8),
            "responded_at": NOW - timedelta(hours=5),
            "breach_status": "within_sla",
            "assigned_to": SARAH_ID,
        },
    ]
    for s in slas:
        sid = s.pop("id")
        await get_or_create(
            db,
            SLATracker,
            defaults={"id": sid, **s},
            id=sid,
        )


async def seed_decision_requests(db: AsyncSession) -> None:
    """Seed 3 decision requests."""
    logger.info("Seeding decision requests...")
    decisions = [
        # Pending - choice type
        {
            "id": DR[1],
            "client_id": PROFILE_BEAUMONT_ID,
            "program_id": PROG_ESTATE_ID,
            "title": "Trust Structure Selection",
            "prompt": (
                "Please select your preferred trust"
                " structure for the Beaumont estate."
                " Each option has different tax"
                " implications and governance"
                " requirements."
            ),
            "response_type": "choice",
            "options": [
                {
                    "id": "opt1",
                    "label": "Discretionary Trust",
                    "description": (
                        "Maximum flexibility for trustees"
                    ),
                },
                {
                    "id": "opt2",
                    "label": "Fixed Trust",
                    "description": (
                        "Pre-determined beneficiary shares"
                    ),
                },
                {
                    "id": "opt3",
                    "label": "Hybrid Structure",
                    "description": (
                        "Combination approach"
                        " with reserved powers"
                    ),
                },
            ],
            "deadline_date": date(2026, 3, 25),
            "consequence_text": (
                "Without selection, we will proceed"
                " with the hybrid structure as"
                " recommended."
            ),
            "status": "pending",
            "created_by": SARAH_ID,
        },
        # Responded - yes_no type
        {
            "id": DR[2],
            "client_id": PROFILE_TANAKA_ID,
            "program_id": PROG_PORTFOLIO_ID,
            "title": "Approve Rebalancing Strategy",
            "prompt": (
                "Do you approve the proposed portfolio"
                " rebalancing strategy as presented"
                " in the December review?"
            ),
            "response_type": "yes_no",
            "deadline_date": date(2025, 12, 31),
            "status": "responded",
            "response": {
                "answer": "yes",
                "comment": "Approved as presented.",
            },
            "responded_at": NOW - timedelta(days=80),
            "responded_by": ROBERT_ID,
            "created_by": JAMES_ID,
        },
        # Expired
        {
            "id": DR[3],
            "client_id": PROFILE_NORTHCOTT_ID,
            "program_id": PROG_RELOCATION_ID,
            "title": "Preferred Relocation Timeline",
            "prompt": (
                "Please confirm your preferred"
                " relocation timeline for the"
                " Singapore move."
            ),
            "response_type": "choice",
            "options": [
                {
                    "id": "opt1",
                    "label": "Q2 2026",
                    "description": "April-June 2026",
                },
                {
                    "id": "opt2",
                    "label": "Q3 2026",
                    "description": "July-September 2026",
                },
            ],
            "deadline_date": date(2026, 3, 10),
            "consequence_text": (
                "We will plan for Q3 2026 if no"
                " preference is indicated."
            ),
            "status": "expired",
            "created_by": SARAH_ID,
        },
    ]
    for d in decisions:
        did = d.pop("id")
        await get_or_create(
            db,
            DecisionRequest,
            defaults={"id": did, **d},
            id=did,
        )


async def seed_program_closure(db: AsyncSession) -> None:
    """Seed 1 program closure for the completed program."""
    logger.info("Seeding program closure...")
    checklist = [
        {
            "key": "deliverables_approved",
            "label": "All deliverables approved",
            "completed": True,
        },
        {
            "key": "partner_ratings_submitted",
            "label": "Partner ratings submitted",
            "completed": True,
        },
        {
            "key": "final_report_generated",
            "label": "Final report generated",
            "completed": True,
        },
        {
            "key": "client_signoff",
            "label": "Client sign-off received",
            "completed": True,
        },
        {
            "key": "financials_reconciled",
            "label": "Financials reconciled",
            "completed": True,
        },
    ]
    await get_or_create(
        db,
        ProgramClosure,
        defaults={
            "id": CLOSURE_ID,
            "status": "completed",
            "checklist": checklist,
            "notes": (
                "All deliverables approved and"
                " client sign-off received."
            ),
            "debrief_notes": (
                "Excellent program execution. Client very"
                " satisfied with portfolio performance."
                " Recommend similar annual review cadence."
            ),
            "debrief_notes_at": NOW - timedelta(days=15),
            "debrief_notes_by": JAMES_ID,
            "debrief_notes_by_name": "James Chen",
            "initiated_by": JAMES_ID,
            "completed_at": NOW - timedelta(days=14),
        },
        program_id=PROG_PORTFOLIO_ID,
    )


async def seed_partner_ratings(db: AsyncSession) -> None:
    """Seed 2 partner ratings for the completed program."""
    logger.info("Seeding partner ratings...")
    ratings = [
        {
            "id": RT[1],
            "program_id": PROG_PORTFOLIO_ID,
            "partner_id": PARTNER_MERIDIAN_ID,
            "rated_by": JAMES_ID,
            "quality_score": 5,
            "timeliness_score": 4,
            "communication_score": 5,
            "overall_score": 5,
            "comments": (
                "Exceptional advisory work."
                " Recommendations well-researched."
            ),
        },
        {
            "id": RT[2],
            "program_id": PROG_PORTFOLIO_ID,
            "partner_id": PARTNER_FORTRESS_ID,
            "rated_by": JAMES_ID,
            "quality_score": 4,
            "timeliness_score": 4,
            "communication_score": 4,
            "overall_score": 4,
            "comments": (
                "Solid compliance review."
                " Thorough and well-documented."
            ),
        },
    ]
    for r in ratings:
        rid = r.pop("id")
        prog = r["program_id"]
        partner = r["partner_id"]
        await get_or_create(
            db,
            PartnerRating,
            defaults={"id": rid, **r},
            program_id=prog,
            partner_id=partner,
        )


async def seed_report_schedules(db: AsyncSession) -> None:
    """Seed 2 report schedules."""
    logger.info("Seeding report schedules...")
    schedules = [
        {
            "id": RS[1],
            "report_type": "portfolio",
            "frequency": "weekly",
            "next_run": NOW + timedelta(days=3),
            "recipients": [
                "sarah.blackwood@amg.com",
                "marcus.wellington@amg.com",
            ],
            "format": "pdf",
            "is_active": True,
            "created_by": SARAH_ID,
        },
        {
            "id": RS[2],
            "report_type": "program_status",
            "frequency": "monthly",
            "next_run": datetime(
                2026, 4, 1, 9, 0, 0, tzinfo=UTC,
            ),
            "recipients": [
                "marcus.wellington@amg.com",
            ],
            "format": "pdf",
            "is_active": True,
            "created_by": MARCUS_ID,
        },
    ]
    for s in schedules:
        sid = s.pop("id")
        await get_or_create(
            db,
            ReportSchedule,
            defaults={"id": sid, **s},
            id=sid,
        )


async def seed_nps(db: AsyncSession) -> None:
    """Seed 1 NPS survey, 3 responses, 1 follow-up."""
    logger.info("Seeding NPS survey...")
    await get_or_create(
        db,
        NPSSurvey,
        defaults={
            "id": NPS_SURVEY_ID,
            "description": (
                "Quarterly client satisfaction"
                " survey for Q1 2026"
            ),
            "quarter": 1,
            "year": 2026,
            "status": "active",
            "questions": {
                "nps_question": (
                    "How likely are you to recommend"
                    " AMG to a colleague or peer?"
                ),
                "custom_questions": [
                    {
                        "id": "q1",
                        "text": (
                            "How would you rate your"
                            " RM's responsiveness?"
                        ),
                        "type": "rating",
                    },
                    {
                        "id": "q2",
                        "text": "What could we improve?",
                        "type": "text",
                    },
                ],
            },
            "distribution_method": "portal",
            "reminder_enabled": True,
            "reminder_days": 7,
            "sent_at": NOW - timedelta(days=14),
            "closes_at": NOW + timedelta(days=16),
            "target_client_types": [
                "family_office",
                "global_executive",
                "uhnw_individual",
            ],
            "created_by": MARCUS_ID,
        },
        name="Q1 2026 Client Satisfaction Survey",
    )

    logger.info("Seeding NPS responses...")
    responses = [
        # Promoter - Beaumont
        {
            "id": NR[1],
            "survey_id": NPS_SURVEY_ID,
            "client_profile_id": PROFILE_BEAUMONT_ID,
            "score": 9,
            "score_category": "promoter",
            "comment": (
                "Excellent service. Sarah and the"
                " team have been outstanding."
            ),
            "custom_responses": {
                "q1": 5,
                "q2": "More frequent portfolio updates.",
            },
            "responded_at": NOW - timedelta(days=7),
            "response_channel": "portal",
            "follow_up_required": False,
        },
        # Passive - Northcott
        {
            "id": NR[2],
            "survey_id": NPS_SURVEY_ID,
            "client_profile_id": PROFILE_NORTHCOTT_ID,
            "score": 7,
            "score_category": "passive",
            "comment": (
                "Good service overall, but onboarding"
                " could be smoother."
            ),
            "custom_responses": {
                "q1": 4,
                "q2": "Faster onboarding, clearer timelines.",
            },
            "responded_at": NOW - timedelta(days=5),
            "response_channel": "portal",
            "follow_up_required": False,
        },
        # Detractor - Tanaka
        {
            "id": NR[3],
            "survey_id": NPS_SURVEY_ID,
            "client_profile_id": PROFILE_TANAKA_ID,
            "score": 4,
            "score_category": "detractor",
            "comment": (
                "Communication delays during portfolio"
                " review were frustrating."
            ),
            "custom_responses": {
                "q1": 2,
                "q2": "Improve response times.",
            },
            "responded_at": NOW - timedelta(days=3),
            "response_channel": "portal",
            "follow_up_required": True,
        },
    ]
    for r in responses:
        rid = r.pop("id")
        await get_or_create(
            db,
            NPSResponse,
            defaults={"id": rid, **r},
            id=rid,
        )

    logger.info("Seeding NPS follow-up...")
    await get_or_create(
        db,
        NPSFollowUp,
        defaults={
            "id": NPS_FOLLOWUP_ID,
            "survey_id": NPS_SURVEY_ID,
            "response_id": NR[3],
            "client_profile_id": PROFILE_TANAKA_ID,
            "assigned_to": JAMES_ID,
            "priority": "high",
            "status": "pending",
            "action_type": "personal_reach_out",
            "notes": (
                "Detractor response from Tanaka Holdings."
                " Score: 4/10. Key concern:"
                " communication delays."
            ),
            "due_at": NOW + timedelta(days=3),
        },
        id=NPS_FOLLOWUP_ID,
    )


async def seed_budget_approval(db: AsyncSession) -> None:
    """Seed approval chain, steps, threshold, requests."""
    logger.info("Seeding budget approval chain...")
    await get_or_create(
        db,
        ApprovalChain,
        defaults={
            "id": CHAIN_ID,
            "description": (
                "Standard two-step budget approval:"
                " Finance then MD"
            ),
            "is_active": True,
            "created_by": MARCUS_ID,
        },
        name="Standard Budget Approval",
    )

    logger.info("Seeding approval chain steps...")
    steps = [
        {
            "id": CS[1],
            "approval_chain_id": CHAIN_ID,
            "step_number": 1,
            "required_role": "finance_compliance",
            "timeout_hours": 48,
            "auto_approve_on_timeout": False,
        },
        {
            "id": CS[2],
            "approval_chain_id": CHAIN_ID,
            "step_number": 2,
            "required_role": "managing_director",
            "specific_user_id": MARCUS_ID,
            "timeout_hours": 72,
            "auto_approve_on_timeout": False,
        },
    ]
    for s in steps:
        sid = s.pop("id")
        chain = s["approval_chain_id"]
        step_num = s["step_number"]
        await get_or_create(
            db,
            ApprovalChainStep,
            defaults={"id": sid, **s},
            approval_chain_id=chain,
            step_number=step_num,
        )

    logger.info("Seeding approval threshold...")
    await get_or_create(
        db,
        ApprovalThreshold,
        defaults={
            "id": THRESHOLD_ID,
            "description": (
                "Requests above 50k require"
                " standard approval chain"
            ),
            "min_amount": Decimal("50000.00"),
            "max_amount": Decimal("5000000.00"),
            "approval_chain_id": CHAIN_ID,
            "is_active": True,
            "priority": 0,
        },
        name="Standard Threshold (50K-5M)",
    )

    logger.info("Seeding budget approval requests...")
    # Request 1 - Pending
    await get_or_create(
        db,
        BudgetApprovalRequest,
        defaults={
            "id": BR[1],
            "program_id": PROG_ESTATE_ID,
            "request_type": "budget_increase",
            "description": (
                "Additional budget required for extended"
                " jurisdictional analysis covering two"
                " newly identified holding structures."
            ),
            "requested_amount": Decimal("150000.00"),
            "budget_impact": Decimal("150000.00"),
            "current_budget": Decimal("2500000.00"),
            "projected_budget": Decimal("2650000.00"),
            "threshold_id": THRESHOLD_ID,
            "approval_chain_id": CHAIN_ID,
            "current_step": 1,
            "status": "pending",
            "requested_by": SARAH_ID,
        },
        title="Estate Plan Budget Increase",
    )

    # Request 2 - Approved
    await get_or_create(
        db,
        BudgetApprovalRequest,
        defaults={
            "id": BR[2],
            "program_id": PROG_PORTFOLIO_ID,
            "request_type": "new_expense",
            "description": (
                "Engagement of external risk analytics"
                " vendor for portfolio stress testing."
            ),
            "requested_amount": Decimal("75000.00"),
            "budget_impact": Decimal("75000.00"),
            "current_budget": Decimal("500000.00"),
            "projected_budget": Decimal("575000.00"),
            "threshold_id": THRESHOLD_ID,
            "approval_chain_id": CHAIN_ID,
            "current_step": 2,
            "status": "approved",
            "requested_by": JAMES_ID,
            "approved_by": MARCUS_ID,
            "final_decision_at": NOW - timedelta(days=60),
            "final_comments": (
                "Approved. Cost justified by"
                " portfolio complexity."
            ),
        },
        title="Risk Analytics Vendor Engagement",
    )

    logger.info("Seeding budget approval steps...")
    # Step for request 1 (pending)
    await get_or_create(
        db,
        BudgetApprovalStep,
        defaults={
            "id": BS[1],
            "request_id": BR[1],
            "chain_step_id": CS[1],
            "step_number": 1,
            "assigned_user_id": OLIVIA_ID,
            "assigned_role": "finance_compliance",
            "status": "pending",
        },
        id=BS[1],
    )
    # Step for request 2 (approved)
    await get_or_create(
        db,
        BudgetApprovalStep,
        defaults={
            "id": BS[2],
            "request_id": BR[2],
            "chain_step_id": CS[2],
            "step_number": 2,
            "assigned_user_id": MARCUS_ID,
            "assigned_role": "managing_director",
            "status": "approved",
            "decision": "approved",
            "comments": "Approved. Cost justified.",
            "decided_by": MARCUS_ID,
            "decided_at": NOW - timedelta(days=60),
        },
        id=BS[2],
    )

    logger.info("Seeding budget approval history...")
    # History for request 1
    await get_or_create(
        db,
        BudgetApprovalHistory,
        defaults={
            "id": BH[1],
            "request_id": BR[1],
            "action": "created",
            "step_number": None,
            "from_status": None,
            "to_status": "pending",
            "actor_id": SARAH_ID,
            "actor_name": "Sarah Blackwood",
            "actor_role": "relationship_manager",
            "comments": "Budget increase request submitted.",
        },
        id=BH[1],
    )
    # History for request 2
    await get_or_create(
        db,
        BudgetApprovalHistory,
        defaults={
            "id": BH[2],
            "request_id": BR[2],
            "action": "final_approved",
            "step_number": 2,
            "from_status": "pending",
            "to_status": "approved",
            "actor_id": MARCUS_ID,
            "actor_name": "Marcus Wellington",
            "actor_role": "managing_director",
            "comments": "Final approval granted.",
        },
        id=BH[2],
    )


async def seed_certificates(db: AsyncSession) -> None:
    """Seed 1 certificate template and 2 certificates."""
    logger.info("Seeding certificate template...")
    tpl_content = (
        "<h1>Clearance Certificate</h1>\n"
        "<p>This certifies that the program"
        " <strong>{{ program_title }}</strong>"
        " for client"
        " <strong>{{ client_name }}</strong>"
        " has been completed in accordance with"
        " all applicable compliance"
        " requirements.</p>\n"
        "<p>Certificate Number:"
        " {{ certificate_number }}</p>\n"
        "<p>Issue Date: {{ issue_date }}</p>"
    )
    await get_or_create(
        db,
        CertificateTemplate,
        defaults={
            "id": CERT_TEMPLATE_ID,
            "description": (
                "Standard program completion"
                " clearance certificate"
            ),
            "template_type": "program",
            "content": tpl_content,
            "placeholders": {
                "program_title": {
                    "type": "string", "required": True,
                },
                "client_name": {
                    "type": "string", "required": True,
                },
                "certificate_number": {
                    "type": "string", "required": True,
                },
                "issue_date": {
                    "type": "string", "required": True,
                },
            },
            "is_active": True,
            "created_by": OLIVIA_ID,
        },
        name="Program Completion Certificate",
    )

    logger.info("Seeding clearance certificates...")
    issued_content = (
        "<h1>Clearance Certificate</h1>\n"
        "<p>This certifies that the program"
        " <strong>Tanaka Investment Portfolio"
        " Review</strong> for client"
        " <strong>Tanaka Holdings</strong>"
        " has been completed in accordance with"
        " all applicable compliance"
        " requirements.</p>\n"
        "<p>Certificate Number:"
        " AMG-CERT-2026-0001</p>\n"
        "<p>Issue Date: 2026-03-01</p>"
    )
    # Certificate 1 - Issued
    await get_or_create(
        db,
        ClearanceCertificate,
        defaults={
            "id": CT[1],
            "template_id": CERT_TEMPLATE_ID,
            "program_id": PROG_PORTFOLIO_ID,
            "client_id": CLIENT_TANAKA_ID,
            "title": (
                "Tanaka Portfolio Review"
                " — Clearance Certificate"
            ),
            "content": issued_content,
            "populated_data": {
                "program_title": (
                    "Tanaka Investment Portfolio Review"
                ),
                "client_name": "Tanaka Holdings",
                "certificate_number": "AMG-CERT-2026-0001",
                "issue_date": "2026-03-01",
            },
            "certificate_type": "program",
            "status": "issued",
            "issue_date": date(2026, 3, 1),
            "expiry_date": date(2027, 3, 1),
            "reviewed_by": OLIVIA_ID,
            "reviewed_at": NOW - timedelta(days=16),
            "created_by": OLIVIA_ID,
        },
        certificate_number="AMG-CERT-2026-0001",
    )

    draft_content = (
        "<h1>Clearance Certificate</h1>\n"
        "<p>This certifies that the program"
        " <strong>Beaumont Global Estate Plan"
        "</strong> for client"
        " <strong>Beaumont Family Office"
        "</strong> ...</p>\n"
        "<p>Certificate Number:"
        " AMG-CERT-2026-0002</p>"
    )
    # Certificate 2 - Draft
    await get_or_create(
        db,
        ClearanceCertificate,
        defaults={
            "id": CT[2],
            "template_id": CERT_TEMPLATE_ID,
            "program_id": PROG_ESTATE_ID,
            "client_id": CLIENT_BEAUMONT_ID,
            "title": (
                "Beaumont Estate Plan"
                " — Draft Clearance Certificate"
            ),
            "content": draft_content,
            "certificate_type": "program",
            "status": "draft",
            "created_by": OLIVIA_ID,
        },
        certificate_number="AMG-CERT-2026-0002",
    )

    logger.info("Seeding certificate history...")
    await get_or_create(
        db,
        ClearanceCertificateHistory,
        defaults={
            "id": CH[1],
            "certificate_id": CT[1],
            "action": "issued",
            "from_status": "draft",
            "to_status": "issued",
            "actor_id": OLIVIA_ID,
            "actor_name": "Olivia Grant",
            "notes": (
                "Certificate issued after"
                " compliance review."
            ),
        },
        id=CH[1],
    )
    await get_or_create(
        db,
        ClearanceCertificateHistory,
        defaults={
            "id": CH[2],
            "certificate_id": CT[2],
            "action": "created",
            "from_status": None,
            "to_status": "draft",
            "actor_id": OLIVIA_ID,
            "actor_name": "Olivia Grant",
            "notes": (
                "Draft certificate created"
                " for ongoing program."
            ),
        },
        id=CH[2],
    )


async def seed_access_audit(db: AsyncSession) -> None:
    """Seed 1 completed Q4 2025 access audit + 2 findings."""
    logger.info("Seeding access audit...")
    await get_or_create(
        db,
        AccessAudit,
        defaults={
            "id": AUDIT_ID,
            "audit_period": "Q4 2025",
            "status": "completed",
            "auditor_id": OLIVIA_ID,
            "started_at": datetime(
                2025, 12, 15, 9, 0, 0, tzinfo=UTC,
            ),
            "completed_at": datetime(
                2025, 12, 28, 17, 0, 0, tzinfo=UTC,
            ),
            "users_reviewed": 10,
            "permissions_verified": 45,
            "anomalies_found": 2,
            "summary": (
                "Quarterly access audit completed."
                " 10 users reviewed, 45 permissions"
                " verified. 2 anomalies identified."
            ),
            "recommendations": (
                "1. Review coordinator access to"
                " financial reports."
                " 2. Disable dormant partner account."
            ),
        },
        quarter=4,
        year=2025,
    )

    logger.info("Seeding audit findings...")
    # Finding 1 - Open
    await get_or_create(
        db,
        AccessAuditFinding,
        defaults={
            "id": FN[1],
            "audit_id": AUDIT_ID,
            "user_id": DAVID_ID,
            "finding_type": "excessive_access",
            "severity": "medium",
            "description": (
                "Coordinator David Park has access to"
                " financial reconciliation reports which"
                " exceeds role requirements."
            ),
            "recommendation": (
                "Remove access to financial"
                " reconciliation module."
            ),
            "status": "open",
        },
        id=FN[1],
    )
    # Finding 2 - Remediated
    await get_or_create(
        db,
        AccessAuditFinding,
        defaults={
            "id": FN[2],
            "audit_id": AUDIT_ID,
            "user_id": STEFAN_ID,
            "finding_type": "inactive_user",
            "severity": "low",
            "description": (
                "Partner Stefan Brandt had not logged"
                " in for 45 days at time of audit."
            ),
            "recommendation": (
                "Confirm partner engagement status."
                " Consider temporary access suspension."
            ),
            "status": "remediated",
            "remediated_by": ELENA_ID,
            "remediated_at": datetime(
                2026, 1, 10, 14, 0, 0, tzinfo=UTC,
            ),
            "remediation_notes": (
                "Partner confirmed active."
                " Login inactivity due to project gap."
                " Access maintained."
            ),
        },
        id=FN[2],
    )


async def seed_capability_review(db: AsyncSession) -> None:
    """Seed 1 completed 2026 capability review."""
    logger.info("Seeding capability review...")
    await get_or_create(
        db,
        CapabilityReview,
        defaults={
            "id": CAP_REVIEW_ID,
            "review_year": 2026,
            "status": "completed",
            "reviewer_id": ELENA_ID,
            "scheduled_date": date(2026, 1, 15),
            "completed_date": date(2026, 2, 1),
            "capabilities_reviewed": [
                "investment_advisory", "tax_planning",
            ],
            "certifications_reviewed": ["CFA", "CPA"],
            "qualifications_reviewed": [
                "20+ years experience",
                "EMEA and APAC coverage",
            ],
            "findings": [
                {
                    "type": "strength",
                    "description": (
                        "Strong investment advisory"
                        " capabilities"
                    ),
                    "severity": "positive",
                    "recommendation": (
                        "Maintain current engagement level"
                    ),
                },
                {
                    "type": "improvement",
                    "description": (
                        "Tax planning certifications"
                        " should be updated for 2026"
                        " regulatory changes"
                    ),
                    "severity": "medium",
                    "recommendation": (
                        "Complete updated tax planning"
                        " certification by Q3 2026"
                    ),
                },
            ],
            "notes": (
                "Annual review completed."
                " Meridian Advisors continues to"
                " demonstrate strong capabilities."
            ),
            "recommendations": (
                "Renew engagement. Request updated"
                " tax planning certification."
            ),
        },
        partner_id=PARTNER_MERIDIAN_ID,
        review_year=2026,
    )


# ---------------------------------------------------------------------------
# Phase 2 — Document Delivery, Scheduling, Evidence Vault
# ---------------------------------------------------------------------------


async def seed_phase2_documents(db: AsyncSession) -> None:
    """Seed Phase 2 documents: reports, briefs, contracts, vault items."""
    logger.info("Seeding Phase 2 documents...")
    base = "/uploads"
    docs = [
        # Client-facing reports & briefs
        {
            "id": P2_DOC[1],
            "file_path": f"{base}/reports/beaumont_q1_2026_portfolio.pdf",
            "file_name": "Q1 2026 Portfolio Report.pdf",
            "file_size": 1_450_000,
            "content_type": "application/pdf",
            "entity_type": "client",
            "entity_id": CLIENT_BEAUMONT_ID,
            "category": "report",
            "description": "Quarterly portfolio performance report for Q1 2026.",
            "uploaded_by": SARAH_ID,
        },
        {
            "id": P2_DOC[2],
            "file_path": f"{base}/programs/estate_plan_brief.pdf",
            "file_name": "Estate Plan Brief.pdf",
            "file_size": 820_000,
            "content_type": "application/pdf",
            "entity_type": "program",
            "entity_id": PROG_ESTATE_ID,
            "category": "general",
            "description": "Executive brief for the Beaumont Global Estate Plan.",
            "uploaded_by": SARAH_ID,
        },
        # Contracts
        {
            "id": P2_DOC[3],
            "file_path": f"{base}/contracts/nda_fortress_legal.pdf",
            "file_name": "NDA — Fortress Legal.pdf",
            "file_size": 340_000,
            "content_type": "application/pdf",
            "entity_type": "partner",
            "entity_id": PARTNER_FORTRESS_ID,
            "category": "contract",
            "description": "Non-disclosure agreement with Fortress Legal.",
            "uploaded_by": ELENA_ID,
        },
        {
            "id": P2_DOC[4],
            "file_path": f"{base}/contracts/engagement_meridian.pdf",
            "file_name": "Engagement Letter — Meridian Advisors.pdf",
            "file_size": 290_000,
            "content_type": "application/pdf",
            "entity_type": "partner",
            "entity_id": PARTNER_MERIDIAN_ID,
            "category": "contract",
            "description": "Engagement letter for tax optimization advisory.",
            "uploaded_by": ELENA_ID,
        },
        # Evidence vault — sealed due diligence
        {
            "id": P2_DOC[5],
            "file_path": f"{base}/vault/beaumont_due_diligence.pdf",
            "file_name": "Due Diligence — Beaumont Family Office.pdf",
            "file_size": 2_100_000,
            "content_type": "application/pdf",
            "entity_type": "client",
            "entity_id": CLIENT_BEAUMONT_ID,
            "category": "compliance",
            "description": "Comprehensive due diligence report — sealed for audit.",
            "uploaded_by": OLIVIA_ID,
            "vault_status": "sealed",
            "sealed_at": NOW - timedelta(days=45),
            "sealed_by": OLIVIA_ID,
            "retention_policy": "7_years",
            "chain_of_custody": [
                {
                    "action": "created",
                    "actor": "Olivia Grant",
                    "at": (NOW - timedelta(days=50)).isoformat(),
                },
                {
                    "action": "sealed",
                    "actor": "Olivia Grant",
                    "at": (NOW - timedelta(days=45)).isoformat(),
                },
            ],
        },
        # Evidence vault — security assessment
        {
            "id": P2_DOC[6],
            "file_path": f"{base}/vault/beaumont_security_assessment.pdf",
            "file_name": "Security Assessment — Beaumont.pdf",
            "file_size": 1_850_000,
            "content_type": "application/pdf",
            "entity_type": "client",
            "entity_id": CLIENT_BEAUMONT_ID,
            "category": "compliance",
            "description": "Physical and digital security posture assessment.",
            "uploaded_by": OLIVIA_ID,
            "vault_status": "sealed",
            "sealed_at": NOW - timedelta(days=30),
            "sealed_by": MARCUS_ID,
            "retention_policy": "5_years",
            "chain_of_custody": [
                {
                    "action": "created",
                    "actor": "Olivia Grant",
                    "at": (NOW - timedelta(days=35)).isoformat(),
                },
                {
                    "action": "reviewed",
                    "actor": "Marcus Wellington",
                    "at": (NOW - timedelta(days=31)).isoformat(),
                },
                {
                    "action": "sealed",
                    "actor": "Marcus Wellington",
                    "at": (NOW - timedelta(days=30)).isoformat(),
                },
            ],
        },
        # Financial document for client portal
        {
            "id": P2_DOC[7],
            "file_path": f"{base}/reports/beaumont_fee_schedule.pdf",
            "file_name": "2026 Fee Schedule.pdf",
            "file_size": 185_000,
            "content_type": "application/pdf",
            "entity_type": "client",
            "entity_id": CLIENT_BEAUMONT_ID,
            "category": "financial",
            "description": "Annual fee schedule and billing summary for 2026.",
            "uploaded_by": SARAH_ID,
        },
    ]
    for d in docs:
        did = d.pop("id")
        await get_or_create(db, Document, defaults={"id": did, **d}, id=did)


async def seed_phase2_document_deliveries(db: AsyncSession) -> None:
    """Seed document deliveries so the client portal shows delivered docs."""
    logger.info("Seeding Phase 2 document deliveries...")
    deliveries = [
        {
            "id": P2_DELIVERY[1],
            "document_id": P2_DOC[1],
            "recipient_id": PHILIPPE_ID,
            "delivery_method": "portal",
            "delivered_at": NOW - timedelta(days=5),
            "viewed_at": NOW - timedelta(days=4),
            "notes": "Q1 2026 portfolio report delivered via portal.",
        },
        {
            "id": P2_DELIVERY[2],
            "document_id": P2_DOC[2],
            "recipient_id": PHILIPPE_ID,
            "delivery_method": "portal",
            "delivered_at": NOW - timedelta(days=20),
            "viewed_at": NOW - timedelta(days=18),
            "acknowledged_at": NOW - timedelta(days=18),
            "notes": "Estate plan brief acknowledged by client.",
        },
        {
            "id": P2_DELIVERY[3],
            "document_id": P2_DOC[7],
            "recipient_id": PHILIPPE_ID,
            "delivery_method": "portal",
            "delivered_at": NOW - timedelta(days=10),
            "notes": "Fee schedule delivered — awaiting review.",
        },
        {
            "id": P2_DELIVERY[4],
            "document_id": P2_DOC[1],
            "recipient_id": MARCUS_ID,
            "delivery_method": "email",
            "delivered_at": NOW - timedelta(days=5),
            "viewed_at": NOW - timedelta(days=5),
            "notes": "CC to Managing Director.",
        },
    ]
    for d in deliveries:
        did = d.pop("id")
        await get_or_create(db, DocumentDelivery, defaults={"id": did, **d}, id=did)


async def seed_phase2_document_requests(db: AsyncSession) -> None:
    """Seed document requests for the client portal."""
    logger.info("Seeding Phase 2 document requests...")
    requests = [
        {
            "id": P2_DOCREQ[1],
            "client_id": PROFILE_BEAUMONT_ID,
            "requested_by": SARAH_ID,
            "document_type": "bank_statement",
            "title": "Q4 2025 Bank Statements",
            "description": "Please provide bank statements for all accounts for Oct-Dec 2025.",
            "message": "Hi Philippe, we need these for the tax optimization review.",
            "status": "pending",
            "deadline": NOW + timedelta(days=7),
        },
        {
            "id": P2_DOCREQ[2],
            "client_id": PROFILE_BEAUMONT_ID,
            "requested_by": SARAH_ID,
            "document_type": "tax_return",
            "title": "2025 Swiss Tax Filing",
            "description": "Copy of the 2025 Swiss cantonal tax return.",
            "status": "in_progress",
            "deadline": NOW + timedelta(days=14),
            "in_progress_at": NOW - timedelta(days=2),
            "rm_notes": "Philippe confirmed he will upload by end of week.",
        },
        {
            "id": P2_DOCREQ[3],
            "client_id": PROFILE_BEAUMONT_ID,
            "requested_by": OLIVIA_ID,
            "document_type": "source_of_wealth",
            "title": "Source of Wealth Declaration",
            "description": "Compliance requires an updated source of wealth declaration.",
            "status": "complete",
            "deadline": NOW - timedelta(days=10),
            "completed_at": NOW - timedelta(days=12),
            "rm_notes": "Received and verified.",
        },
    ]
    for r in requests:
        rid = r.pop("id")
        await get_or_create(db, DocumentRequest, defaults={"id": rid, **r}, id=rid)


async def seed_phase2_meeting_types(db: AsyncSession) -> None:
    """Seed meeting types for scheduling."""
    logger.info("Seeding Phase 2 meeting types...")
    types = [
        {
            "id": P2_MTGTYPE[1],
            "slug": "quick_checkin",
            "label": "Quick Check-in",
            "duration_minutes": 15,
            "description": "Brief status update or question.",
            "display_order": 0,
        },
        {
            "id": P2_MTGTYPE[2],
            "slug": "standard",
            "label": "Standard Meeting",
            "duration_minutes": 30,
            "description": "Regular program review or planning session.",
            "display_order": 1,
        },
        {
            "id": P2_MTGTYPE[3],
            "slug": "extended",
            "label": "Extended Session",
            "duration_minutes": 60,
            "description": "In-depth strategy or complex topic discussion.",
            "display_order": 2,
        },
    ]
    for t in types:
        tid = t.pop("id")
        slug = t["slug"]
        await get_or_create(db, MeetingType, defaults={"id": tid, **t}, slug=slug)


async def seed_phase2_rm_availability(db: AsyncSession) -> None:
    """Seed RM availability windows for Sarah Blackwood."""
    logger.info("Seeding Phase 2 RM availability...")
    from datetime import time as dt_time

    # Mon-Fri 9am-12pm and 2pm-5pm for Sarah
    slots = [
        (1, 0, dt_time(9, 0), dt_time(12, 0)),   # Mon AM
        (2, 0, dt_time(14, 0), dt_time(17, 0)),   # Mon PM
        (3, 2, dt_time(9, 0), dt_time(12, 0)),    # Wed AM
        (4, 2, dt_time(14, 0), dt_time(17, 0)),   # Wed PM
        (5, 4, dt_time(9, 0), dt_time(12, 0)),    # Fri AM
    ]
    for idx, dow, start, end in slots:
        await get_or_create(
            db,
            RMAvailability,
            defaults={
                "id": P2_AVAIL[idx],
                "rm_id": SARAH_ID,
                "day_of_week": dow,
                "start_time": start,
                "end_time": end,
                "buffer_minutes": 15,
                "is_active": True,
            },
            id=P2_AVAIL[idx],
        )


async def seed_phase2_meetings(db: AsyncSession) -> None:
    """Seed client-RM meetings."""
    logger.info("Seeding Phase 2 meetings...")

    # Look up actual meeting type IDs (may differ from deterministic IDs
    # if meeting types were seeded by another service first).
    from sqlalchemy import select as sa_select
    mt_result = await db.execute(
        sa_select(MeetingType.id, MeetingType.slug)
    )
    mt_map = {row.slug: row.id for row in mt_result.all()}
    checkin_id = mt_map.get("quick_checkin", P2_MTGTYPE[1])
    standard_id = mt_map.get("standard", P2_MTGTYPE[2])
    extended_id = mt_map.get("extended", P2_MTGTYPE[3])

    meetings = [
        # Upcoming - confirmed
        {
            "id": P2_MEETING[1],
            "meeting_type_id": standard_id,
            "rm_id": SARAH_ID,
            "client_id": CLIENT_BEAUMONT_ID,
            "booked_by_user_id": PHILIPPE_ID,
            "start_time": NOW + timedelta(days=3, hours=2),
            "end_time": NOW + timedelta(days=3, hours=2, minutes=30),
            "timezone": "Europe/Zurich",
            "status": "confirmed",
            "agenda": "Review trust structure options and tax optimization progress.",
            "virtual_link": "https://meet.amg-portal.com/beaumont-estate-review",
        },
        # Upcoming - pending
        {
            "id": P2_MEETING[2],
            "meeting_type_id": extended_id,
            "rm_id": SARAH_ID,
            "client_id": CLIENT_BEAUMONT_ID,
            "booked_by_user_id": PHILIPPE_ID,
            "start_time": NOW + timedelta(days=10, hours=5),
            "end_time": NOW + timedelta(days=10, hours=6),
            "timezone": "Europe/Zurich",
            "status": "pending",
            "agenda": "Deep-dive into succession planning framework.",
        },
        # Past - completed
        {
            "id": P2_MEETING[3],
            "meeting_type_id": checkin_id,
            "rm_id": SARAH_ID,
            "client_id": CLIENT_BEAUMONT_ID,
            "booked_by_user_id": PHILIPPE_ID,
            "start_time": NOW - timedelta(days=7, hours=-3),
            "end_time": NOW - timedelta(days=7, hours=-3, minutes=-15),
            "timezone": "Europe/Zurich",
            "status": "completed",
            "agenda": "Quick check on jurisdictional analysis delivery.",
            "notes": "Confirmed all deliverables on track. Client satisfied.",
        },
    ]
    for m in meetings:
        mid = m.pop("id")
        await get_or_create(db, Meeting, defaults={"id": mid, **m}, id=mid)


async def seed_phase2_scheduled_events(db: AsyncSession) -> None:
    """Seed scheduled events for calendar / scheduling pages."""
    logger.info("Seeding Phase 2 scheduled events...")
    events = [
        # Internal coordination meeting
        {
            "id": P2_EVENT[1],
            "title": "Estate Plan — Weekly Sync",
            "description": "Weekly coordination meeting for the Beaumont estate plan team.",
            "event_type": "meeting",
            "start_time": NOW + timedelta(days=2, hours=0),
            "end_time": NOW + timedelta(days=2, hours=1),
            "timezone": "UTC",
            "location": "AMG Conference Room A",
            "organizer_id": SARAH_ID,
            "program_id": PROG_ESTATE_ID,
            "client_id": CLIENT_BEAUMONT_ID,
            "attendee_ids": [SARAH_ID, ELENA_ID, DAVID_ID],
            "status": "confirmed",
            "reminder_minutes": 30,
        },
        # Client review call
        {
            "id": P2_EVENT[2],
            "title": "Beaumont Quarterly Review",
            "description": "Quarterly program and portfolio review with Philippe Beaumont.",
            "event_type": "call",
            "start_time": NOW + timedelta(days=5, hours=3),
            "end_time": NOW + timedelta(days=5, hours=4),
            "timezone": "Europe/Zurich",
            "virtual_link": "https://meet.amg-portal.com/beaumont-quarterly",
            "organizer_id": SARAH_ID,
            "program_id": PROG_ESTATE_ID,
            "client_id": CLIENT_BEAUMONT_ID,
            "attendee_ids": [SARAH_ID, PHILIPPE_ID],
            "status": "scheduled",
            "reminder_minutes": 60,
        },
        # Deadline event
        {
            "id": P2_EVENT[3],
            "title": "Tax Optimization Memo — Deadline",
            "description": "Deadline for cross-border tax memo from Meridian Advisors.",
            "event_type": "deadline",
            "start_time": datetime(2026, 4, 1, 17, 0, 0, tzinfo=UTC),
            "end_time": datetime(2026, 4, 1, 17, 0, 0, tzinfo=UTC),
            "timezone": "UTC",
            "organizer_id": ELENA_ID,
            "program_id": PROG_ESTATE_ID,
            "attendee_ids": [ELENA_ID, SARAH_ID],
            "status": "scheduled",
            "reminder_minutes": 1440,
        },
        # Site visit
        {
            "id": P2_EVENT[4],
            "title": "Art Storage Facility Visit",
            "description": "Visit potential secure storage facility for Beaumont art collection.",
            "event_type": "site_visit",
            "start_time": NOW + timedelta(days=14, hours=2),
            "end_time": NOW + timedelta(days=14, hours=4),
            "timezone": "Europe/Zurich",
            "location": "Geneva Freeport, Route de Meyrin 59",
            "organizer_id": ELENA_ID,
            "program_id": PROG_ART_ID,
            "client_id": CLIENT_BEAUMONT_ID,
            "attendee_ids": [ELENA_ID, STEFAN_ID],
            "status": "scheduled",
            "reminder_minutes": 120,
        },
    ]
    for e in events:
        eid = e.pop("id")
        await get_or_create(db, ScheduledEvent, defaults={"id": eid, **e}, id=eid)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def seed() -> None:  # noqa: PLR0915
    """Run all seeders in FK dependency order."""
    pw_hash = hash_password("Demo2026!")

    async with AsyncSessionLocal() as db:
        # 1. Communication templates
        logger.info("=== Seeding communication templates ===")
        await seed_default_templates(db)

        # 2. Users
        logger.info("=== Seeding users ===")
        await seed_users(db, pw_hash)
        await db.flush()

        # 3. Clients
        logger.info("=== Seeding clients ===")
        await seed_clients(db)
        await db.flush()

        # 4. Client profiles
        logger.info("=== Seeding client profiles ===")
        await seed_client_profiles(db)
        await db.flush()

        # 5. Partners
        logger.info("=== Seeding partners ===")
        await seed_partners(db)
        await db.flush()

        # 6. Programs
        logger.info("=== Seeding programs ===")
        await seed_programs(db)
        await db.flush()

        # 7. Milestones
        logger.info("=== Seeding milestones ===")
        await seed_milestones(db)
        await db.flush()

        # 8. Tasks
        logger.info("=== Seeding tasks ===")
        await seed_tasks(db)
        await db.flush()

        # 9. Partner assignments
        logger.info("=== Seeding assignments ===")
        await seed_assignments(db)
        await db.flush()

        # 10. Deliverables
        logger.info("=== Seeding deliverables ===")
        await seed_deliverables(db)
        await db.flush()

        # 11. Conversations
        logger.info("=== Seeding conversations ===")
        await seed_conversations(db)
        await db.flush()

        # 12. Communications
        logger.info("=== Seeding communications ===")
        await seed_communications(db)
        await db.flush()

        # 13. Documents
        logger.info("=== Seeding documents ===")
        await seed_documents(db)
        await db.flush()

        # 14. KYC Documents
        logger.info("=== Seeding KYC documents ===")
        await seed_kyc_documents(db)
        await db.flush()

        # 15. Notifications
        logger.info("=== Seeding notifications ===")
        await seed_notifications(db)
        await db.flush()

        # 16. Escalations
        logger.info("=== Seeding escalations ===")
        await seed_escalations(db)
        await db.flush()

        # 17. SLA Trackers
        logger.info("=== Seeding SLA trackers ===")
        await seed_sla_trackers(db)
        await db.flush()

        # 18. Decision Requests
        logger.info("=== Seeding decision requests ===")
        await seed_decision_requests(db)
        await db.flush()

        # 19. Program Closure
        logger.info("=== Seeding program closure ===")
        await seed_program_closure(db)
        await db.flush()

        # 20. Partner Ratings
        logger.info("=== Seeding partner ratings ===")
        await seed_partner_ratings(db)
        await db.flush()

        # 21. Report Schedules
        logger.info("=== Seeding report schedules ===")
        await seed_report_schedules(db)
        await db.flush()

        # 22. NPS Survey + Responses + Follow-up
        logger.info("=== Seeding NPS data ===")
        await seed_nps(db)
        await db.flush()

        # 23. Budget Approval
        logger.info("=== Seeding budget approval data ===")
        await seed_budget_approval(db)
        await db.flush()

        # 24. Certificates
        logger.info("=== Seeding certificates ===")
        await seed_certificates(db)
        await db.flush()

        # 25. Access Audit + Findings
        logger.info("=== Seeding access audit ===")
        await seed_access_audit(db)
        await db.flush()

        # 26. Capability Review
        logger.info("=== Seeding capability review ===")
        await seed_capability_review(db)
        await db.flush()

        # --- Phase 2: Document Delivery, Scheduling, Evidence Vault ---

        # 27. Phase 2 Documents (reports, briefs, contracts, vault)
        logger.info("=== Seeding Phase 2 documents ===")
        await seed_phase2_documents(db)
        await db.flush()

        # 28. Document Deliveries
        logger.info("=== Seeding Phase 2 document deliveries ===")
        await seed_phase2_document_deliveries(db)
        await db.flush()

        # 29. Document Requests
        logger.info("=== Seeding Phase 2 document requests ===")
        await seed_phase2_document_requests(db)
        await db.flush()

        # 30. Meeting Types
        logger.info("=== Seeding Phase 2 meeting types ===")
        await seed_phase2_meeting_types(db)
        await db.flush()

        # 31. RM Availability
        logger.info("=== Seeding Phase 2 RM availability ===")
        await seed_phase2_rm_availability(db)
        await db.flush()

        # 32. Client-RM Meetings
        logger.info("=== Seeding Phase 2 meetings ===")
        await seed_phase2_meetings(db)
        await db.flush()

        # 33. Scheduled Events (calendar)
        logger.info("=== Seeding Phase 2 scheduled events ===")
        await seed_phase2_scheduled_events(db)
        await db.flush()

        await db.commit()
        logger.info("=== Seeding complete! ===")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(seed())
