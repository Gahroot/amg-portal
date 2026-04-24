"""Email, push, and WebSocket realtime delivery helpers for notifications."""

import logging
import re
from typing import Any

from jinja2 import Environment, select_autoescape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationResponse

logger = logging.getLogger(__name__)


# Autoescape is on for string templates — every ``{{ value }}`` expansion is
# HTML-escaped, so notification titles/bodies/action labels that may include
# user-controlled text (program names, firm names, task titles) cannot break
# out of the surrounding markup.
_jinja_env = Environment(
    autoescape=select_autoescape(default=True, default_for_string=True),
)

_NOTIFICATION_EMAIL_TEMPLATE = _jinja_env.from_string(
    """<html><body>
<h2>{{ title }}</h2>
<p>{{ body }}</p>
{% if url %}<p><a href="{{ url }}">{{ label }}</a></p>{% endif %}
</body></html>"""
)

# Root-relative path only: must start with ``/`` but not ``//`` (which would be
# scheme-relative and jump origin), and must not contain a scheme delimiter
# before the first ``/`` (rules out ``javascript:``/``http:`` style payloads).
_SAFE_ACTION_URL: re.Pattern[str] = re.compile(r"^/(?!/)[^\s]*\Z")


def _safe_action_url(raw: str | None) -> str | None:
    """Return the full action URL iff ``raw`` is a root-relative path."""
    if not raw or not _SAFE_ACTION_URL.match(raw):
        return None
    return f"{settings.FRONTEND_URL}{raw}"


def render_notification_email_html(notification: Notification) -> str:
    """Render the single-notification email body with autoescape on.

    Shared by ``send_immediate_notification_email`` here and the legacy path
    on ``NotificationService``.  Keep this the ONLY place that turns a
    ``Notification`` into HTML — every other caller must go through it so
    autoescape coverage stays complete.
    """
    url = _safe_action_url(notification.action_url)
    return _NOTIFICATION_EMAIL_TEMPLATE.render(
        title=notification.title or "",
        body=notification.body or "",
        url=url,
        label=notification.action_label or "View in portal",
    )


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

    body_html = render_notification_email_html(notification)

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
    "render_notification_email_html",
    "send_immediate_notification_email",
    "send_realtime_notification",
]
