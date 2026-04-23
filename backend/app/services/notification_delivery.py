"""Email, push, and WebSocket realtime delivery helpers for notifications."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationResponse

logger = logging.getLogger(__name__)


def build_push_data(notification: Notification, deep_link: str | None) -> dict[str, Any]:
    """Build the push notification data payload for a notification."""
    return {
        "id": str(notification.id),
        "type": notification.notification_type,
        "action_url": notification.action_url,
        "deep_link": deep_link,
        "action_label": notification.action_label,
        "entity_type": notification.entity_type,
        "entity_id": str(notification.entity_id) if notification.entity_id else None,
        "priority": notification.priority,
    }


async def send_immediate_notification_email(
    db: AsyncSession,
    notification: Notification,
) -> None:
    """Send an immediate email for a single notification."""
    from app.services.email_service import send_email

    user_result = await db.execute(select(User).where(User.id == notification.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        return

    action_html = ""
    if notification.action_url:
        label = notification.action_label or "View in portal"
        url = f"{settings.FRONTEND_URL}{notification.action_url}"
        action_html = f'<p><a href="{url}">{label}</a></p>'

    body_html = (
        "<html><body>"
        f"<h2>{notification.title}</h2>"
        f"<p>{notification.body}</p>"
        f"{action_html}"
        "</body></html>"
    )

    try:
        await send_email(
            to=user.email,
            subject=notification.title,
            body_html=body_html,
            body_text=notification.body,
        )
    except Exception:
        logger.exception(
            "Failed to send immediate email for notification %s",
            notification.id,
        )


async def send_realtime_notification(
    notification: Notification,
) -> None:
    """Broadcast notification via WebSocket for real-time updates."""
    from app.api.ws_connection import connection_manager

    try:
        payload = NotificationResponse.model_validate(notification).model_dump(mode="json")
        await connection_manager.broadcast_notification(
            user_id=notification.user_id,
            notification=payload,
        )
    except Exception:
        logger.exception(
            "Failed to broadcast realtime notification %s",
            notification.id,
        )


__all__ = [
    "build_push_data",
    "send_immediate_notification_email",
    "send_realtime_notification",
]
