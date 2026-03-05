from enum import StrEnum


class UserRole(StrEnum):
    # Tier 2 — Internal
    managing_director = "managing_director"
    relationship_manager = "relationship_manager"
    coordinator = "coordinator"
    finance_compliance = "finance_compliance"
    # Tier 1 — Client
    client = "client"
    # Tier 3 — Partner
    partner = "partner"


INTERNAL_ROLES = {
    UserRole.managing_director,
    UserRole.relationship_manager,
    UserRole.coordinator,
    UserRole.finance_compliance,
}

ALL_ROLES = INTERNAL_ROLES | {UserRole.client, UserRole.partner}


class ComplianceStatus(StrEnum):
    pending_review = "pending_review"
    under_review = "under_review"
    cleared = "cleared"
    flagged = "flagged"
    rejected = "rejected"


class ApprovalStatus(StrEnum):
    draft = "draft"
    pending_compliance = "pending_compliance"
    compliance_cleared = "compliance_cleared"
    pending_md_approval = "pending_md_approval"
    approved = "approved"
    rejected = "rejected"


class ProgramStatus(StrEnum):
    intake = "intake"
    design = "design"
    active = "active"
    on_hold = "on_hold"
    completed = "completed"
    closed = "closed"
    archived = "archived"


class MilestoneStatus(StrEnum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class TaskStatus(StrEnum):
    todo = "todo"
    in_progress = "in_progress"
    blocked = "blocked"
    done = "done"
    cancelled = "cancelled"


class TaskPriority(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class ApprovalType(StrEnum):
    standard = "standard"
    elevated = "elevated"
    strategic = "strategic"
    emergency = "emergency"


class ProgramApprovalStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ClientType(StrEnum):
    uhnw_individual = "uhnw_individual"
    family_office = "family_office"
    global_executive = "global_executive"


class PartnerStatus(StrEnum):
    pending = "pending"
    active = "active"
    suspended = "suspended"
    inactive = "inactive"


class PartnerCapability(StrEnum):
    investment_advisory = "investment_advisory"
    tax_planning = "tax_planning"
    estate_planning = "estate_planning"
    real_estate = "real_estate"
    art_advisory = "art_advisory"
    philanthropy = "philanthropy"
    legal = "legal"
    insurance = "insurance"
    concierge = "concierge"
    security = "security"
    other = "other"


class AssignmentStatus(StrEnum):
    draft = "draft"
    dispatched = "dispatched"
    accepted = "accepted"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class DeliverableStatus(StrEnum):
    pending = "pending"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    returned = "returned"
    rejected = "rejected"


class AuditAction(StrEnum):
    create = "create"
    update = "update"
    delete = "delete"


class DeliverableType(StrEnum):
    report = "report"
    document = "document"
    presentation = "presentation"
    spreadsheet = "spreadsheet"
    other = "other"


class DocumentEntityType(StrEnum):
    client = "client"
    program = "program"
    deliverable = "deliverable"
    partner = "partner"


class DocumentCategory(StrEnum):
    general = "general"
    contract = "contract"
    report = "report"
    correspondence = "correspondence"
    compliance = "compliance"
    financial = "financial"
    legal = "legal"
    other = "other"


class KYCDocumentType(StrEnum):
    passport = "passport"
    national_id = "national_id"
    proof_of_address = "proof_of_address"
    tax_id = "tax_id"
    bank_statement = "bank_statement"
    source_of_wealth = "source_of_wealth"
    other = "other"


class KYCDocumentStatus(StrEnum):
    pending = "pending"
    verified = "verified"
    expired = "expired"
    rejected = "rejected"
