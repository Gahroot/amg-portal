"""Auth endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import asc, select

from app.api.deps import DB, CurrentUser, MFASetupUser, require_step_up
from app.api.v1.auth_core import (
    _clear_mfa_setup_cookie,
    _issue_refresh_token,
    _set_auth_cookies,
)
from app.api.v1.auth_core import (
    router as auth_core_router,
)
from app.core.exceptions import (
    BadRequestException,
    NotFoundException,
)
from app.core.rate_limit import (
    rate_limit_mfa_disable,
)
from app.core.security import (
    create_access_token,
    decrypt_mfa_secret,
    encrypt_mfa_secret,
)
from app.models.bookmark import Bookmark
from app.models.notification_preference import NotificationPreference
from app.schemas.auth import (
    MFASetupResponse,
    MFAVerifyRequest,
    ProfileUpdateRequest,
    Token,
    UserNotificationPreferencesResponse,
    UserNotificationPreferencesUpdate,
    UserResponse,
)
from app.schemas.bookmark import (
    BookmarkCreate,
    BookmarkEntityType,
    BookmarkListResponse,
    BookmarkResponse,
)
from app.schemas.recent_item import (
    RecentItemCreate,
    RecentItemListResponse,
    RecentItemResponse,
    RecentItemType,
)
from app.services.mfa_service import (
    generate_backup_codes,
    generate_provisioning_uri,
    generate_qr_code_base64,
    generate_totp_secret,
    verify_totp,
)
from app.services.recent_item_service import RecentItemService

router = APIRouter()
router.include_router(auth_core_router)


# ── MFA endpoints ──────────────────────────────────────────


@router.post("/mfa/setup", response_model=MFASetupResponse)
async def mfa_setup(current_user: MFASetupUser, db: DB) -> Any:
    """Generate MFA secret, QR code, and backup codes.

    Accepts both a regular access token (authenticated users enabling MFA
    voluntarily) and an MFA setup token (users redirected here during login).
    """
    secret = generate_totp_secret()
    uri = generate_provisioning_uri(secret, current_user.email)
    qr_b64 = generate_qr_code_base64(uri)
    backup_codes = generate_backup_codes()

    # Store encrypted secret and backup codes but don't enable yet
    current_user.mfa_secret = encrypt_mfa_secret(secret)
    current_user.mfa_backup_codes = backup_codes
    await db.commit()

    return MFASetupResponse(
        secret=secret,
        provisioning_uri=uri,
        qr_code_base64=qr_b64,
        backup_codes=backup_codes,
    )


@router.post("/mfa/verify-setup", response_model=Token)
async def mfa_verify_setup(
    data: MFAVerifyRequest,
    current_user: MFASetupUser,
    db: DB,
    response: Response,
) -> Any:
    """Verify a TOTP code to confirm MFA setup.

    On success, enables MFA for the user and returns a full Token so that
    the client is immediately authenticated without a second login call.
    Accepts both regular access tokens and MFA setup tokens.
    """
    if not current_user.mfa_secret:
        raise BadRequestException("MFA setup not initiated")

    decrypted_secret = decrypt_mfa_secret(current_user.mfa_secret)
    if not verify_totp(decrypted_secret, data.code):
        raise BadRequestException("Invalid verification code")

    current_user.mfa_enabled = True

    token_data = {"sub": str(current_user.id), "email": current_user.email}
    access_token = create_access_token(token_data)
    refresh_token = await _issue_refresh_token(db, str(current_user.id), token_data)
    await db.commit()
    _set_auth_cookies(response, access_token, refresh_token, user_id=str(current_user.id))
    _clear_mfa_setup_cookie(response)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post(
    "/mfa/disable",
    dependencies=[
        Depends(rate_limit_mfa_disable),
        Depends(require_step_up("mfa_change")),
    ],
)
async def mfa_disable(data: MFAVerifyRequest, current_user: CurrentUser, db: DB) -> Any:
    """Disable MFA after verifying a TOTP code.

    Phase 2.11 — gated behind step-up (``action_scope=mfa_change``) on top of
    the existing TOTP verification, so a stolen access token alone cannot
    remove the second factor.
    """
    if not current_user.mfa_enabled or not current_user.mfa_secret:
        raise BadRequestException("MFA is not enabled")

    decrypted_secret = decrypt_mfa_secret(current_user.mfa_secret)
    if not verify_totp(decrypted_secret, data.code):
        raise BadRequestException("Invalid verification code")

    current_user.mfa_secret = None
    current_user.mfa_enabled = False
    current_user.mfa_backup_codes = None
    await db.commit()
    return {"message": "MFA disabled successfully"}


# ── Profile endpoints ───────────────────────────────────────


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdateRequest,
    current_user: CurrentUser,
    db: DB,
) -> Any:
    """Update current user's profile."""
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)
    return current_user


