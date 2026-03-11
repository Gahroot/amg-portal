"""Partner capability matrix, qualifications, certifications, and onboarding endpoints."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentUser,
    require_admin,
    require_coordinator_or_above,
    require_internal,
    require_rm_or_above,
)
from app.models.partner import PartnerProfile
from app.models.partner_capability import (
    PartnerCapability,
    PartnerCertification,
    PartnerOnboarding,
    PartnerQualification,
    ServiceCategory,
)
from app.schemas.partner_capability import (
    ApprovalStatus,
    CapabilityCreate,
    CapabilityListResponse,
    CapabilityMatrixResponse,
    CapabilityResponse,
    CapabilityUpdate,
    CertificationCreate,
    CertificationListResponse,
    CertificationResponse,
    CertificationVerification,
    OnboardingCreate,
    OnboardingResponse,
    OnboardingStage,
    OnboardingStageComplete,
    OnboardingUpdate,
    QualificationApproval,
    QualificationCreate,
    QualificationListResponse,
    QualificationResponse,
    ServiceCategoryCreate,
    ServiceCategoryListResponse,
    ServiceCategoryResponse,
    ServiceCategoryUpdate,
)
from app.services.storage import storage_service

router = APIRouter()

# Constants
ONBOARDING_STAGES = [
    "profile_setup", "capability_matrix", "compliance_docs",
    "certification_upload", "review", "completed"
]


# ============================================================================
# Service Categories
# ============================================================================


@router.get("/service-categories", response_model=ServiceCategoryListResponse)
async def list_service_categories(
    db: DB,
    current_user: CurrentUser,
    _: None = require_internal,
    active_only: bool = Query(True),
):
    """List all service categories."""
    query = select(ServiceCategory)
    if active_only:
        query = query.where(ServiceCategory.active.is_(True))

    result = await db.execute(query.order_by(ServiceCategory.name))
    categories = result.scalars().all()

    total_result = await db.execute(select(func.count()).select_from(ServiceCategory))
    total = total_result.scalar()

    return ServiceCategoryListResponse(categories=categories, total=total)


@router.post("/service-categories", response_model=ServiceCategoryResponse, status_code=201)
async def create_service_category(
    data: ServiceCategoryCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = require_admin,
):
    """Create a new service category (admin only)."""
    # Check if name already exists
    existing = await db.execute(
        select(ServiceCategory).where(ServiceCategory.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Service category with this name already exists")

    category = ServiceCategory(
        name=data.name,
        description=data.description,
        required_capabilities=data.required_capabilities,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.patch("/service-categories/{category_id}", response_model=ServiceCategoryResponse)
async def update_service_category(
    category_id: UUID,
    data: ServiceCategoryUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = require_admin,
):
    """Update a service category (admin only)."""
    result = await db.execute(
        select(ServiceCategory).where(ServiceCategory.id == category_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Service category not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return category


# ============================================================================
# Partner Capabilities
# ============================================================================


@router.get("/partners/{partner_id}/capabilities", response_model=CapabilityListResponse)
async def get_partner_capabilities(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = require_internal,
):
    """Get all capabilities for a partner."""
    result = await db.execute(
        select(PartnerCapability)
        .where(PartnerCapability.partner_id == partner_id)
        .order_by(PartnerCapability.capability_name)
    )
    capabilities = result.scalars().all()

    return CapabilityListResponse(
        capabilities=capabilities,
        total=len(capabilities),
    )


@router.post("/partners/{partner_id}/capabilities", response_model=CapabilityResponse, status_code=201)
async def add_partner_capability(
    partner_id: UUID,
    data: CapabilityCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = require_coordinator_or_above,
):
    """Add a capability to a partner."""
    # Verify partner exists
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == partner_id)
    )
    if not partner_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Partner not found")

    # Check for duplicate capability
    existing = await db.execute(
        select(PartnerCapability).where(
            PartnerCapability.partner_id == partner_id,
            PartnerCapability.capability_name == data.capability_name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Partner already has this capability",
        )

    capability = PartnerCapability(
        partner_id=partner_id,
        capability_name=data.capability_name,
        proficiency_level=data.proficiency_level.value,
        years_experience=data.years_experience,
        notes=data.notes,
    )
    db.add(capability)
    await db.commit()
    await db.refresh(capability)
    return capability


@router.patch("/partners/{partner_id}/capabilities/{capability_id}", response_model=CapabilityResponse)
async def update_partner_capability(
    partner_id: UUID,
    capability_id: UUID,
    data: CapabilityUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = require_coordinator_or_above,
):
    """Update a partner capability."""
    result = await db.execute(
        select(PartnerCapability).where(
            PartnerCapability.id == capability_id,
            PartnerCapability.partner_id == partner_id,
        )
    )
    capability = result.scalar_one_or_none()
    if not capability:
        raise HTTPException(status_code=404, detail="Capability not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(capability, field, value.value if hasattr(value, "value") else value)

    await db.commit()
    await db.refresh(capability)
    return capability


@router.delete("/partners/{partner_id}/capabilities/{capability_id}", status_code=204)
async def delete_partner_capability(
    partner_id: UUID,
    capability_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = require_coordinator_or_above,
):
    """Delete a partner capability."""
    result = await db.execute(
        select(PartnerCapability).where(
            PartnerCapability.id == capability_id,
            PartnerCapability.partner_id == partner_id,
        )
    )
    capability = result.scalar_one_or_none()
    if not capability:
        raise HTTPException(status_code=404, detail="Capability not found")

    await db.delete(capability)
    await db.commit()


@router.post("/partners/{partner_id}/capabilities/{capability_id}/verify", response_model=CapabilityResponse)
async def verify_partner_capability(
    partner_id: UUID,
    capability_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = require_rm_or_above,
):
    """Verify a partner capability (RM or above only)."""
    result = await db.execute(
        select(PartnerCapability).where(
            PartnerCapability.id == capability_id,
            PartnerCapability.partner_id == partner_id,
        )
    )
    capability = result.scalar_one_or_none()
    if not capability:
        raise HTTPException(status_code=404, detail="Capability not found")

    capability.verified = True
    capability.verified_by = current_user.id
    capability.verified_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(capability)
    return capability


# ============================================================================
# Partner Qualifications
# ============================================================================


@router.get("/partners/{partner_id}/qualifications", response_model=QualificationListResponse)
async def get_partner_qualifications(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = require_internal,
):
    """Get all qualifications for a partner."""
    result = await db.execute(
        select(PartnerQualification)
        .options(selectinload(PartnerQualification.category))
        .where(PartnerQualification.partner_id == partner_id)
        .order_by(PartnerQualification.created_at.desc())
    )
    qualifications = result.scalars().all()

    qual_responses = []
    for q in qualifications:
        qual_responses.append(
            QualificationResponse(
                id=q.id,
                partner_id=q.partner_id,
                category_id=q.category_id,
                category_name=q.category.name if q.category else None,
                qualification_level=q.qualification_level,
                approval_status=q.approval_status,
                approved_by=q.approved_by,
                approved_at=q.approved_at,
                notes=q.notes,
                created_at=q.created_at,
                updated_at=q.updated_at,
            )
        )

    return QualificationListResponse(qualifications=qual_responses, total=len(qual_responses))


@router.post("/partners/{partner_id}/qualifications", response_model=QualificationResponse, status_code=201)
async def submit_qualification(
    partner_id: UUID,
    data: QualificationCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = require_coordinator_or_above,
):
    """Submit a qualification request for a partner."""
    # Verify partner and category exist
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == partner_id)
    )
    if not partner_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Partner not found")

    category_result = await db.execute(
        select(ServiceCategory).where(ServiceCategory.id == data.category_id)
    )
    if not category_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Service category not found")

    # Check for duplicate qualification
    existing = await db.execute(
        select(PartnerQualification).where(
            PartnerQualification.partner_id == partner_id,
            PartnerQualification.category_id == data.category_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Partner already has a qualification for this category",
        )

    qualification = PartnerQualification(
        partner_id=partner_id,
        category_id=data.category_id,
        qualification_level=data.qualification_level.value,
        notes=data.notes,
    )
    db.add(qualification)
    await db.commit()
    await db.refresh(qualification)

    # Load category for response
    await db.refresh(qualification, ["category"])
    return QualificationResponse(
        id=qualification.id,
        partner_id=qualification.partner_id,
        category_id=qualification.category_id,
        category_name=qualification.category.name,
        qualification_level=qualification.qualification_level,
        approval_status=qualification.approval_status,
        approved_by=qualification.approved_by,
        approved_at=qualification.approved_at,
        notes=qualification.notes,
        created_at=qualification.created_at,
        updated_at=qualification.updated_at,
    )


@router.patch("/partners/{partner_id}/qualifications/{qualification_id}", response_model=QualificationResponse)
async def approve_qualification(
    partner_id: UUID,
    qualification_id: UUID,
    data: QualificationApproval,
    db: DB,
    current_user: CurrentUser,
    _: None = require_rm_or_above,
):
    """Approve or reject a qualification (RM or above only)."""
    result = await db.execute(
        select(PartnerQualification)
        .options(selectinload(PartnerQualification.category))
        .where(
            PartnerQualification.id == qualification_id,
            PartnerQualification.partner_id == partner_id,
        )
    )
    qualification = result.scalar_one_or_none()
    if not qualification:
        raise HTTPException(status_code=404, detail="Qualification not found")

    qualification.approval_status = data.status.value
    if data.status == ApprovalStatus.approved:
        qualification.approved_by = current_user.id
        qualification.approved_at = datetime.now(UTC)
    if data.notes:
        qualification.notes = data.notes

    await db.commit()
    await db.refresh(qualification)

    return QualificationResponse(
        id=qualification.id,
        partner_id=qualification.partner_id,
        category_id=qualification.category_id,
        category_name=qualification.category.name if qualification.category else None,
        qualification_level=qualification.qualification_level,
        approval_status=qualification.approval_status,
        approved_by=qualification.approved_by,
        approved_at=qualification.approved_at,
        notes=qualification.notes,
        created_at=qualification.created_at,
        updated_at=qualification.updated_at,
    )


# ============================================================================
# Partner Certifications
# ============================================================================


@router.get("/partners/{partner_id}/certifications", response_model=CertificationListResponse)
async def get_partner_certifications(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = require_internal,
):
    """Get all certifications for a partner."""
    result = await db.execute(
        select(PartnerCertification)
        .where(PartnerCertification.partner_id == partner_id)
        .order_by(PartnerCertification.created_at.desc())
    )
    certifications = result.scalars().all()

    today = datetime.now(UTC).date()
    thirty_days_from_now = today + timedelta(days=30)

    cert_responses = []
    for c in certifications:
        is_expired = c.expiry_date is not None and c.expiry_date < today
        is_expiring_soon = (
            c.expiry_date is not None
            and today <= c.expiry_date <= thirty_days_from_now
        )

        cert_responses.append(
            CertificationResponse(
                id=c.id,
                partner_id=c.partner_id,
                name=c.name,
                issuing_body=c.issuing_body,
                certificate_number=c.certificate_number,
                issue_date=c.issue_date,
                expiry_date=c.expiry_date,
                document_url=c.document_url,
                verification_status=c.verification_status,
                verified_by=c.verified_by,
                verified_at=c.verified_at,
                notes=c.notes,
                created_at=c.created_at,
                updated_at=c.updated_at,
                is_expired=is_expired,
                is_expiring_soon=is_expiring_soon,
            )
        )

    return CertificationListResponse(certifications=cert_responses, total=len(cert_responses))


@router.post("/partners/{partner_id}/certifications", response_model=CertificationResponse, status_code=201)
async def add_partner_certification(
    partner_id: UUID,
    data: CertificationCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = require_coordinator_or_above,
):
    """Add a certification for a partner."""
    # Verify partner exists
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == partner_id)
    )
    if not partner_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Partner not found")

    today = datetime.now(UTC).date()
    is_expired = data.expiry_date is not None and data.expiry_date < today
    is_expiring_soon = (
        data.expiry_date is not None
        and today <= data.expiry_date <= today + timedelta(days=30)
    )

    certification = PartnerCertification(
        partner_id=partner_id,
        name=data.name,
        issuing_body=data.issuing_body,
        certificate_number=data.certificate_number,
        issue_date=data.issue_date,
        expiry_date=data.expiry_date,
        document_url=data.document_url,
        notes=data.notes,
    )
    db.add(certification)
    await db.commit()
    await db.refresh(certification)

    return CertificationResponse(
        id=certification.id,
        partner_id=certification.partner_id,
        name=certification.name,
        issuing_body=certification.issuing_body,
        certificate_number=certification.certificate_number,
        issue_date=certification.issue_date,
        expiry_date=certification.expiry_date,
        document_url=certification.document_url,
        verification_status=certification.verification_status,
        verified_by=certification.verified_by,
        verified_at=certification.verified_at,
        notes=certification.notes,
        created_at=certification.created_at,
        updated_at=certification.updated_at,
        is_expired=is_expired,
        is_expiring_soon=is_expiring_soon,
    )


@router.post("/partners/{partner_id}/certifications/{certification_id}/document", response_model=CertificationResponse)
async def upload_certification_document(
    partner_id: UUID,
    certification_id: UUID,
    db: DB,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    _: None = require_coordinator_or_above,
):
    """Upload a document for a certification."""
    result = await db.execute(
        select(PartnerCertification).where(
            PartnerCertification.id == certification_id,
            PartnerCertification.partner_id == partner_id,
        )
    )
    certification = result.scalar_one_or_none()
    if not certification:
        raise HTTPException(status_code=404, detail="Certification not found")

    object_path, _ = await storage_service.upload_file(
        file, f"partners/{partner_id}/certifications/{certification_id}"
    )
    certification.document_url = object_path
    await db.commit()
    await db.refresh(certification)

    today = datetime.now(UTC).date()
    is_expired = certification.expiry_date is not None and certification.expiry_date < today
    is_expiring_soon = (
        certification.expiry_date is not None
        and today <= certification.expiry_date <= today + timedelta(days=30)
    )

    return CertificationResponse(
        id=certification.id,
        partner_id=certification.partner_id,
        name=certification.name,
        issuing_body=certification.issuing_body,
        certificate_number=certification.certificate_number,
        issue_date=certification.issue_date,
        expiry_date=certification.expiry_date,
        document_url=certification.document_url,
        verification_status=certification.verification_status,
        verified_by=certification.verified_by,
        verified_at=certification.verified_at,
        notes=certification.notes,
        created_at=certification.created_at,
        updated_at=certification.updated_at,
        is_expired=is_expired,
        is_expiring_soon=is_expiring_soon,
    )


@router.post("/partners/{partner_id}/certifications/{certification_id}/verify", response_model=CertificationResponse)
async def verify_partner_certification(
    partner_id: UUID,
    certification_id: UUID,
    data: CertificationVerification,
    db: DB,
    current_user: CurrentUser,
    _: None = require_rm_or_above,
):
    """Verify a partner certification (RM or above only)."""
    result = await db.execute(
        select(PartnerCertification).where(
            PartnerCertification.id == certification_id,
            PartnerCertification.partner_id == partner_id,
        )
    )
    certification = result.scalar_one_or_none()
    if not certification:
        raise HTTPException(status_code=404, detail="Certification not found")

    certification.verification_status = data.status.value
    certification.verified_by = current_user.id
    certification.verified_at = datetime.now(UTC)
    if data.notes:
        certification.notes = data.notes

    await db.commit()
    await db.refresh(certification)

    today = datetime.now(UTC).date()
    is_expired = certification.expiry_date is not None and certification.expiry_date < today
    is_expiring_soon = (
        certification.expiry_date is not None
        and today <= certification.expiry_date <= today + timedelta(days=30)
    )

    return CertificationResponse(
        id=certification.id,
        partner_id=certification.partner_id,
        name=certification.name,
        issuing_body=certification.issuing_body,
        certificate_number=certification.certificate_number,
        issue_date=certification.issue_date,
        expiry_date=certification.expiry_date,
        document_url=certification.document_url,
        verification_status=certification.verification_status,
        verified_by=certification.verified_by,
        verified_at=certification.verified_at,
        notes=certification.notes,
        created_at=certification.created_at,
        updated_at=certification.updated_at,
        is_expired=is_expired,
        is_expiring_soon=is_expiring_soon,
    )


# ============================================================================
# Partner Onboarding
# ============================================================================


@router.get("/partners/{partner_id}/onboarding", response_model=OnboardingResponse)
async def get_partner_onboarding(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = require_internal,
):
    """Get onboarding status for a partner."""
    result = await db.execute(
        select(PartnerOnboarding)
        .options(selectinload(PartnerOnboarding.coordinator))
        .where(PartnerOnboarding.partner_id == partner_id)
    )
    onboarding = result.scalar_one_or_none()
    if not onboarding:
        return None

    stages = ONBOARDING_STAGES
    completed_count = len(onboarding.completed_stages or [])
    progress_percentage = int((completed_count / len(stages)) * 100)

    return OnboardingResponse(
        id=onboarding.id,
        partner_id=onboarding.partner_id,
        current_stage=onboarding.current_stage,
        checklist_items=onboarding.checklist_items or {},
        completed_stages=onboarding.completed_stages or [],
        assigned_coordinator=onboarding.assigned_coordinator,
        coordinator_name=(
            f"{onboarding.coordinator.full_name}" if onboarding.coordinator else None
        ),
        started_at=onboarding.started_at,
        completed_at=onboarding.completed_at,
        created_at=onboarding.created_at,
        updated_at=onboarding.updated_at,
        progress_percentage=progress_percentage,
    )


@router.post("/partners/{partner_id}/onboarding", response_model=OnboardingResponse, status_code=201)
async def start_onboarding(
    partner_id: UUID,
    data: OnboardingCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = require_coordinator_or_above,
):
    """Start the onboarding process for a partner."""
    # Verify partner exists
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == partner_id)
    )
    partner = partner_result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    # Check if onboarding already exists
    existing = await db.execute(
        select(PartnerOnboarding).where(PartnerOnboarding.partner_id == partner_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Onboarding already started for this partner")

    # Initialize checklist items for all stages
    default_checklist = {
        "profile_setup": {
            "firm_info": False,
            "contact_info": False,
            "geographies": False,
        },
        "capability_matrix": {
            "capabilities_added": False,
            "proficiency_set": False,
        },
        "compliance_docs": {
            "compliance_doc_uploaded": False,
            "compliance_verified": False,
        },
        "certification_upload": {
            "certifications_added": False,
            "certifications_verified": False,
        },
        "review": {
            "review_submitted": False,
            "review_approved": False,
        },
    }

    onboarding = PartnerOnboarding(
        partner_id=partner_id,
        current_stage=OnboardingStage.profile_setup.value,
        checklist_items=default_checklist,
        completed_stages=[],
        assigned_coordinator=data.assigned_coordinator,
    )
    db.add(onboarding)

    # Update partner status to indicate onboarding
    partner.status = "onboarding"

    await db.commit()
    await db.refresh(onboarding)

    stages = ONBOARDING_STAGES
    progress_percentage = int((0 / len(stages)) * 100)

    return OnboardingResponse(
        id=onboarding.id,
        partner_id=onboarding.partner_id,
        current_stage=onboarding.current_stage,
        checklist_items=onboarding.checklist_items,
        completed_stages=onboarding.completed_stages,
        assigned_coordinator=onboarding.assigned_coordinator,
        coordinator_name=None,
        started_at=onboarding.started_at,
        completed_at=onboarding.completed_at,
        created_at=onboarding.created_at,
        updated_at=onboarding.updated_at,
        progress_percentage=progress_percentage,
    )


@router.post("/partners/{partner_id}/onboarding/complete-stage", response_model=OnboardingResponse)
async def complete_onboarding_stage(
    partner_id: UUID,
    data: OnboardingStageComplete,
    db: DB,
    current_user: CurrentUser,
    _: None = require_coordinator_or_above,
):
    """Complete an onboarding stage and advance to the next."""
    result = await db.execute(
        select(PartnerOnboarding).where(PartnerOnboarding.partner_id == partner_id)
    )
    onboarding = result.scalar_one_or_none()
    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found")

    stages = [
        OnboardingStage.profile_setup,
        OnboardingStage.capability_matrix,
        OnboardingStage.compliance_docs,
        OnboardingStage.certification_upload,
        OnboardingStage.review,
        OnboardingStage.completed,
    ]

    # Update checklist items for the stage
    if data.checklist_items:
        current_checklist = onboarding.checklist_items or {}
        current_checklist[data.stage.value] = data.checklist_items
        onboarding.checklist_items = current_checklist

    # Mark stage as completed
    completed_stages = onboarding.completed_stages or []
    if data.stage.value not in completed_stages:
        completed_stages.append(data.stage.value)
        onboarding.completed_stages = completed_stages

    # Advance to next stage
    current_idx = stages.index(data.stage)
    if current_idx < len(stages) - 1:
        next_stage = stages[current_idx + 1]
        onboarding.current_stage = next_stage.value

        # If reaching completed stage, mark completion
        if next_stage == OnboardingStage.completed:
            onboarding.completed_at = datetime.now(UTC)

            # Update partner status to active
            partner_result = await db.execute(
                select(PartnerProfile).where(PartnerProfile.id == partner_id)
            )
            partner = partner_result.scalar_one_or_none()
            if partner:
                partner.status = "active"

    await db.commit()
    await db.refresh(onboarding)

    # Reload with coordinator
    result = await db.execute(
        select(PartnerOnboarding)
        .options(selectinload(PartnerOnboarding.coordinator))
        .where(PartnerOnboarding.id == onboarding.id)
    )
    onboarding = result.scalar_one()

    completed_count = len(onboarding.completed_stages or [])
    progress_percentage = int((completed_count / len(stages)) * 100)

    return OnboardingResponse(
        id=onboarding.id,
        partner_id=onboarding.partner_id,
        current_stage=onboarding.current_stage,
        checklist_items=onboarding.checklist_items or {},
        completed_stages=onboarding.completed_stages or [],
        assigned_coordinator=onboarding.assigned_coordinator,
        coordinator_name=(
            f"{onboarding.coordinator.full_name}" if onboarding.coordinator else None
        ),
        started_at=onboarding.started_at,
        completed_at=onboarding.completed_at,
        created_at=onboarding.created_at,
        updated_at=onboarding.updated_at,
        progress_percentage=progress_percentage,
    )


@router.patch("/partners/{partner_id}/onboarding", response_model=OnboardingResponse)
async def update_onboarding(
    partner_id: UUID,
    data: OnboardingUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = require_coordinator_or_above,
):
    """Update onboarding progress."""
    result = await db.execute(
        select(PartnerOnboarding).where(PartnerOnboarding.partner_id == partner_id)
    )
    onboarding = result.scalar_one_or_none()
    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "current_stage" and hasattr(value, "value"):
            setattr(onboarding, field, value.value)
        else:
            setattr(onboarding, field, value)

    await db.commit()
    await db.refresh(onboarding)

    # Reload with coordinator
    result = await db.execute(
        select(PartnerOnboarding)
        .options(selectinload(PartnerOnboarding.coordinator))
        .where(PartnerOnboarding.id == onboarding.id)
    )
    onboarding = result.scalar_one()

    stages = ONBOARDING_STAGES
    completed_count = len(onboarding.completed_stages or [])
    progress_percentage = int((completed_count / len(stages)) * 100)

    return OnboardingResponse(
        id=onboarding.id,
        partner_id=onboarding.partner_id,
        current_stage=onboarding.current_stage,
        checklist_items=onboarding.checklist_items or {},
        completed_stages=onboarding.completed_stages or [],
        assigned_coordinator=onboarding.assigned_coordinator,
        coordinator_name=(
            f"{onboarding.coordinator.full_name}" if onboarding.coordinator else None
        ),
        started_at=onboarding.started_at,
        completed_at=onboarding.completed_at,
        created_at=onboarding.created_at,
        updated_at=onboarding.updated_at,
        progress_percentage=progress_percentage,
    )


# ============================================================================
# Full Capability Matrix
# ============================================================================


@router.get("/partners/{partner_id}/capability-matrix", response_model=CapabilityMatrixResponse)
async def get_capability_matrix(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = require_internal,
):
    """Get the full capability matrix for a partner."""
    # Get partner
    partner_result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.id == partner_id)
    )
    partner = partner_result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    # Get capabilities
    cap_result = await db.execute(
        select(PartnerCapability)
        .where(PartnerCapability.partner_id == partner_id)
        .order_by(PartnerCapability.capability_name)
    )
    capabilities = cap_result.scalars().all()

    # Get qualifications with categories
    qual_result = await db.execute(
        select(PartnerQualification)
        .options(selectinload(PartnerQualification.category))
        .where(PartnerQualification.partner_id == partner_id)
        .order_by(PartnerQualification.created_at.desc())
    )
    qualifications = qual_result.scalars().all()

    # Get certifications
    cert_result = await db.execute(
        select(PartnerCertification)
        .where(PartnerCertification.partner_id == partner_id)
        .order_by(PartnerCertification.created_at.desc())
    )
    certifications = cert_result.scalars().all()

    # Get onboarding
    onboard_result = await db.execute(
        select(PartnerOnboarding)
        .options(selectinload(PartnerOnboarding.coordinator))
        .where(PartnerOnboarding.partner_id == partner_id)
    )
    onboarding = onboard_result.scalar_one_or_none()

    # Build summaries
    capability_summary = {}
    for cap in capabilities:
        level = cap.proficiency_level
        capability_summary[level] = capability_summary.get(level, 0) + 1

    qualification_summary = {}
    for qual in qualifications:
        status = qual.approval_status
        qualification_summary[status] = qualification_summary.get(status, 0) + 1

    # Build responses
    cap_responses = [
        CapabilityResponse(
            id=c.id,
            partner_id=c.partner_id,
            capability_name=c.capability_name,
            proficiency_level=c.proficiency_level,
            years_experience=c.years_experience,
            verified=c.verified,
            verified_by=c.verified_by,
            verified_at=c.verified_at,
            notes=c.notes,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in capabilities
    ]

    qual_responses = [
        QualificationResponse(
            id=q.id,
            partner_id=q.partner_id,
            category_id=q.category_id,
            category_name=q.category.name if q.category else None,
            qualification_level=q.qualification_level,
            approval_status=q.approval_status,
            approved_by=q.approved_by,
            approved_at=q.approved_at,
            notes=q.notes,
            created_at=q.created_at,
            updated_at=q.updated_at,
        )
        for q in qualifications
    ]

    today = datetime.now(UTC).date()
    cert_responses = []
    for c in certifications:
        is_expired = c.expiry_date is not None and c.expiry_date < today
        is_expiring_soon = (
            c.expiry_date is not None
            and today <= c.expiry_date <= today + timedelta(days=30)
        )
        cert_responses.append(
            CertificationResponse(
                id=c.id,
                partner_id=c.partner_id,
                name=c.name,
                issuing_body=c.issuing_body,
                certificate_number=c.certificate_number,
                issue_date=c.issue_date,
                expiry_date=c.expiry_date,
                document_url=c.document_url,
                verification_status=c.verification_status,
                verified_by=c.verified_by,
                verified_at=c.verified_at,
                notes=c.notes,
                created_at=c.created_at,
                updated_at=c.updated_at,
                is_expired=is_expired,
                is_expiring_soon=is_expiring_soon,
            )
        )

    onboarding_response = None
    if onboarding:
        stages = ONBOARDING_STAGES
        completed_count = len(onboarding.completed_stages or [])
        progress_percentage = int((completed_count / len(stages)) * 100)

        onboarding_response = OnboardingResponse(
            id=onboarding.id,
            partner_id=onboarding.partner_id,
            current_stage=onboarding.current_stage,
            checklist_items=onboarding.checklist_items or {},
            completed_stages=onboarding.completed_stages or [],
            assigned_coordinator=onboarding.assigned_coordinator,
            coordinator_name=(
                f"{onboarding.coordinator.full_name}" if onboarding.coordinator else None
            ),
            started_at=onboarding.started_at,
            completed_at=onboarding.completed_at,
            created_at=onboarding.created_at,
            updated_at=onboarding.updated_at,
            progress_percentage=progress_percentage,
        )

    return CapabilityMatrixResponse(
        partner_id=partner.id,
        firm_name=partner.firm_name,
        capabilities=cap_responses,
        qualifications=qual_responses,
        certifications=cert_responses,
        onboarding=onboarding_response,
        capability_summary=capability_summary,
        qualification_summary=qualification_summary,
    )
