"""Client profile management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import (
    DB,
    CurrentUser,
    require_admin,
    require_compliance,
    require_internal,
    require_rm_or_above,
)
from app.models.client_profile import ClientProfile
from app.schemas.client_profile import (
    ClientProfileCreate,
    ClientProfileListResponse,
    ClientProfileResponse,
    ClientProfileUpdate,
    ClientProvisionRequest,
    ComplianceCertificate,
    ComplianceReviewRequest,
    MDApprovalRequest,
)
from app.services.client_service import client_service

router = APIRouter()


@router.post(
    "/",
    response_model=ClientProfileResponse,
    status_code=201,
    dependencies=[Depends(require_rm_or_above)],
)
async def create_client_intake(
    data: ClientProfileCreate,
    db: DB,
    current_user: CurrentUser,
):
    return await client_service.create_intake(db, data=data, created_by_id=current_user.id)


@router.get("/", response_model=ClientProfileListResponse, dependencies=[Depends(require_internal)])
async def list_client_profiles(
    db: DB,
    compliance_status: str | None = None,
    approval_status: str | None = None,
    assigned_rm_id: uuid.UUID | None = None,
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    filters = []
    if compliance_status:
        filters.append(ClientProfile.compliance_status == compliance_status)
    if approval_status:
        filters.append(ClientProfile.approval_status == approval_status)
    if assigned_rm_id:
        filters.append(ClientProfile.assigned_rm_id == assigned_rm_id)
    if search:
        pattern = f"%{search}%"
        filters.append(
            ClientProfile.legal_name.ilike(pattern) | ClientProfile.primary_email.ilike(pattern)
        )

    profiles, total = await client_service.get_multi(db, skip=skip, limit=limit, filters=filters)
    return ClientProfileListResponse(profiles=profiles, total=total)


@router.get(
    "/my-portfolio",
    response_model=ClientProfileListResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def get_my_portfolio(
    db: DB,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    profiles, total = await client_service.get_rm_portfolio(
        db, current_user.id, skip=skip, limit=limit
    )
    return ClientProfileListResponse(profiles=profiles, total=total)


@router.get(
    "/{profile_id}", response_model=ClientProfileResponse, dependencies=[Depends(require_internal)]
)
async def get_client_profile(profile_id: uuid.UUID, db: DB):
    profile = await client_service.get(db, profile_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile


@router.patch(
    "/{profile_id}",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_client_profile(
    profile_id: uuid.UUID,
    data: ClientProfileUpdate,
    db: DB,
):
    profile = await client_service.get(db, profile_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return await client_service.update(db, db_obj=profile, obj_in=data)


@router.patch(
    "/{profile_id}/intelligence",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_intelligence_file(
    profile_id: uuid.UUID,
    data: dict,
    db: DB,
):
    return await client_service.update_intelligence_file(db, profile_id, data)


@router.post(
    "/{profile_id}/compliance-review",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_compliance)],
)
async def submit_compliance_review(
    profile_id: uuid.UUID,
    review: ComplianceReviewRequest,
    db: DB,
    current_user: CurrentUser,
):
    return await client_service.submit_compliance_review(
        db, profile_id=profile_id, review=review, reviewer_id=current_user.id
    )


@router.get(
    "/{profile_id}/compliance-certificate",
    response_model=ComplianceCertificate,
    dependencies=[Depends(require_internal)],
)
async def get_compliance_certificate(
    profile_id: uuid.UUID,
    db: DB,
):
    return await client_service.generate_compliance_certificate(db, profile_id)


@router.post(
    "/{profile_id}/md-approval",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_admin)],
)
async def submit_md_approval(
    profile_id: uuid.UUID,
    approval: MDApprovalRequest,
    db: DB,
    current_user: CurrentUser,
):
    return await client_service.submit_md_approval(
        db, profile_id=profile_id, approval=approval, approver_id=current_user.id
    )


@router.post(
    "/{profile_id}/provision",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_admin)],
)
async def provision_client(
    profile_id: uuid.UUID,
    request: ClientProvisionRequest,
    db: DB,
):
    return await client_service.provision_client_user(db, profile_id=profile_id, request=request)