# ── Notification Preferences endpoints ───────────────────────


@router.get(
    "/preferences",
    response_model=UserNotificationPreferencesResponse,
)
async def get_notification_preferences(
    current_user: CurrentUser,
    db: DB,
) -> UserNotificationPreferencesResponse:
    """Get current user's notification preferences."""
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()

    if not pref:
        # Return defaults
        return UserNotificationPreferencesResponse(
            digest_enabled=True,
            digest_frequency="daily",
            notification_type_preferences=None,
            channel_preferences={"email": True, "in_portal": True, "push": True},
            quiet_hours_enabled=False,
            quiet_hours_start=None,
            quiet_hours_end=None,
            timezone="UTC",
            milestone_reminder_days=[7, 1],
            milestone_reminder_channels=["email", "in_app"],
            milestone_reminder_program_overrides=None,
        )

    return UserNotificationPreferencesResponse(
        digest_enabled=pref.digest_enabled,
        digest_frequency=pref.digest_frequency,
        notification_type_preferences=pref.notification_type_preferences,
        channel_preferences=pref.channel_preferences,
        quiet_hours_enabled=pref.quiet_hours_enabled,
        quiet_hours_start=(pref.quiet_hours_start.isoformat() if pref.quiet_hours_start else None),
        quiet_hours_end=(pref.quiet_hours_end.isoformat() if pref.quiet_hours_end else None),
        timezone=pref.timezone,
        milestone_reminder_days=pref.milestone_reminder_days or [7, 1],
        milestone_reminder_channels=pref.milestone_reminder_channels or ["email", "in_app"],
        milestone_reminder_program_overrides=pref.milestone_reminder_program_overrides,
    )


@router.patch(
    "/preferences",
    response_model=UserNotificationPreferencesResponse,
)
async def update_notification_preferences(
    data: UserNotificationPreferencesUpdate,
    current_user: CurrentUser,
    db: DB,
) -> UserNotificationPreferencesResponse:
    """Update current user's notification preferences."""
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()

    if not pref:
        pref = NotificationPreference(
            user_id=current_user.id,
            digest_enabled=True,
            digest_frequency="daily",
            channel_preferences={"email": True, "in_portal": True, "push": True},
            timezone="UTC",
        )
        db.add(pref)

    update_data = data.model_dump(exclude_unset=True)

    # Handle time fields
    if "quiet_hours_start" in update_data and update_data["quiet_hours_start"]:
        from datetime import time

        update_data["quiet_hours_start"] = time.fromisoformat(update_data["quiet_hours_start"])
    if "quiet_hours_end" in update_data and update_data["quiet_hours_end"]:
        from datetime import time

        update_data["quiet_hours_end"] = time.fromisoformat(update_data["quiet_hours_end"])

    for field, value in update_data.items():
        setattr(pref, field, value)

    await db.commit()
    await db.refresh(pref)

    return UserNotificationPreferencesResponse(
        digest_enabled=pref.digest_enabled,
        digest_frequency=pref.digest_frequency,
        notification_type_preferences=pref.notification_type_preferences,
        channel_preferences=pref.channel_preferences,
        quiet_hours_enabled=pref.quiet_hours_enabled,
        quiet_hours_start=(pref.quiet_hours_start.isoformat() if pref.quiet_hours_start else None),
        quiet_hours_end=(pref.quiet_hours_end.isoformat() if pref.quiet_hours_end else None),
        timezone=pref.timezone,
        milestone_reminder_days=pref.milestone_reminder_days or [7, 1],
        milestone_reminder_channels=pref.milestone_reminder_channels or ["email", "in_app"],
        milestone_reminder_program_overrides=pref.milestone_reminder_program_overrides,
    )


# ── Recent Items endpoints ───────────────────────────────────────


@router.get("/me/recent-items", response_model=RecentItemListResponse)
async def get_recent_items(
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(20, ge=1, le=50),
    item_type: RecentItemType | None = None,
) -> RecentItemListResponse:
    """Get the current user's recently viewed items."""
    service = RecentItemService(db)
    items = await service.get_recent_items(
        user_id=current_user.id,
        limit=limit,
        item_type=item_type,
    )
    return RecentItemListResponse(
        items=[RecentItemResponse.model_validate(item) for item in items],
        total=len(items),
    )


