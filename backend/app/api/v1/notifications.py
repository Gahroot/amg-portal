"""Notification management endpoints."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response

from app.api.deps import DB, CurrentUser, require_internal
from app.core.exceptions import NotFoundException
from app.schemas.notification import (
    CreateNotificationRequest,
    GroupedNotificationsResponse,
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
    SnoozeRequest,
)
from app.services.notification_service import notification_service

router = APIRouter()

GroupMode = Literal["type", "entity", "time"]


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    db: DB,
    current_user: CurrentUser,
    unread_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    group_mode: GroupMode | None = Query(None),
) -> NotificationListResponse:
    """List notifications for current user.

    Args:
        group_mode: If provided, returns notifications grouped by the specified mode.
                   Options: 'type' (by notification type), 'entity' (by related entity),
                   'time' (by time period), or None for ungrouped list.
    """
    notifications, total = await notification_service.get_notifications_for_user(
        db,
        user_id=current_user.id,
        unread_only=unread_only,
        skip=skip,
        limit=limit,
    )

    response = NotificationListResponse(
        notifications=notifications,
        total=total,
        group_mode=group_mode,
    )

    # If grouping is requested, compute groups
    if group_mode:
        groups, total_groups, total_notifications = (
            await notification_service.get_grouped_notifications(
                db,
                user_id=current_user.id,
                group_mode=group_mode,
                unread_only=unread_only,
                skip=skip,
                limit=limit,
            )
        )
        response.groups = groups
        response.total = total_notifications

    return response


@router.get("/grouped", response_model=GroupedNotificationsResponse)
async def list_grouped_notifications(
    db: DB,
    current_user: CurrentUser,
    group_mode: GroupMode = Query("type"),
    unread_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> GroupedNotificationsResponse:
    """List notifications grouped by the specified mode."""
    groups, total_groups, total_notifications = (
        await notification_service.get_grouped_notifications(
            db,
            user_id=current_user.id,
            group_mode=group_mode,
            unread_only=unread_only,
            skip=skip,
            limit=limit,
        )
    )
    return GroupedNotificationsResponse(
        groups=groups,
        total_groups=total_groups,
        total_notifications=total_notifications,
        group_mode=group_mode,
    )


@router.post("/mark-all-read", status_code=204)
async def mark_all_read(
    db: DB,
    current_user: CurrentUser,
) -> None:
    """Mark all notifications as read for current user."""
    await notification_service.mark_all_read(db, current_user.id)


@router.post("/groups/{group_key:path}/mark-read")
async def mark_group_read(
    group_key: str,
    db: DB,
    current_user: CurrentUser,
    group_mode: GroupMode = Query("type"),
) -> dict[str, int]:
    """Mark all notifications in a group as read."""
    count = await notification_service.mark_group_read(
        db,
        current_user.id,
        group_key,
        group_mode,
    )
    return {"marked_read": count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> NotificationResponse:
    """Mark a specific notification as read."""
    notification = await notification_service.mark_read(
        db, notification_id, current_user.id
    )
    if not notification:
        raise NotFoundException("Notification not found")
    return notification


@router.get("/unread-count")
async def get_unread_count(
    db: DB,
    current_user: CurrentUser,
    grouped: bool = Query(False),
    group_mode: GroupMode = Query("type"),
) -> dict[str, int]:
    """Get unread notification count for current user.

    If grouped=true, returns the count of unique groups with unread notifications.
    This is useful for badge counts that should reflect grouped notifications.
    """
    if grouped:
        count = await notification_service.get_unique_group_count(
            db, current_user.id, group_mode
        )
    else:
        count = await notification_service.get_unread_count(db, current_user.id)
    return {"unread_count": count}


@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_preferences(
    db: DB,
    current_user: CurrentUser,
) -> NotificationPreferenceResponse:
    """Get notification preferences for current user."""
    prefs = await notification_service.get_or_create_preferences(db, current_user.id)
    return prefs


@router.patch("/preferences", response_model=NotificationPreferenceResponse)
async def update_preferences(
    data: NotificationPreferenceUpdate,
    db: DB,
    current_user: CurrentUser,
) -> NotificationPreferenceResponse:
    """Update notification preferences for current user."""
    prefs = await notification_service.update_preferences(
        db, current_user.id, update_data=data
    )
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
) -> NotificationResponse | Response:
    """Create a notification (admin/internal use).

    Returns 204 No Content when the notification is suppressed by the
    user's preference for that notification type (i.e. set to ``never``).
    """
    notification = await notification_service.create_notification(db, data)
    if notification is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return notification


# Snooze endpoints
@router.post("/{notification_id}/snooze", response_model=NotificationResponse)
async def snooze_notification(
    notification_id: uuid.UUID,
    data: SnoozeRequest,
    db: DB,
    current_user: CurrentUser,
) -> NotificationResponse:
    """Snooze a notification until a specified time.

    Options for snooze_duration_minutes:
    - 60: 1 hour
    - 240: 4 hours
    - 1440: Tomorrow morning (9 AM)
    - 1441: Tomorrow afternoon (2 PM)
    - 10080: Next week (Monday 9 AM)
    Or provide a custom snooze_until datetime.
    """
    # Get user's timezone from preferences
    prefs = await notification_service.get_or_create_preferences(db, current_user.id)
    user_timezone = prefs.timezone or "UTC"

    notification = await notification_service.snooze_notification(
        db,
        notification_id,
        current_user.id,
        data,
        user_timezone,
    )
    return notification


@router.delete("/{notification_id}/snooze", response_model=NotificationResponse)
async def unsnooze_notification(
    notification_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
) -> NotificationResponse:
    """Unsnooze a notification immediately."""
    notification = await notification_service.unsnooze_notification(
        db,
        notification_id,
        current_user.id,
    )
    return notification


@router.get("/snoozed", response_model=NotificationListResponse)
async def list_snoozed_notifications(
    db: DB,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> NotificationListResponse:
    """List all currently snoozed notifications for the current user."""
    notifications, total = await notification_service.get_snoozed_notifications(
        db,
        current_user.id,
        skip=skip,
        limit=limit,
    )
    return NotificationListResponse(
        notifications=notifications,
        total=total,
    )
