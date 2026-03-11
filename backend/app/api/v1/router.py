from fastapi import APIRouter

from app.api.v1.approvals import router as approvals_router
from app.api.v1.audit_logs import router as audit_logs_router
from app.api.v1.auth import router as auth_router
from app.api.v1.client_portal import router as client_portal_router
from app.api.v1.client_preferences import router as client_preferences_router
from app.api.v1.clients import router as clients_router
from app.api.v1.communications import router as communications_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.decision_requests import router as decision_requests_router
from app.api.v1.deliverables import router as deliverables_router
from app.api.v1.documents import router as documents_router
from app.api.v1.escalations import router as escalations_router
from app.api.v1.family_members import router as family_members_router
from app.api.v1.intake import router as intake_router
from app.api.v1.kyc_documents import router as kyc_documents_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.partner_assignments import router as assignments_router
from app.api.v1.partner_portal import router as partner_portal_router
from app.api.v1.partner_scoring import router as partner_scoring_router
from app.api.v1.partners import router as partners_router
from app.api.v1.program_clients import router as program_clients_router
from app.api.v1.program_closure import router as program_closure_router
from app.api.v1.programs import router as programs_router
from app.api.v1.push_tokens import router as push_tokens_router
from app.api.v1.reports import router as reports_router
from app.api.v1.sla import router as sla_router
from app.api.v1.users import router as users_router
from app.api.v1.workload import router as workload_router

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(users_router, prefix="/users", tags=["users"])
router.include_router(clients_router, prefix="/clients", tags=["clients"])
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
router.include_router(approvals_router, prefix="/approvals", tags=["approvals"])
router.include_router(partners_router, prefix="/partners", tags=["partners"])
router.include_router(assignments_router, prefix="/assignments", tags=["assignments"])
router.include_router(deliverables_router, prefix="/deliverables", tags=["deliverables"])
router.include_router(partner_portal_router, prefix="/partner-portal", tags=["partner-portal"])
router.include_router(documents_router, prefix="/documents", tags=["documents"])
router.include_router(kyc_documents_router, prefix="/kyc", tags=["kyc-documents"])
router.include_router(audit_logs_router, prefix="/audit-logs", tags=["audit-logs"])
router.include_router(escalations_router, prefix="/escalations", tags=["escalations"])
router.include_router(sla_router, prefix="/sla", tags=["sla"])
router.include_router(conversations_router, prefix="/conversations", tags=["conversations"])
router.include_router(communications_router, prefix="/communications", tags=["communications"])
router.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
router.include_router(decision_requests_router, prefix="/decisions", tags=["decisions"])
router.include_router(reports_router, prefix="/reports", tags=["reports"])
router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
router.include_router(
    partner_scoring_router,
    prefix="/partner-scoring",
    tags=["partner-scoring"],
)
router.include_router(workload_router, prefix="/workload", tags=["workload"])
router.include_router(push_tokens_router, prefix="/push-tokens", tags=["push-tokens"])
