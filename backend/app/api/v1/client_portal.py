"""Client portal endpoints (client-facing, read-only)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import DB, CurrentUser, RoleChecker
from app.models.enums import UserRole
from app.schemas.client_profile import ClientPortalProfileResponse
from app.services.client_service import client_service

require_client = RoleChecker([UserRole.client])

router = APIRouter()


@router.get("/profile", response_model=ClientPortalProfileResponse, dependencies=[Depends(require_client)])
async def get_my_profile(
    db: DB,
    current_user: CurrentUser,
):
    profile = await client_service.get_client_dashboard_data(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile found")
    return profile


@router.get("/programs", dependencies=[Depends(require_client)])
async def get_my_programs(
    current_user: CurrentUser,
):
    return []


@router.get("/communications", dependencies=[Depends(require_client)])
async def get_my_communications(
    current_user: CurrentUser,
):
    return []
