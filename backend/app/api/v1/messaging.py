"""Messaging digest preferences and preview endpoints."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter

from app.api.deps import DB, CurrentUser, RLSContext
from app.schemas.message_digest import (
    DigestPreviewResponse,
    MessageDigestPreferenceResponse,
    MessageDigestPreferenceUpdate,
)
from app.services.digest_service import (
    compile_digest,
    get_or_create_digest_preference,
    update_digest_preference,
)

router = APIRouter()


@router.get("/digest-preferences", response_model=MessageDigestPreferenceResponse)
async def get_digest_preferences(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    """Get the current user's message digest preferences."""
    pref = await get_or_create_digest_preference(db, current_user.id)
    return pref


@router.put("/digest-preferences", response_model=MessageDigestPreferenceResponse)
async def update_digest_preferences_endpoint(
    data: MessageDigestPreferenceUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    """Update the current user's message digest frequency."""
    pref = await update_digest_preference(db, current_user.id, data.digest_frequency)
    return pref


@router.post("/digest/preview", response_model=DigestPreviewResponse)
async def preview_digest(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    """Preview what the user's next message digest email would contain."""
    pref = await get_or_create_digest_preference(db, current_user.id)
    summaries = await compile_digest(db, current_user.id)
    return DigestPreviewResponse(
        user_id=str(current_user.id),
        unread_count=len(summaries),
        messages=summaries,
        period_start=pref.last_digest_sent_at,
        period_end=datetime.now(UTC),
    )
