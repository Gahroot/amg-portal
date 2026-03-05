"""Notification management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import DB, CurrentUser, require_internal
from app.schemas.notification import (
    CreateNotificationRequest,
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
)
from app.services.notification_service import notification_service

router = APIRouter()


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    db: DB,
    current_user: CurrentUser,
    unread_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List notifications for current user."""
    notifications, total = await notification_service.get_notifications_for_user(
        db,
        user_id=current_user.id,
        unread_only=unread_only,
        skip=skip,
        limit=limit,
    )
    return NotificationListResponse(notifications=notifications, total=total)


@router.post("/mark-all-read", status_code=204)
async def mark_all_read(
    db: DB,
    current_user: CurrentUser,
):
    """Mark all notifications as read for current user."""
    await notification_service.mark_all_read(db, current_user.id)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Mark a specific notification as read."""
    notification = await notification_service.mark_read(db, notification_id, current_user.id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return notification


@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_preferences(
    db: DB,
    current_user: CurrentUser,
):
    """Get notification preferences for current user."""
    prefs = await notification_service.get_or_create_preferences(db, current_user.id)
    return prefs


@router.patch("/preferences", response_model=NotificationPreferenceResponse)
async def update_preferences(
    data: NotificationPreferenceUpdate,
    db: DB,
    current_user: CurrentUser,
):
    """Update notification preferences for current user."""
    prefs = await notification_service.update_preferences(db, current_user.id, update_data=data)
    return prefs


# Admin-only endpoint to create notifications for users
@router.post(
    "/",
    response_model=NotificationResponse,
    status_code=201,
    dependencies=[Depends(require_internal)],
)
async def create_notification(
    data: CreateNotificationRequest,
    db: DB,
):
    """Create a notification (admin/internal use)."""
    notification = await notification_service.create_notification(db, data)
    return notification