@router.post(
    "/me/recent-items",
    response_model=RecentItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_recent_item(
    data: RecentItemCreate,
    current_user: CurrentUser,
    db: DB,
) -> RecentItemResponse:
    """Record a view of an item (program, client, partner, or document)."""
    service = RecentItemService(db)
    item = await service.record_view(
        user_id=current_user.id,
        data=data,
    )
    return RecentItemResponse.model_validate(item)


@router.delete("/me/recent-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recent_item(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> None:
    """Delete a specific recent item."""
    service = RecentItemService(db)
    await service.delete_recent_item(user_id=current_user.id, item_id=item_id)


@router.delete("/me/recent-items", status_code=status.HTTP_204_NO_CONTENT)
async def clear_recent_items(
    current_user: CurrentUser,
    db: DB,
) -> None:
    """Clear all recent items for the current user."""
    service = RecentItemService(db)
    await service.clear_all_recent_items(user_id=current_user.id)


# ── Bookmark endpoints ───────────────────────────────────────


@router.get("/me/bookmarks", response_model=BookmarkListResponse)
async def list_bookmarks(
    current_user: CurrentUser,
    db: DB,
    entity_type: BookmarkEntityType | None = None,
) -> BookmarkListResponse:
    """Get all bookmarks for the current user, ordered by display_order."""
    query = select(Bookmark).where(Bookmark.user_id == current_user.id)
    if entity_type is not None:
        query = query.where(Bookmark.entity_type == entity_type.value)
    query = query.order_by(asc(Bookmark.display_order), asc(Bookmark.created_at))

    result = await db.execute(query)
    items = result.scalars().all()

    return BookmarkListResponse(
        items=[BookmarkResponse.model_validate(item) for item in items],
        total=len(items),
    )


@router.post(
    "/me/bookmarks",
    response_model=BookmarkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_bookmark(
    data: BookmarkCreate,
    current_user: CurrentUser,
    db: DB,
) -> BookmarkResponse:
    """Bookmark an entity. Returns existing bookmark if already bookmarked."""
    # Check if already exists
    existing = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id,
            Bookmark.entity_type == data.entity_type.value,
            Bookmark.entity_id == data.entity_id,
        )
    )
    bookmark = existing.scalar_one_or_none()
    if bookmark:
        return BookmarkResponse.model_validate(bookmark)

    # Assign display_order = current count so new items go at the end
    count_result = await db.execute(select(Bookmark).where(Bookmark.user_id == current_user.id))
    current_count = len(count_result.scalars().all())

    bookmark = Bookmark(
        user_id=current_user.id,
        entity_type=data.entity_type.value,
        entity_id=data.entity_id,
        entity_title=data.entity_title,
        entity_subtitle=data.entity_subtitle,
        display_order=current_count,
    )
    db.add(bookmark)
    await db.commit()
    await db.refresh(bookmark)
    return BookmarkResponse.model_validate(bookmark)


@router.delete(
    "/me/bookmarks/{entity_type}/{entity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_bookmark(
    entity_type: BookmarkEntityType,
    entity_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> None:
    """Remove a bookmark by entity type and entity ID."""
    result = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id,
            Bookmark.entity_type == entity_type.value,
            Bookmark.entity_id == entity_id,
        )
    )
    bookmark = result.scalar_one_or_none()
    if not bookmark:
        raise NotFoundException("Bookmark not found")

    await db.delete(bookmark)
    await db.commit()


# ── Onboarding Tour endpoints ────────────────────────────────────


VALID_TOUR_KEYS = {"dashboard", "portal", "partner"}


@router.post("/me/tours/{tour_key}/complete", response_model=UserResponse)
async def complete_tour(
    tour_key: str,
    current_user: CurrentUser,
    db: DB,
) -> UserResponse:
    """Mark an onboarding tour as completed for the current user."""
    if tour_key not in VALID_TOUR_KEYS:
        raise BadRequestException(f"Invalid tour key. Must be one of: {', '.join(VALID_TOUR_KEYS)}")

    existing = dict(current_user.onboarding_completed or {})
    existing[tour_key] = True
    current_user.onboarding_completed = existing

    await db.commit()
    await db.refresh(current_user)
    return current_user  # type: ignore[return-value]


@router.delete("/me/tours/{tour_key}/complete", status_code=status.HTTP_204_NO_CONTENT)
async def reset_tour(
    tour_key: str,
    current_user: CurrentUser,
    db: DB,
) -> None:
    """Reset a tour so it auto-starts on next visit (used for testing or re-onboarding)."""
    if tour_key not in VALID_TOUR_KEYS:
        raise BadRequestException(f"Invalid tour key. Must be one of: {', '.join(VALID_TOUR_KEYS)}")

    existing = dict(current_user.onboarding_completed or {})
    existing.pop(tour_key, None)
    current_user.onboarding_completed = existing

    await db.commit()
