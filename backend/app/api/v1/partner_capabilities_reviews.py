"""Capability review and verification endpoints: verify capabilities, approve qualifications."""

from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentUser,
    require_coordinator_or_above,
    require_internal,
    require_rm_or_above,
)
from app.core.exceptions import NotFoundException
from app.models.partner import PartnerProfile
from app.models.partner_capability import (
    PartnerCapability,
    PartnerCertification,
    PartnerOnboarding,
    PartnerQualification,
)
from app.schemas.partner_capability import (
    ApprovalStatus,
    CapabilityMatrixResponse,
    CapabilityResponse,
    CertificationResponse,
    CertificationVerification,
    OnboardingResponse,
    QualificationApproval,
    QualificationResponse,
)
from app.services.storage import storage_service

router = APIRouter()

ONBOARDING_STAGES = [
    "profile_setup",
    "capability_matrix",
    "compliance_docs",
    "certification_upload",
    "review",
    "completed",
]


def _build_certification_response(
    c: PartnerCertification, today: date
) -> CertificationResponse:
    is_expired = c.expiry_date is not None and c.expiry_date < today
    is_expiring_soon = (
        c.expiry_date is not None and today <= c.expiry_date <= today + timedelta(days=30)
    )
    return CertificationResponse(
        id=c.id,
        partner_id=c.partner_id,
        name=c.name,
        issuing_body=c.issuing_body,
        certificate_number=c.certificate_number,
        issue_date=c.issue_date,
        expiry_date=c.expiry_date,
        document_url=c.document_url,
        verification_status=c.verification_status,  # type: ignore[arg-type]
        verified_by=c.verified_by,
        verified_at=c.verified_at,
        notes=c.notes,
        created_at=c.created_at,
        updated_at=c.updated_at,
        is_expired=is_expired,
        is_expiring_soon=is_expiring_soon,
    )


@router.post(
    "/partners/{partner_id}/capabilities/{capability_id}/verify",
    response_model=CapabilityResponse,
    tags=["partner-capabilities"],
)
async def verify_partner_capability(
    partner_id: UUID,
    capability_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
) -> Any:
    """Verify a partner capability (RM or above only)."""
    result = await db.execute(
        select(PartnerCapability).where(
            PartnerCapability.id == capability_id,
            PartnerCapability.partner_id == partner_id,
        )
    )
    capability = result.scalar_one_or_none()
    if not capability:
        raise NotFoundException("Capability not found")

    capability.verified = True
    capability.verified_by = current_user.id
    capability.verified_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(capability)
    return capability


@router.patch(
    "/partners/{partner_id}/qualifications/{qualification_id}",
    response_model=QualificationResponse,
    tags=["partner-capabilities"],
)
async def approve_qualification(
    partner_id: UUID,
    qualification_id: UUID,
    data: QualificationApproval,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
) -> Any:
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
        raise NotFoundException("Qualification not found")

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


@router.post(
    "/partners/{partner_id}/certifications/{certification_id}/document",
    response_model=CertificationResponse,
    tags=["partner-capabilities"],
)
async def upload_certification_document(
    partner_id: UUID,
    certification_id: UUID,
    db: DB,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    _: None = Depends(require_coordinator_or_above),
) -> Any:
    """Upload a document for a certification."""
    result = await db.execute(
        select(PartnerCertification).where(
            PartnerCertification.id == certification_id,
            PartnerCertification.partner_id == partner_id,
        )
    )
    certification = result.scalar_one_or_none()
    if not certification:
        raise NotFoundException("Certification not found")

    object_path, _size = await storage_service.upload_file(
        file, f"partners/{partner_id}/certifications/{certification_id}"
    )
    certification.document_url = object_path
    await db.commit()
    await db.refresh(certification)

    return _build_certification_response(certification, datetime.now(UTC).date())


@router.post(
    "/partners/{partner_id}/certifications/{certification_id}/verify",
    response_model=CertificationResponse,
    tags=["partner-capabilities"],
)
async def verify_partner_certification(
    partner_id: UUID,
    certification_id: UUID,
    data: CertificationVerification,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
) -> Any:
    """Verify a partner certification (RM or above only)."""
    result = await db.execute(
        select(PartnerCertification).where(
            PartnerCertification.id == certification_id,
            PartnerCertification.partner_id == partner_id,
        )
    )
    certification = result.scalar_one_or_none()
    if not certification:
        raise NotFoundException("Certification not found")

    certification.verification_status = data.status.value
    certification.verified_by = current_user.id
    certification.verified_at = datetime.now(UTC)
    if data.notes:
        certification.notes = data.notes

    await db.commit()
    await db.refresh(certification)

    return _build_certification_response(certification, datetime.now(UTC).date())


@router.get(
    "/partners/{partner_id}/capability-matrix",
    response_model=CapabilityMatrixResponse,
    tags=["partner-capabilities"],
)
async def get_capability_matrix(
    partner_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> Any:
    """Get the full capability matrix for a partner."""
    partner_result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = partner_result.scalar_one_or_none()
    if not partner:
        raise NotFoundException("Partner not found")

    cap_result = await db.execute(
        select(PartnerCapability)
        .where(PartnerCapability.partner_id == partner_id)
        .order_by(PartnerCapability.capability_name)
    )
    capabilities = cap_result.scalars().all()

    qual_result = await db.execute(
        select(PartnerQualification)
        .options(selectinload(PartnerQualification.category))
        .where(PartnerQualification.partner_id == partner_id)
        .order_by(PartnerQualification.created_at.desc())
    )
    qualifications = qual_result.scalars().all()

    cert_result = await db.execute(
        select(PartnerCertification)
        .where(PartnerCertification.partner_id == partner_id)
        .order_by(PartnerCertification.created_at.desc())
    )
    certifications = cert_result.scalars().all()

    onboard_result = await db.execute(
        select(PartnerOnboarding)
        .options(selectinload(PartnerOnboarding.coordinator))
        .where(PartnerOnboarding.partner_id == partner_id)
    )
    onboarding = onboard_result.scalar_one_or_none()

    capability_summary: dict[str, int] = {}
    for cap in capabilities:
        level = cap.proficiency_level
        capability_summary[level] = capability_summary.get(level, 0) + 1

    qualification_summary: dict[str, int] = {}
    for qual in qualifications:
        q_status = qual.approval_status or "unknown"
        qualification_summary[q_status] = qualification_summary.get(q_status, 0) + 1

    cap_responses = [
        CapabilityResponse(
            id=c.id,
            partner_id=c.partner_id,
            capability_name=c.capability_name,
            proficiency_level=c.proficiency_level,
            years_experience=c.years_experience,  # type: ignore[arg-type]
            verified=c.verified,  # type: ignore[arg-type]
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
            approval_status=q.approval_status,  # type: ignore[arg-type]
            approved_by=q.approved_by,
            approved_at=q.approved_at,
            notes=q.notes,
            created_at=q.created_at,
            updated_at=q.updated_at,
        )
        for q in qualifications
    ]

    today = datetime.now(UTC).date()
    cert_responses = [_build_certification_response(c, today) for c in certifications]

    onboarding_response = None
    if onboarding:
        stages = ONBOARDING_STAGES
        completed_count = len(onboarding.completed_stages or [])
        progress_percentage = int((completed_count / len(stages)) * 100)

        onboarding_response = OnboardingResponse(
            id=onboarding.id,
            partner_id=onboarding.partner_id,
            current_stage=onboarding.current_stage,  # type: ignore[arg-type]
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
