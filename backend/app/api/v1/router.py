from fastapi import APIRouter

from app.api.v1.approvals import router as approvals_router
from app.api.v1.auth import router as auth_router
from app.api.v1.client_portal import router as client_portal_router
from app.api.v1.clients import router as clients_router
from app.api.v1.deliverables import router as deliverables_router
from app.api.v1.partner_assignments import router as assignments_router
from app.api.v1.partner_portal import router as partner_portal_router
from app.api.v1.partners import router as partners_router
from app.api.v1.program_clients import router as program_clients_router
from app.api.v1.programs import router as programs_router
from app.api.v1.users import router as users_router

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(users_router, prefix="/users", tags=["users"])
router.include_router(clients_router, prefix="/clients", tags=["clients"])
router.include_router(client_portal_router, prefix="/portal", tags=["portal"])
router.include_router(program_clients_router, prefix="/program-clients", tags=["program-clients"])
router.include_router(programs_router, prefix="/programs", tags=["programs"])
router.include_router(approvals_router, prefix="/approvals", tags=["approvals"])
router.include_router(partners_router, prefix="/partners", tags=["partners"])
router.include_router(assignments_router, prefix="/assignments", tags=["assignments"])
router.include_router(deliverables_router, prefix="/deliverables", tags=["deliverables"])
router.include_router(partner_portal_router, prefix="/partner-portal", tags=["partner-portal"])
