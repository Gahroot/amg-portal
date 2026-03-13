"""Client profile management endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.api.deps import (
    DB,
    CurrentUser,
    require_admin,
    require_compliance,
    require_internal,
    require_rm_or_above,
)
from app.models.client_profile import ClientProfile
from app.models.enums import UserRole
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
from app.services.audit_service import log_action, model_to_dict
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
    request: Request,
):
    profile = await client_service.create_intake(db, data=data, created_by_id=current_user.id)
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="create",
        entity_type="client_profile",
        entity_id=str(profile.id),
        after_state=model_to_dict(profile),
        request=request,
    )
    await db.commit()
    return profile


@router.get("/", response_model=ClientProfileListResponse)
async def list_client_profiles(
    db: DB,
    current_user: CurrentUser,
    compliance_status: str | None = None,
    approval_status: str | None = None,
    assigned_rm_id: uuid.UUID | None = None,
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _: None = Depends(require_internal),
):
    filters = []

    # RM scoping: relationship managers see only their assigned clients
    if current_user.role == UserRole.relationship_manager.value:
        filters.append(ClientProfile.assigned_rm_id == current_user.id)

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
async def get_client_profile(profile_id: uuid.UUID, db: DB) -> Any:
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
    current_user: CurrentUser,
    request: Request,
):
    profile = await client_service.get(db, profile_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    before = model_to_dict(profile)
    updated = await client_service.update(db, db_obj=profile, obj_in=data)
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="client_profile",
        entity_id=str(profile_id),
        before_state=before,
        after_state=model_to_dict(updated),
        request=request,
    )
    await db.commit()
    return updated


@router.patch(
    "/{profile_id}/intelligence",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_intelligence_file(
    profile_id: uuid.UUID,
    data: dict,
    db: DB,
    current_user: CurrentUser,
    request: Request,
):
    profile = await client_service.get(db, profile_id)
    before = model_to_dict(profile) if profile else None
    updated = await client_service.update_intelligence_file(db, profile_id, data)
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="client_profile",
        entity_id=str(profile_id),
        before_state=before,
        after_state=model_to_dict(updated),
        request=request,
    )
    await db.commit()
    return updated


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
    request: Request,
):
    profile = await client_service.get(db, profile_id)
    before = model_to_dict(profile) if profile else None
    updated = await client_service.submit_compliance_review(
        db, profile_id=profile_id, review=review, reviewer_id=current_user.id
    )
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="client_profile",
        entity_id=str(profile_id),
        before_state=before,
        after_state=model_to_dict(updated),
        request=request,
    )
    await db.commit()
    return updated


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
    request: Request,
):
    profile = await client_service.get(db, profile_id)
    before = model_to_dict(profile) if profile else None
    updated = await client_service.submit_md_approval(
        db, profile_id=profile_id, approval=approval, approver_id=current_user.id
    )
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="client_profile",
        entity_id=str(profile_id),
        before_state=before,
        after_state=model_to_dict(updated),
        request=request,
    )
    await db.commit()
    return updated


@router.post(
    "/{profile_id}/provision",
    response_model=ClientProfileResponse,
    dependencies=[Depends(require_admin)],
)
async def provision_client(
    profile_id: uuid.UUID,
    provision_request: ClientProvisionRequest,
    db: DB,
    current_user: CurrentUser,
    request: Request,
):
    profile = await client_service.get(db, profile_id)
    before = model_to_dict(profile) if profile else None
    updated = await client_service.provision_client_user(
        db, profile_id=profile_id, request=provision_request
    )
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="client_profile",
        entity_id=str(profile_id),
        before_state=before,
        after_state=model_to_dict(updated),
        request=request,
    )
    await db.commit()
    return updated


@router.post(
    "/{profile_id}/sync-crm",
    dependencies=[Depends(require_rm_or_above)],
)
async def sync_client_crm(
    profile_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    request: Request,
    include_communications: bool = Query(False),
) -> dict[str, Any]:
    """Trigger an on-demand CRM sync for a specific client profile.

    Pushes portal data to CRM (portal is master), then pulls any new
    CRM fields that are empty in the portal. Optionally syncs
    communication history as well.
    """
    from app.services.crm_service import get_crm_service

    profile = await client_service.get(db, profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    service = get_crm_service()

    # Push portal → CRM
    before = model_to_dict(profile)
    push_result = await service.sync_client_to_crm(db, profile)
    if not push_result.success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"CRM push failed: {push_result.error}",
        )

    # Pull CRM → Portal (fills empty fields only)
    pull_changes: dict[str, Any] = {}
    if profile.external_crm_id:
        pull_result = await service.sync_client_from_crm(
            db, profile.external_crm_id
        )
        pull_changes = pull_result.changes

    # Optionally sync communications
    comm_result_data: dict[str, Any] = {}
    if include_communications:
        comm_result = await service.sync_communications(db, profile_id)
        comm_result_data = comm_result.changes

    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="crm_sync",
        entity_type="client_profile",
        entity_id=str(profile_id),
        before_state=before,
        after_state=model_to_dict(profile),
        request=request,
    )
    await db.commit()

    return {
        "status": "synced",
        "external_crm_id": profile.external_crm_id,
        "push": {
            "success": push_result.success,
            "changes": push_result.changes,
        },
        "pull": {
            "changes": pull_changes,
        },
        "communications": comm_result_data,
    }
