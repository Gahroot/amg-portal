"""Client intake form endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, CurrentUser, require_rm_or_above
from app.models.client_profile import ClientProfile
from app.models.enums import ApprovalStatus, ComplianceStatus
from app.models.family_member import FamilyMember
from app.schemas.intake_form import (
    IntakeDraftData,
    IntakeFormData,
    IntakeFormResponse,
    IntakeStep4Lifestyle,
)

router = APIRouter()


def _extract_lifestyle_from_intel(intel: dict[str, Any] | None) -> IntakeStep4Lifestyle | None:
    """Extract lifestyle data from intelligence file."""
    if not intel or "lifestyle" not in intel:
        return None
    lifestyle = intel.get("lifestyle", {})
    return IntakeStep4Lifestyle(
        travel_preferences=lifestyle.get("travel_preferences"),
        dietary_restrictions=lifestyle.get("dietary_restrictions"),
        interests=lifestyle.get("interests"),
        preferred_destinations=lifestyle.get("preferred_destinations"),
        language_preference=lifestyle.get("language_preference"),
    )


def _build_intelligence_file(data: IntakeFormData) -> dict[str, Any]:
    """Build intelligence file from intake data."""
    return {
        "lifestyle": {
            "travel_preferences": data.travel_preferences,
            "dietary_restrictions": data.dietary_restrictions,
            "interests": data.interests,
            "preferred_destinations": data.preferred_destinations or [],
            "language_preference": data.language_preference,
        },
    }


async def _create_family_members(
    db: AsyncSession,
    profile_id: uuid.UUID,
    family_members: list[Any],
) -> list[FamilyMember]:
    """Create family members for a profile."""
    created = []
    for fm_data in family_members:
        member = FamilyMember(
            client_profile_id=profile_id,
            name=fm_data.name,
            relationship_type=fm_data.relationship_type,
            date_of_birth=fm_data.date_of_birth,
            occupation=fm_data.occupation,
            notes=fm_data.notes,
            is_primary_contact=fm_data.is_primary_contact,
        )
        db.add(member)
        created.append(member)

    if created:
        await db.flush()
        for member in created:
            await db.refresh(member)

    return created


@router.post(
    "/intake",
    response_model=IntakeFormResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_rm_or_above)],
)
async def submit_intake_form(
    data: IntakeFormData,
    db: DB,
    current_user: CurrentUser,
):
    """Submit a complete client intake form."""
    # Check for existing client with same email
    existing = await db.execute(
        select(ClientProfile).where(ClientProfile.primary_email == data.primary_email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A client with this email already exists",
        )

    # Build intelligence file with lifestyle data
    intelligence_file = _build_intelligence_file(data)

    # Create client profile
    profile = ClientProfile(
        legal_name=data.legal_name,
        display_name=data.display_name,
        entity_type=data.entity_type,
        jurisdiction=data.jurisdiction,
        tax_id=data.tax_id,
        primary_email=data.primary_email,
        secondary_email=data.secondary_email,
        phone=data.phone,
        address=data.address,
        communication_preference=data.communication_preference,
        sensitivities=data.sensitivities,
        special_instructions=data.special_instructions,
        intelligence_file=intelligence_file,
        created_by=current_user.id,
        compliance_status=ComplianceStatus.pending_review.value,
        approval_status=ApprovalStatus.pending_compliance.value,
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)

    # Create family members if provided
    family_members = []
    if data.family_members:
        family_members = await _create_family_members(
            db, profile.id, data.family_members
        )

    await db.commit()
    await db.refresh(profile)

    return IntakeFormResponse(
        id=profile.id,
        legal_name=profile.legal_name,
        display_name=profile.display_name,
        entity_type=profile.entity_type,
        jurisdiction=profile.jurisdiction,
        tax_id=profile.tax_id,
        primary_email=profile.primary_email,
        secondary_email=profile.secondary_email,
        phone=profile.phone,
        address=profile.address,
        communication_preference=profile.communication_preference,
        sensitivities=profile.sensitivities,
        special_instructions=profile.special_instructions,
        compliance_status=profile.compliance_status,
        approval_status=profile.approval_status,
        intelligence_file=profile.intelligence_file,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
        family_members=family_members,
        lifestyle=_extract_lifestyle_from_intel(profile.intelligence_file),
    )


@router.get(
    "/intake/{profile_id}/draft",
    response_model=IntakeFormResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def get_draft_intake(
    profile_id: uuid.UUID,
    db: DB,
):
    """Get draft intake data for a client profile."""
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )

    # Get family members
    fm_result = await db.execute(
        select(FamilyMember)
        .where(FamilyMember.client_profile_id == profile_id)
        .order_by(FamilyMember.created_at)
    )
    family_members = fm_result.scalars().all()

    return IntakeFormResponse(
        id=profile.id,
        legal_name=profile.legal_name,
        display_name=profile.display_name,
        entity_type=profile.entity_type,
        jurisdiction=profile.jurisdiction,
        tax_id=profile.tax_id,
        primary_email=profile.primary_email,
        secondary_email=profile.secondary_email,
        phone=profile.phone,
        address=profile.address,
        communication_preference=profile.communication_preference,
        sensitivities=profile.sensitivities,
        special_instructions=profile.special_instructions,
        compliance_status=profile.compliance_status,
        approval_status=profile.approval_status,
        intelligence_file=profile.intelligence_file,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
        family_members=list(family_members),
        lifestyle=_extract_lifestyle_from_intel(profile.intelligence_file),
    )


@router.patch(
    "/intake/{profile_id}/step/{step}",
    response_model=IntakeFormResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def save_intake_step(
    profile_id: uuid.UUID,
    step: int,
    data: IntakeDraftData,
    db: DB,
):
    """Save a specific step of the intake form."""
    if step < 1 or step > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Step must be between 1 and 5",
        )

    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )

    update_data = data.model_dump(exclude_unset=True, exclude={"family_members"})

    # Handle lifestyle data (step 4) separately
    if step == 4:
        intel = profile.intelligence_file or {}
        intel["lifestyle"] = intel.get("lifestyle", {})
        if data.travel_preferences is not None:
            intel["lifestyle"]["travel_preferences"] = data.travel_preferences
        if data.dietary_restrictions is not None:
            intel["lifestyle"]["dietary_restrictions"] = data.dietary_restrictions
        if data.interests is not None:
            intel["lifestyle"]["interests"] = data.interests
        if data.preferred_destinations is not None:
            intel["lifestyle"]["preferred_destinations"] = data.preferred_destinations
        if data.language_preference is not None:
            intel["lifestyle"]["language_preference"] = data.language_preference
        profile.intelligence_file = intel
        # Remove lifestyle fields from update_data to avoid direct assignment
        for field in ["travel_preferences", "dietary_restrictions", "interests",
                       "preferred_destinations", "language_preference"]:
            update_data.pop(field, None)

    # Update profile fields
    for field, value in update_data.items():
        setattr(profile, field, value)

    # Handle family members (step 5)
    if step == 5 and data.family_members is not None:
        # Delete existing family members
        existing_fms = await db.execute(
            select(FamilyMember).where(FamilyMember.client_profile_id == profile_id)
        )
        for fm in existing_fms.scalars().all():
            await db.delete(fm)

        # Create new family members
        await _create_family_members(db, profile_id, data.family_members)

    await db.commit()
    await db.refresh(profile)

    # Get updated family members
    fm_result = await db.execute(
        select(FamilyMember)
        .where(FamilyMember.client_profile_id == profile_id)
        .order_by(FamilyMember.created_at)
    )
    family_members = fm_result.scalars().all()

    return IntakeFormResponse(
        id=profile.id,
        legal_name=profile.legal_name,
        display_name=profile.display_name,
        entity_type=profile.entity_type,
        jurisdiction=profile.jurisdiction,
        tax_id=profile.tax_id,
        primary_email=profile.primary_email,
        secondary_email=profile.secondary_email,
        phone=profile.phone,
        address=profile.address,
        communication_preference=profile.communication_preference,
        sensitivities=profile.sensitivities,
        special_instructions=profile.special_instructions,
        compliance_status=profile.compliance_status,
        approval_status=profile.approval_status,
        intelligence_file=profile.intelligence_file,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
        family_members=list(family_members),
        lifestyle=_extract_lifestyle_from_intel(profile.intelligence_file),
    )


@router.post(
    "/intake/{profile_id}/submit",
    response_model=IntakeFormResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def submit_completed_intake(
    profile_id: uuid.UUID,
    db: DB,
):
    """Submit a completed intake form for compliance review."""
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )

    if profile.approval_status != ApprovalStatus.draft.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Intake form already submitted",
        )

    # Update status to pending compliance
    profile.approval_status = ApprovalStatus.pending_compliance.value
    profile.compliance_status = ComplianceStatus.pending_review.value

    await db.commit()
    await db.refresh(profile)

    # Get family members
    fm_result = await db.execute(
        select(FamilyMember)
        .where(FamilyMember.client_profile_id == profile_id)
        .order_by(FamilyMember.created_at)
    )
    family_members = fm_result.scalars().all()

    return IntakeFormResponse(
        id=profile.id,
        legal_name=profile.legal_name,
        display_name=profile.display_name,
        entity_type=profile.entity_type,
        jurisdiction=profile.jurisdiction,
        tax_id=profile.tax_id,
        primary_email=profile.primary_email,
        secondary_email=profile.secondary_email,
        phone=profile.phone,
        address=profile.address,
        communication_preference=profile.communication_preference,
        sensitivities=profile.sensitivities,
        special_instructions=profile.special_instructions,
        compliance_status=profile.compliance_status,
        approval_status=profile.approval_status,
        intelligence_file=profile.intelligence_file,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
        family_members=list(family_members),
        lifestyle=_extract_lifestyle_from_intel(profile.intelligence_file),
    )
