"""Partner directory management endpoints (internal views)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser, require_admin, require_internal, require_rm_or_above
from app.models.enums import UserRole
from app.models.partner import PartnerProfile
from app.models.user import User
from app.schemas.partner import (
    PartnerProfileCreate,
    PartnerProfileListResponse,
    PartnerProfileResponse,
    PartnerProfileUpdate,
    PartnerProvisionRequest,
)
from app.services.storage import storage_service

router = APIRouter()


@router.post("/", response_model=PartnerProfileResponse, status_code=201)
async def create_partner(
    data: PartnerProfileCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
):
    partner = PartnerProfile(
        firm_name=data.firm_name,
        contact_name=data.contact_name,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        capabilities=data.capabilities,
        geographies=data.geographies,
        notes=data.notes,
        status="pending",
        created_by=current_user.id,
    )
    db.add(partner)
    await db.commit()
    await db.refresh(partner)
    return partner


@router.get("/", response_model=PartnerProfileListResponse)
async def list_partners(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    capability: str | None = None,
    geography: str | None = None,
    availability: str | None = None,
    status: str | None = None,
    search: str | None = None,
):
    query = select(PartnerProfile)
    count_query = select(func.count()).select_from(PartnerProfile)

    filters = []
    if status:
        filters.append(PartnerProfile.status == status)
    if availability:
        filters.append(PartnerProfile.availability_status == availability)
    if search:
        search_filter = PartnerProfile.firm_name.ilike(
            f"%{search}%"
        ) | PartnerProfile.contact_name.ilike(f"%{search}%")
        filters.append(search_filter)
    # JSON array contains filters for capability and geography
    if capability:
        filters.append(PartnerProfile.capabilities.op("@>")(f'["{capability}"]'))
    if geography:
        filters.append(PartnerProfile.geographies.op("@>")(f'["{geography}"]'))

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.offset(skip).limit(limit).order_by(PartnerProfile.created_at.desc())
    result = await db.execute(query)
    profiles = result.scalars().all()

    return PartnerProfileListResponse(profiles=profiles, total=total)


@router.get("/{partner_id}", response_model=PartnerProfileResponse)
async def get_partner(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
):
    result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner


@router.patch("/{partner_id}", response_model=PartnerProfileResponse)
async def update_partner(
    partner_id: UUID,
    data: PartnerProfileUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
):
    result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(partner, field, value)

    await db.commit()
    await db.refresh(partner)
    return partner


@router.post("/{partner_id}/provision", response_model=PartnerProfileResponse)
async def provision_partner(
    partner_id: UUID,
    data: PartnerProvisionRequest,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_admin),
):
    result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    if partner.user_id:
        raise HTTPException(status_code=400, detail="Partner already has a user account")

    import secrets

    from app.core.security import hash_password

    password = data.password or secrets.token_urlsafe(16)

    user = User(
        email=partner.contact_email,
        hashed_password=hash_password(password),
        full_name=partner.contact_name,
        role=UserRole.partner,
        status="active",
    )
    db.add(user)
    await db.flush()

    partner.user_id = user.id
    partner.status = "active"
    await db.commit()
    await db.refresh(partner)
    return partner


@router.post("/{partner_id}/compliance-doc", response_model=PartnerProfileResponse)
async def upload_compliance_doc(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    _: None = Depends(require_rm_or_above),
):
    result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    object_path, _ = await storage_service.upload_file(file, f"partners/{partner_id}/compliance")
    partner.compliance_doc_url = object_path
    await db.commit()
    await db.refresh(partner)
    return partner
