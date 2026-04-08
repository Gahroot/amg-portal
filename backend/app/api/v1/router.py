from fastapi import APIRouter

from app.api.v1.access_audits import router as access_audits_router
from app.api.v1.api_keys import router as api_keys_router
from app.api.v1.approvals import router as approvals_router
from app.api.v1.archival import router as archival_router
from app.api.v1.audit_logs import router as audit_logs_router
from app.api.v1.auth import router as auth_router
from app.api.v1.budget_approvals import router as budget_approvals_router
from app.api.v1.calendar import router as calendar_router
from app.api.v1.calendar_feed import router as calendar_feed_router
from app.api.v1.capability_reviews import router as capability_reviews_router
from app.api.v1.clearance_certificates import router as clearance_certificates_router
from app.api.v1.client_communication_preferences import router as client_comm_prefs_router
from app.api.v1.client_portal import router as client_portal_router
from app.api.v1.client_preferences import router as client_preferences_router
from app.api.v1.clients import router as clients_router
from app.api.v1.communication_audit import router as communication_audit_router
from app.api.v1.communication_logs import router as communication_logs_router
from app.api.v1.communication_templates import router as communication_templates_router
from app.api.v1.communications import router as communications_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.custom_reports import router as custom_reports_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.decision_requests import router as decision_requests_router
from app.api.v1.deletion_requests import router as deletion_requests_router
from app.api.v1.deliverable_templates import router as deliverable_templates_router
from app.api.v1.deliverables import router as deliverables_router
from app.api.v1.document_requests import router as document_requests_router
from app.api.v1.documents import router as documents_router
from app.api.v1.docusign import router as docusign_router
from app.api.v1.escalation_templates import router as escalation_templates_router
from app.api.v1.escalations import router as escalations_router
from app.api.v1.export import router as export_router
from app.api.v1.exports.pdf import router as export_pdf_router
from app.api.v1.family_members import router as family_members_router
from app.api.v1.feedback import router as feedback_router
from app.api.v1.imports import router as imports_router
from app.api.v1.intake import router as intake_router
from app.api.v1.invoices import router as invoices_router
from app.api.v1.kyc_documents import router as kyc_documents_router
from app.api.v1.kyc_verifications import router as kyc_verifications_router
from app.api.v1.meetings import router as meetings_router
from app.api.v1.messaging import router as messaging_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.nps_surveys import router as nps_surveys_router
from app.api.v1.partner_assignments import router as assignments_router
from app.api.v1.partner_availability import router as partner_availability_router
from app.api.v1.partner_capabilities import router as partner_capabilities_router
from app.api.v1.partner_governance import router as partner_governance_router
from app.api.v1.partner_payments import (
    internal_router as partner_payments_internal_router,
)
from app.api.v1.partner_payments import (
    partner_router as partner_payments_router,
)
from app.api.v1.partner_portal import router as partner_portal_router
from app.api.v1.partner_scoring import router as partner_scoring_router
from app.api.v1.partner_tax_documents import router as partner_tax_documents_router
from app.api.v1.partners import router as partners_router
from app.api.v1.performance_notices import router as performance_notices_router
from app.api.v1.portal_updates import router as portal_updates_router
from app.api.v1.predictive import router as predictive_router
from app.api.v1.program_clients import router as program_clients_router
from app.api.v1.program_closure import router as program_closure_router
from app.api.v1.program_templates import router as program_templates_router
from app.api.v1.programs import router as programs_router
from app.api.v1.public import public_router
from app.api.v1.public_reports import router as public_reports_router
from app.api.v1.pulse_surveys import router as pulse_surveys_router
from app.api.v1.push_tokens import router as push_tokens_router
from app.api.v1.recurring_tasks import router as recurring_tasks_router
from app.api.v1.reports import router as reports_router
from app.api.v1.saved_filters import router as saved_filters_router
from app.api.v1.scheduling import router as scheduling_router
from app.api.v1.search import router as search_router
from app.api.v1.security_intelligence import router as security_intelligence_router
from app.api.v1.sla import router as sla_router
from app.api.v1.support_chat import router as support_chat_router
from app.api.v1.table_views import router as table_views_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.travel import router as travel_router
from app.api.v1.travel import webhook_router as travel_webhook_router
from app.api.v1.user_preferences import router as user_preferences_router
from app.api.v1.users import router as users_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.workload import router as workload_router

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(users_router, prefix="/users", tags=["users"])
router.include_router(
    user_preferences_router, prefix="/user", tags=["user-preferences"]
)
router.include_router(clients_router, prefix="/clients", tags=["clients"])
router.include_router(
    client_comm_prefs_router,
    prefix="/clients",
    tags=["client-communication-preferences"],
)
router.include_router(family_members_router, tags=["family-members"])
router.include_router(intake_router, tags=["intake"])
router.include_router(client_portal_router, prefix="/portal", tags=["portal"])
router.include_router(
    client_preferences_router,
    prefix="/portal",
    tags=["client-preferences"],
)
router.include_router(program_clients_router, prefix="/program-clients", tags=["program-clients"])
router.include_router(programs_router, prefix="/programs", tags=["programs"])
router.include_router(
    program_closure_router,
    prefix="/programs",
    tags=["program-closure"],
)
router.include_router(
    archival_router,
    prefix="/programs",
    tags=["archival"],
)
router.include_router(approvals_router, prefix="/approvals", tags=["approvals"])
router.include_router(
    budget_approvals_router, prefix="/budget-approvals", tags=["budget-approvals"]
)
router.include_router(partners_router, prefix="/partners", tags=["partners"])
router.include_router(
    partner_capabilities_router,
    prefix="/partners",
    tags=["partner-capabilities"],
)
router.include_router(
    partner_availability_router,
    prefix="/partners",
    tags=["partner-availability"],
)
router.include_router(assignments_router, prefix="/assignments", tags=["assignments"])
router.include_router(deliverables_router, prefix="/deliverables", tags=["deliverables"])
router.include_router(partner_portal_router, prefix="/partner-portal", tags=["partner-portal"])
router.include_router(
    partner_payments_router, prefix="/partner-portal", tags=["partner-payments"]
)
router.include_router(
    partner_payments_internal_router, prefix="/partner-payments", tags=["partner-payments"]
)
router.include_router(
    partner_tax_documents_router, prefix="/tax-documents", tags=["tax-documents"]
)
router.include_router(documents_router, prefix="/documents", tags=["documents"])
router.include_router(kyc_documents_router, prefix="/kyc", tags=["kyc-documents"])
router.include_router(kyc_verifications_router, prefix="/kyc", tags=["kyc-verifications"])
router.include_router(
    clearance_certificates_router,
    prefix="/clearance-certificates",
    tags=["clearance-certificates"],
)
router.include_router(audit_logs_router, prefix="/audit-logs", tags=["audit-logs"])
router.include_router(api_keys_router, prefix="/api-keys", tags=["api-keys"])
router.include_router(escalations_router, prefix="/escalations", tags=["escalations"])
router.include_router(sla_router, prefix="/sla", tags=["sla"])
router.include_router(conversations_router, prefix="/conversations", tags=["conversations"])
router.include_router(communications_router, prefix="/communications", tags=["communications"])
router.include_router(
    communication_audit_router,
    prefix="/audit-trail",
    tags=["communication-audit"],
)
router.include_router(docusign_router, prefix="/docusign", tags=["docusign"])
router.include_router(
    communication_logs_router,
    prefix="/communication-logs",
    tags=["communication-logs"],
)
router.include_router(
    communication_templates_router,
    prefix="/communication-templates",
    tags=["communication-templates"],
)
router.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
router.include_router(decision_requests_router, prefix="/decisions", tags=["decisions"])
router.include_router(
    document_requests_router,
    prefix="/document-requests",
    tags=["document-requests"],
)
router.include_router(
    deletion_requests_router,
    prefix="/deletion-requests",
    tags=["deletion-requests"],
)
router.include_router(reports_router, prefix="/reports", tags=["reports"])
router.include_router(custom_reports_router, prefix="/custom-reports", tags=["custom-reports"])
router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
router.include_router(
    partner_scoring_router,
    prefix="/partner-scoring",
    tags=["partner-scoring"],
)
router.include_router(workload_router, prefix="/workload", tags=["workload"])
router.include_router(push_tokens_router, prefix="/push-tokens", tags=["push-tokens"])
router.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
router.include_router(
    recurring_tasks_router,
    prefix="/recurring-tasks",
    tags=["recurring-tasks"],
)
router.include_router(
    table_views_router, prefix="/table-views", tags=["table-views"]
)
router.include_router(
    capability_reviews_router,
    prefix="/capability-reviews",
    tags=["capability-reviews"],
)
router.include_router(
    access_audits_router,
    prefix="/access-audits",
    tags=["access-audits"],
)
router.include_router(
    nps_surveys_router,
    prefix="/nps-surveys",
    tags=["nps-surveys"],
)
router.include_router(
    pulse_surveys_router,
    prefix="/pulse-surveys",
    tags=["pulse-surveys"],
)
router.include_router(
    performance_notices_router,
    prefix="/performance-notices",
    tags=["performance-notices"],
)
router.include_router(
    partner_governance_router,
    prefix="/partner-governance",
    tags=["partner-governance"],
)
router.include_router(messaging_router, prefix="/messaging", tags=["messaging"])
router.include_router(travel_router, prefix="/programs", tags=["travel"])
router.include_router(travel_webhook_router, tags=["travel-webhooks"])
router.include_router(
    security_intelligence_router,
    prefix="/clients",
    tags=["security-intelligence"],
)
router.include_router(
    scheduling_router,
    prefix="/scheduling",
    tags=["scheduling"],
)
router.include_router(
    predictive_router,
    prefix="/predictive",
    tags=["predictive"],
)
router.include_router(invoices_router, prefix="/invoices", tags=["invoices"])
router.include_router(search_router, prefix="/search", tags=["search"])
router.include_router(
    saved_filters_router, prefix="/saved-filters", tags=["saved-filters"]
)
router.include_router(
    program_templates_router,
    prefix="/program-templates",
    tags=["program-templates"],
)
router.include_router(export_router, prefix="/export", tags=["export"])
router.include_router(export_pdf_router, prefix="/export/pdf", tags=["export-pdf"])
router.include_router(meetings_router, prefix="/meetings", tags=["meetings"])
router.include_router(portal_updates_router, prefix="/portal", tags=["portal-updates"])
router.include_router(
    escalation_templates_router,
    prefix="/escalation-templates",
    tags=["escalation-templates"],
)
router.include_router(
    deliverable_templates_router,
    prefix="/deliverable-templates",
    tags=["deliverable-templates"],
)
router.include_router(
    webhooks_router,
    prefix="/partner-portal",
    tags=["partner-webhooks"],
)
router.include_router(calendar_router, prefix="/calendar", tags=["calendar"])
router.include_router(calendar_feed_router, prefix="/calendar", tags=["calendar-feed"])
router.include_router(imports_router, prefix="/imports", tags=["imports"])
router.include_router(feedback_router, prefix="/feedback", tags=["feedback"])
router.include_router(support_chat_router, prefix="/support", tags=["support-chat"])
router.include_router(public_router, prefix="/public", tags=["public-api"])
router.include_router(public_reports_router, prefix="/shared", tags=["shared-reports"])
