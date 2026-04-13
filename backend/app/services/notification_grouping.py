"""Grouping helpers for notifications — SQL expressions and Python label logic."""

import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import String, case, func, literal, text
from sqlalchemy.sql.elements import ColumnElement

from app.models.notification import Notification
from app.schemas.notification import NotificationGroupResponse, NotificationResponse

# Priority order for determining highest priority in a group
PRIORITY_ORDER: dict[str, int] = {"urgent": 4, "high": 3, "normal": 2, "low": 1}

# Human-readable labels for notification types
NOTIFICATION_TYPE_LABELS: dict[str, str] = {
    "communication": "Communications",
    "decision_pending": "Pending Decisions",
    "assignment_update": "Assignment Updates",
    "deliverable_ready": "Deliverables Ready",
    "milestone_update": "Milestone Updates",
    "approval_required": "Approvals Required",
    "system": "System Notifications",
    "sla_warning": "SLA Warnings",
}


def _build_group_key_expr(group_mode: str) -> ColumnElement[Any]:
    """Build a SQL expression that computes the notification group key."""
    if group_mode == "entity":
        entity_id_text = func.cast(Notification.entity_id, String)
        return case(
            (
                (Notification.entity_type.is_not(None))
                & (Notification.entity_id.is_not(None)),
                literal("entity:") + Notification.entity_type + literal(":") + entity_id_text,
            ),
            else_=literal("type:") + Notification.notification_type,
        )
    elif group_mode == "time":
        now_expr = func.now()
        return case(
            (
                Notification.created_at >= now_expr - text("interval '1 hour'"),
                literal("time:Last hour"),
            ),
            (
                Notification.created_at >= now_expr - text("interval '24 hours'"),
                literal("time:Today"),
            ),
            (
                Notification.created_at >= now_expr - text("interval '48 hours'"),
                literal("time:Yesterday"),
            ),
            (
                Notification.created_at >= now_expr - text("interval '7 days'"),
                literal("time:This week"),
            ),
            (
                Notification.created_at >= now_expr - text("interval '30 days'"),
                literal("time:This month"),
            ),
            else_=literal("time:Older"),
        )
    else:
        return literal("type:") + Notification.notification_type


def get_time_group_label(created_at: datetime) -> str:
    """Get a human-readable label for time-based grouping."""
    now = datetime.now(UTC)
    diff = now - created_at

    if diff < timedelta(hours=1):
        return "Last hour"
    elif diff < timedelta(hours=24):
        return "Today"
    elif diff < timedelta(hours=48):
        return "Yesterday"
    elif diff < timedelta(days=7):
        return "This week"
    elif diff < timedelta(days=30):
        return "This month"
    else:
        return "Older"


def generate_group_key(
    notification_type: str,
    entity_type: str | None,
    entity_id: uuid.UUID | None,
) -> str:
    """Generate a group key string for a new notification.

    Prefers entity-based grouping when entity_type and entity_id are both set;
    falls back to type-based grouping otherwise.
    """
    if entity_type and entity_id:
        return f"entity:{entity_type}:{entity_id}"
    return f"type:{notification_type}"


def get_group_key_for_mode(notification: Notification, group_mode: str) -> str:
    """Get the grouping key for a notification based on the mode."""
    if group_mode == "entity":
        if notification.entity_type and notification.entity_id:
            return f"entity:{notification.entity_type}:{notification.entity_id}"
        return f"type:{notification.notification_type}"
    elif group_mode == "time":
        return f"time:{get_time_group_label(notification.created_at)}"
    else:  # Default to type grouping
        return f"type:{notification.notification_type}"


def get_group_label(
    group_key: str,
    latest_notification: Notification,
    group_mode: str,
) -> str:
    """Generate a human-readable label for a group."""
    if group_key.startswith("entity:"):
        entity_type = latest_notification.entity_type or "Item"
        return f"{entity_type.replace('_', ' ').title()}: {latest_notification.title}"
    elif group_key.startswith("time:"):
        return group_key.replace("time:", "")
    else:
        notif_type = latest_notification.notification_type
        return NOTIFICATION_TYPE_LABELS.get(notif_type, notif_type.replace("_", " ").title())


def create_group_response(
    group_key: str,
    notifications: list[Notification],
    group_mode: str,
) -> NotificationGroupResponse:
    """Create a NotificationGroupResponse from a list of notifications."""
    notifications.sort(key=lambda n: n.created_at, reverse=True)

    latest = notifications[0]
    count = len(notifications)
    unread_count = sum(1 for n in notifications if not n.is_read)
    is_read = unread_count == 0

    highest_priority = "low"
    for n in notifications:
        if PRIORITY_ORDER.get(n.priority, 0) > PRIORITY_ORDER.get(highest_priority, 0):
            highest_priority = n.priority

    group_label = get_group_label(group_key, latest, group_mode)

    return NotificationGroupResponse(
        group_key=group_key,
        group_label=group_label,
        notification_type=latest.notification_type,
        entity_type=latest.entity_type,
        entity_id=latest.entity_id,
        priority=highest_priority,
        count=count,
        unread_count=unread_count,
        is_read=is_read,
        latest_created_at=latest.created_at,
        latest_title=latest.title,
        latest_body=latest.body,
        action_url=latest.action_url,
        action_label=latest.action_label,
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
    )


def group_notifications(
    notifications: list[Notification],
    group_mode: str,
) -> list[NotificationGroupResponse]:
    """Group notifications by the specified mode."""
    groups_dict: dict[str, list[Notification]] = defaultdict(list)

    for notification in notifications:
        key = get_group_key_for_mode(notification, group_mode)
        groups_dict[key].append(notification)

    groups: list[NotificationGroupResponse] = []
    for gkey, group_notifs in groups_dict.items():
        group = create_group_response(gkey, group_notifs, group_mode)
        groups.append(group)

    groups.sort(key=lambda g: g.latest_created_at, reverse=True)
    return groups
