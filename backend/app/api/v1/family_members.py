"""Family member management endpoints."""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from app.api.deps import DB, require_rm_or_above
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.client_profile import ClientProfile
from app.models.family_member import FamilyMember, FamilyRelationship
from app.schemas.family_member import (
    FamilyMemberCreate,
    FamilyMemberListResponse,
    FamilyMemberResponse,
    FamilyMemberUpdate,
    FamilyRelationshipCreate,
    FamilyRelationshipResponse,
)

router = APIRouter()


@router.get(
    "/clients/{profile_id}/family-members",
    response_model=FamilyMemberListResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def list_family_members(
    profile_id: uuid.UUID,
    db: DB,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    """List all family members for a client profile."""
    # Verify client profile exists
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == profile_id)
    )
    if not result.scalar_one_or_none():
        raise NotFoundException("Client profile not found")

    # Get family members
    result = await db.execute(
        select(FamilyMember)
        .where(FamilyMember.client_profile_id == profile_id)
        .order_by(FamilyMember.created_at)
        .offset(skip)
        .limit(limit)
    )
    family_members = result.scalars().all()

    # Get total count
    count_result = await db.execute(
        select(FamilyMember)
        .where(FamilyMember.client_profile_id == profile_id)
    )
    total = len(count_result.scalars().all())

    return FamilyMemberListResponse(family_members=family_members, total=total)  # type: ignore[arg-type]


@router.post(
    "/clients/{profile_id}/family-members",
    response_model=FamilyMemberResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_rm_or_above)],
)
async def create_family_member(
    profile_id: uuid.UUID,
    data: FamilyMemberCreate,
    db: DB,
) -> Any:
    """Create a new family member for a client profile."""
    # Verify client profile exists
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == profile_id)
    )
    if not result.scalar_one_or_none():
        raise NotFoundException("Client profile not found")

    family_member = FamilyMember(
        client_profile_id=profile_id,
        **data.model_dump(),
    )
    db.add(family_member)
    await db.commit()
    await db.refresh(family_member)
    return family_member


@router.patch(
    "/family-members/{member_id}",
    response_model=FamilyMemberResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_family_member(
    member_id: uuid.UUID,
    data: FamilyMemberUpdate,
    db: DB,
) -> Any:
    """Update a family member."""
    result = await db.execute(
        select(FamilyMember).where(FamilyMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise NotFoundException("Family member not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)

    await db.commit()
    await db.refresh(member)
    return member


@router.delete(
    "/family-members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    dependencies=[Depends(require_rm_or_above)],
)
async def delete_family_member(
    member_id: uuid.UUID,
    db: DB,
) -> None:
    """Delete a family member."""
    result = await db.execute(
        select(FamilyMember).where(FamilyMember.id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise NotFoundException("Family member not found")

    await db.delete(member)
    await db.commit()


@router.post(
    "/family-members/{from_member_id}/relationships",
    response_model=FamilyRelationshipResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_rm_or_above)],
)
async def create_relationship(
    from_member_id: uuid.UUID,
    data: FamilyRelationshipCreate,
    db: DB,
) -> Any:
    """Create a relationship between two family members."""
    # Verify from_member exists
    result = await db.execute(
        select(FamilyMember).where(FamilyMember.id == from_member_id)
    )
    from_member = result.scalar_one_or_none()
    if not from_member:
        raise NotFoundException("Source family member not found")

    # Verify to_member exists
    result = await db.execute(
        select(FamilyMember).where(FamilyMember.id == data.to_member_id)
    )
    to_member = result.scalar_one_or_none()
    if not to_member:
        raise NotFoundException("Target family member not found")

    # Verify both members belong to the same client profile
    if from_member.client_profile_id != to_member.client_profile_id:
        raise BadRequestException("Family members must belong to the same client profile")

    # Check if relationship already exists
    existing = await db.execute(
        select(FamilyRelationship).where(
            FamilyRelationship.from_member_id == from_member_id,
            FamilyRelationship.to_member_id == data.to_member_id,
        )
    )
    if existing.scalar_one_or_none():
        raise BadRequestException("Relationship already exists")

    relationship = FamilyRelationship(
        from_member_id=from_member_id,
        to_member_id=data.to_member_id,
        relationship_type=data.relationship_type,
    )
    db.add(relationship)
    await db.commit()
    await db.refresh(relationship)
    return relationship


@router.delete(
    "/family-members/relationships/{relationship_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    dependencies=[Depends(require_rm_or_above)],
)
async def delete_relationship(
    relationship_id: uuid.UUID,
    db: DB,
) -> None:
    """Delete a relationship between family members."""
    result = await db.execute(
        select(FamilyRelationship).where(FamilyRelationship.id == relationship_id)
    )
    relationship = result.scalar_one_or_none()
    if not relationship:
        raise NotFoundException("Relationship not found")

    await db.delete(relationship)
    await db.commit()
