"""Client communication preferences API endpoints."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, require_internal, require_rm_or_above
from app.core.exceptions import NotFoundException
from app.models.client_profile import ClientProfile
from app.schemas.client_preferences import (
    CommunicationPreferencesResponse,
    CommunicationPreferencesUpdate,
)
from app.services.communication_audit_service import enforce_client_preferences

router = APIRouter()


@router.get(
    "/{client_id}/communication-preferences",
    response_model=CommunicationPreferencesResponse,
    dependencies=[Depends(require_internal)],
)
async def get_communication_preferences(
    client_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> CommunicationPreferencesResponse:
    """Get communication preferences for a client."""
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == client_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Client profile not found")
    return CommunicationPreferencesResponse(
        preferred_channels=profile.preferred_channels,
        contact_hours_start=profile.contact_hours_start,
        contact_hours_end=profile.contact_hours_end,
        contact_timezone=profile.contact_timezone,
        language_preference=profile.language_preference,
        do_not_contact=profile.do_not_contact,
        opt_out_marketing=profile.opt_out_marketing,
        communication_preference=profile.communication_preference,
        special_instructions=profile.special_instructions,
    )


@router.put(
    "/{client_id}/communication-preferences",
    response_model=CommunicationPreferencesResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_communication_preferences(
    client_id: uuid.UUID,
    body: CommunicationPreferencesUpdate,
    db: DB,
    current_user: CurrentUser,
) -> CommunicationPreferencesResponse:
    """Update communication preferences for a client."""
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == client_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Client profile not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    return CommunicationPreferencesResponse(
        preferred_channels=profile.preferred_channels,
        contact_hours_start=profile.contact_hours_start,
        contact_hours_end=profile.contact_hours_end,
        contact_timezone=profile.contact_timezone,
        language_preference=profile.language_preference,
        do_not_contact=profile.do_not_contact,
        opt_out_marketing=profile.opt_out_marketing,
        communication_preference=profile.communication_preference,
        special_instructions=profile.special_instructions,
    )


@router.get(
    "/{client_id}/communication-preferences/check",
    dependencies=[Depends(require_internal)],
)
async def check_channel_allowed(
    client_id: uuid.UUID,
    channel: str,
    db: DB,
    current_user: CurrentUser,
) -> dict[str, object]:
    """Check if a specific communication channel is allowed for a client."""
    allowed, reason = await enforce_client_preferences(db, client_id, channel)
    return {"allowed": allowed, "reason": reason}
