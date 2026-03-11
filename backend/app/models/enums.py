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


class EscalationLevel(StrEnum):
    """Severity levels matching the escalation hierarchy"""

    task = "task"
    milestone = "milestone"
    program = "program"
    client_impact = "client_impact"


class EscalationStatus(StrEnum):
    """Status progression for escalations"""

    open = "open"
    acknowledged = "acknowledged"
    investigating = "investigating"
    resolved = "resolved"
    closed = "closed"


class SLABreachStatus(StrEnum):
    """SLA compliance status"""

    within_sla = "within_sla"
    approaching_breach = "approaching_breach"
    breached = "breached"


class CommunicationType(StrEnum):
    """Communication types for SLA tracking"""

    email = "email"
    portal_message = "portal_message"
    phone = "phone"
    partner_submission = "partner_submission"
    client_inquiry = "client_inquiry"


class CommunicationChannel(StrEnum):
    """Channel for sending communications"""

    email = "email"
    in_portal = "in_portal"
    sms = "sms"
    whatsapp = "whatsapp"
    phone = "phone"
    in_person = "in_person"
    other = "other"


class MessageStatus(StrEnum):
    """Status for individual messages/communications"""

    draft = "draft"
    sending = "sending"
    sent = "sent"
    delivered = "delivered"
    failed = "failed"
    read = "read"
    archived = "archived"


class ConversationType(StrEnum):
    """Type of conversation thread"""

    rm_client = "rm_client"
    coordinator_partner = "coordinator_partner"
    internal = "internal"


class TemplateType(StrEnum):
    """Pre-defined communication template types"""

    welcome = "welcome"
    program_kickoff = "program_kickoff"
    weekly_status = "weekly_status"
    decision_request = "decision_request"
    milestone_alert = "milestone_alert"
    completion_note = "completion_note"
    partner_dispatch = "partner_dispatch"
    deliverable_submission = "deliverable_submission"
    custom = "custom"


class NotificationType(StrEnum):
    """Types of in-portal notifications"""

    communication = "communication"
    decision_pending = "decision_pending"
    assignment_update = "assignment_update"
    deliverable_ready = "deliverable_ready"
    milestone_update = "milestone_update"
    approval_required = "approval_required"
    system = "system"


class DigestFrequency(StrEnum):
    """Email digest frequency preferences"""

    immediate = "immediate"
    hourly = "hourly"
    daily = "daily"
    weekly = "weekly"
    never = "never"


class DecisionRequestStatus(StrEnum):
    """Status of client decision requests"""

    pending = "pending"
    responded = "responded"
    declined = "declined"
    expired = "expired"
    cancelled = "cancelled"


class DecisionResponseType(StrEnum):
    """Format of decision response"""

    choice = "choice"
    text = "text"
    yes_no = "yes_no"
    multi_choice = "multi_choice"


class BudgetApprovalStatus(StrEnum):
    """Status of budget approval requests"""

    pending = "pending"
    in_review = "in_review"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"
    expired = "expired"


class BudgetApprovalStepStatus(StrEnum):
    """Status of individual approval steps"""

    pending = "pending"
    in_review = "in_review"
    approved = "approved"
    rejected = "rejected"
    skipped = "skipped"
    timeout = "timeout"


class BudgetRequestType(StrEnum):
    """Types of budget approval requests"""

    budget_increase = "budget_increase"
    new_expense = "new_expense"
    vendor_payment = "vendor_payment"
    partner_payment = "partner_payment"
    contingency = "contingency"
    scope_change = "scope_change"
    emergency = "emergency"


class BudgetApprovalAction(StrEnum):
    """Actions recorded in approval history"""

    created = "created"
    submitted = "submitted"
    step_approved = "step_approved"
    step_rejected = "step_rejected"
    step_delegated = "step_delegated"
    step_timeout = "step_timeout"
    final_approved = "final_approved"
    final_rejected = "final_rejected"
    cancelled = "cancelled"
    escalated = "escalated"
    reopened = "reopened"
