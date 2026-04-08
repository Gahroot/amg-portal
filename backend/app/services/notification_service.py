"""Service for notification operations."""

import logging
import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from sqlalchemy import String, case, func, literal, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.core.config import settings
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.user import User
from app.schemas.notification import (
    CreateNotificationRequest,
    NotificationGroupResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
    SnoozeRequest,
)
from app.services.crud_base import CRUDBase
from app.services.push_service import push_service

logger = logging.getLogger(__name__)

# Priority order for determining highest priority in a group
PRIORITY_ORDER = {"urgent": 4, "high": 3, "normal": 2, "low": 1}


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

# Time-based grouping labels
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


class NotificationService(CRUDBase[Notification, CreateNotificationRequest, dict[str, Any]]):
    """Service for notification operations."""

    async def get_notifications_for_user(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        unread_only: bool = False,
        not_email_delivered: bool = False,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Notification], int]:
        """Get notifications for a user."""
        query = select(Notification).where(Notification.user_id == user_id)
        count_query = (
            select(func.count()).select_from(Notification).where(Notification.user_id == user_id)
        )

        if unread_only:
            query = query.where(Notification.is_read == False)  # noqa: E712
            count_query = count_query.where(Notification.is_read == False)  # noqa: E712

        if not_email_delivered:
            query = query.where(Notification.email_delivered == False)  # noqa: E712
            count_query = count_query.where(Notification.email_delivered == False)  # noqa: E712

        query = query.order_by(Notification.created_at.desc())
        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.offset(skip).limit(limit))
        notifications = list(result.scalars().all())
        return notifications, total

    async def get_unread_count(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        """Get unread notification count for a user."""
        count_query = (
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        )
        return (await db.execute(count_query)).scalar_one()

    async def mark_read(
        self,
        db: AsyncSession,
        notification_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Notification | None:
        """Mark a notification as read."""
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            return None
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(UTC)
            await db.commit()
            await db.refresh(notification)
        return notification

    async def mark_all_read(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        """Mark all notifications as read for a user."""
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
            .values(
                is_read=True,
                read_at=datetime.now(UTC),
            )
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount

    async def get_or_create_preferences(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> NotificationPreference:
        """Get or create notification preferences for a user."""
        result = await db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        prefs = result.scalar_one_or_none()
        if not prefs:
            prefs = NotificationPreference(
                user_id=user_id,
                digest_enabled=True,
                digest_frequency="daily",
                notification_type_preferences={},
                channel_preferences={"in_portal": True, "email": True, "push": True},
            )
            db.add(prefs)
            await db.commit()
            await db.refresh(prefs)
        return prefs

    async def update_preferences(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        update_data: NotificationPreferenceUpdate,
    ) -> NotificationPreference:
        """Update notification preferences for a user."""
        prefs = await self.get_or_create_preferences(db, user_id)
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(prefs, field, value)
        await db.commit()
        await db.refresh(prefs)
        return prefs

    async def create_notification(
        self,
        db: AsyncSession,
        data: CreateNotificationRequest,
    ) -> Notification | None:
        """Create a new notification respecting user preferences.

        Returns the created Notification, or None if the notification was
        suppressed because the user opted out of this notification type.

        Delivery logic based on per-type or global frequency preference:
        - ``never``    — skip creating the notification entirely
        - ``immediate``— create in-portal notification and send email immediately
        - ``daily`` / ``weekly`` — create in-portal only; digest job handles email

        Quiet hours handling:
        - In-portal notifications always appear immediately
        - Push and email are queued if user is in quiet hours (unless urgent)
        - Urgent notifications bypass quiet hours
        """
        # Fetch preferences before creating so we can gate on them
        prefs = await self.get_or_create_preferences(db, data.user_id)

        type_prefs: dict[str, Any] = prefs.notification_type_preferences or {}
        type_frequency: str | None = type_prefs.get(data.notification_type)

        # If the user has opted out of this notification type entirely, skip it
        effective_frequency: str = type_frequency or prefs.digest_frequency

        # Determine if notification is urgent (bypasses quiet hours)
        is_urgent = data.priority == "urgent"

        # Check if user is in quiet hours
        in_quiet_hours = push_service.is_in_quiet_hours(
            prefs.quiet_hours_enabled,
            prefs.quiet_hours_start,
            prefs.quiet_hours_end,
            prefs.timezone or "UTC",
        )

        # Should we queue push/email for later delivery when quiet hours end?
        should_queue = in_quiet_hours and not is_urgent

        # Generate group_key if not provided
        group_key = data.group_key
        if group_key is None:
            group_key = self._generate_group_key(
                data.notification_type,
                data.entity_type,
                data.entity_id,
            )

        # Create the in-portal notification (always appears immediately)
        notification = Notification(
            user_id=data.user_id,
            notification_type=data.notification_type,
            title=data.title,
            body=data.body,
            action_url=data.action_url,
            action_label=data.action_label,
            entity_type=data.entity_type,
            entity_id=data.entity_id,
            priority=data.priority,
            push_queued=should_queue,
            email_queued=should_queue,
            group_key=group_key,
        )
        db.add(notification)
        await db.flush()

        channel_prefs: dict[str, Any] = prefs.channel_preferences or {}

        # For immediate frequency, send email now and mark as delivered
        if effective_frequency == "immediate" and channel_prefs.get("email", True):
            # Check if we should queue the email
            if should_queue:
                notification.email_queued = True
            else:
                await self._send_immediate_notification_email(db, notification)
                notification.email_delivered = True

        await db.commit()
        await db.refresh(notification)

        # Generate deep link for mobile app
        deep_link = push_service.generate_deep_link(
            notification.entity_type,
            notification.entity_id,
        )

        # Send push notification (honours push channel preference and quiet hours internally)
        # Note: We pass preferences to push_service which returns early if in quiet hours
        sent_push = await push_service.send_push_notification(
            db,
            user_id=notification.user_id,
            title=notification.title,
            body=notification.body,
            data={
                "id": str(notification.id),
                "type": notification.notification_type,
                "action_url": notification.action_url,
                "deep_link": deep_link,
                "action_label": notification.action_label,
                "entity_type": notification.entity_type,
                "entity_id": str(notification.entity_id) if notification.entity_id else None,
                "priority": notification.priority,
            },
            preferences=prefs,
        )
        if sent_push:
            notification.push_queued = False

        # Broadcast real-time update via WebSocket (always immediate)
        await self._send_realtime_notification(notification)

        return notification

    def _generate_group_key(
        self,
        notification_type: str,
        entity_type: str | None,
        entity_id: uuid.UUID | None,
    ) -> str:
        """Generate a group key for a notification.

        Strategy:
        - If entity_type and entity_id are provided, group by entity
        - Otherwise, group by notification type
        """
        if entity_type and entity_id:
            return f"entity:{entity_type}:{entity_id}"
        return f"type:{notification_type}"

    async def get_grouped_notifications(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        group_mode: Literal["type", "entity", "time"] = "type",
        unread_only: bool = False,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[NotificationGroupResponse], int, int]:
        """Get notifications grouped by the specified mode.

        Uses SQL GROUP BY aggregation to compute group metadata, then fetches
        full notification rows only for the paginated groups — avoiding the
        previous pattern of pulling up to 200 rows into Python just to group them.

        Args:
            db: Database session
            user_id: User ID
            group_mode: How to group notifications ("type", "entity", or "time")
            unread_only: Whether to only include unread notifications
            skip: Pagination offset
            limit: Maximum number of groups to return

        Returns:
            Tuple of (groups, total_groups, total_notifications)
        """
        base_filter = [Notification.user_id == user_id]
        if unread_only:
            base_filter.append(Notification.is_read == False)  # noqa: E712

        group_key_expr = _build_group_key_expr(group_mode)

        # Aggregation query: one row per group with summary stats
        agg_query = (
            select(
                group_key_expr.label("group_key"),
                func.count().label("total_count"),
                func.sum(case((Notification.is_read == False, 1), else_=0)).label("unread_count"),  # noqa: E712
                func.max(Notification.created_at).label("latest_created_at"),
                # Highest priority via PRIORITY_ORDER mapping: urgent=4, high=3, normal=2, low=1
                func.max(
                    case(
                        (Notification.priority == "urgent", 4),
                        (Notification.priority == "high", 3),
                        (Notification.priority == "normal", 2),
                        else_=1,
                    )
                ).label("max_priority_rank"),
            )
            .where(*base_filter)
            .group_by(group_key_expr)
            .order_by(func.max(Notification.created_at).desc())
        )

        agg_rows = list((await db.execute(agg_query)).mappings().all())

        if not agg_rows:
            return [], 0, 0

        total_notifications: int = sum(r["total_count"] for r in agg_rows)
        total_groups = len(agg_rows)

        # Paginate groups
        page_agg_rows = agg_rows[skip : skip + limit]
        if not page_agg_rows:
            return [], total_groups, total_notifications

        page_group_keys = [r["group_key"] for r in page_agg_rows]

        # Fetch full notification rows only for the groups on this page
        rows_query = (
            select(Notification)
            .where(
                *base_filter,
                group_key_expr.in_(page_group_keys),
            )
            .order_by(Notification.created_at.desc())
        )
        page_notifications = list((await db.execute(rows_query)).scalars().all())

        # Build a lookup: group_key -> [Notification, ...]
        notifs_by_key: dict[str, list[Notification]] = defaultdict(list)
        for notif in page_notifications:
            key = self._get_group_key_for_mode(notif, group_mode)
            notifs_by_key[key].append(notif)

        # Rank int -> label
        priority_rank_to_label = {4: "urgent", 3: "high", 2: "normal", 1: "low"}

        groups: list[NotificationGroupResponse] = []
        for row in page_agg_rows:
            gkey = row["group_key"]
            group_notifs = notifs_by_key.get(gkey, [])
            # Rows are already ordered desc; latest is first
            latest = group_notifs[0] if group_notifs else None
            highest_priority = priority_rank_to_label.get(row["max_priority_rank"], "low")
            group_label = self._get_group_label(gkey, latest, group_mode) if latest else gkey

            groups.append(
                NotificationGroupResponse(
                    group_key=gkey,
                    group_label=group_label,
                    notification_type=latest.notification_type if latest else "",
                    entity_type=latest.entity_type if latest else None,
                    entity_id=latest.entity_id if latest else None,
                    priority=highest_priority,
                    count=row["total_count"],
                    unread_count=row["unread_count"],
                    is_read=row["unread_count"] == 0,
                    latest_created_at=row["latest_created_at"],
                    latest_title=latest.title if latest else "",
                    latest_body=latest.body if latest else "",
                    action_url=latest.action_url if latest else None,
                    action_label=latest.action_label if latest else None,
                    notifications=[NotificationResponse.model_validate(n) for n in group_notifs],
                )
            )

        return groups, total_groups, total_notifications

    def _group_notifications(
        self,
        notifications: list[Notification],
        group_mode: str,
    ) -> list[NotificationGroupResponse]:
        """Group notifications by the specified mode."""
        groups_dict: dict[str, list[Notification]] = defaultdict(list)

        for notification in notifications:
            key = self._get_group_key_for_mode(notification, group_mode)
            groups_dict[key].append(notification)

        # Convert to response objects
        groups: list[NotificationGroupResponse] = []
        for group_key, group_notifications in groups_dict.items():
            group = self._create_group_response(group_key, group_notifications, group_mode)
            groups.append(group)

        # Sort groups by latest notification date (most recent first)
        groups.sort(key=lambda g: g.latest_created_at, reverse=True)

        return groups

    def _get_group_key_for_mode(self, notification: Notification, group_mode: str) -> str:
        """Get the grouping key for a notification based on the mode."""
        if group_mode == "entity":
            if notification.entity_type and notification.entity_id:
                return f"entity:{notification.entity_type}:{notification.entity_id}"
            return f"type:{notification.notification_type}"
        elif group_mode == "time":
            return f"time:{get_time_group_label(notification.created_at)}"
        else:  # Default to type grouping
            return f"type:{notification.notification_type}"

    def _create_group_response(
        self,
        group_key: str,
        notifications: list[Notification],
        group_mode: str,
    ) -> NotificationGroupResponse:
        """Create a NotificationGroupResponse from a list of notifications."""
        # Sort notifications within group by created_at descending
        notifications.sort(key=lambda n: n.created_at, reverse=True)

        latest = notifications[0]
        count = len(notifications)
        unread_count = sum(1 for n in notifications if not n.is_read)
        is_read = unread_count == 0

        # Determine highest priority
        highest_priority = "low"
        for n in notifications:
            if PRIORITY_ORDER.get(n.priority, 0) > PRIORITY_ORDER.get(highest_priority, 0):
                highest_priority = n.priority

        # Generate human-readable label
        group_label = self._get_group_label(group_key, latest, group_mode)

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

    def _get_group_label(
        self,
        group_key: str,
        latest_notification: Notification,
        group_mode: str,
    ) -> str:
        """Generate a human-readable label for a group."""
        if group_key.startswith("entity:"):
            # Entity-based grouping - use entity info
            entity_type = latest_notification.entity_type or "Item"
            return f"{entity_type.replace('_', ' ').title()}: {latest_notification.title}"
        elif group_key.startswith("time:"):
            # Time-based grouping
            return group_key.replace("time:", "")
        else:
            # Type-based grouping
            notif_type = latest_notification.notification_type
            return NOTIFICATION_TYPE_LABELS.get(
                notif_type, notif_type.replace("_", " ").title()
            )

    async def mark_group_read(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        group_key: str,
        group_mode: str,
    ) -> int:
        """Mark all notifications in a group as read.

        Args:
            db: Database session
            user_id: User ID
            group_key: The group key to mark as read
            group_mode: The grouping mode used

        Returns:
            Number of notifications marked as read
        """
        # Build the query based on group mode
        query = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
            .values(is_read=True, read_at=datetime.now(UTC))
        )

        if group_mode == "entity" and group_key.startswith("entity:"):
            # Parse entity type and id from group key ("entity:<type>:<id>")
            parts = group_key.split(":")
            if len(parts) >= 3:
                entity_type = parts[1]
                entity_id = uuid.UUID(parts[2])
                query = query.where(
                    Notification.entity_type == entity_type,
                    Notification.entity_id == entity_id,
                )
            else:
                # Malformed key — do not mark anything to avoid mass-reads
                return 0
        elif group_mode == "time":
            # For time-based grouping, we need to filter by time ranges
            now = datetime.now(UTC)
            time_label = group_key.replace("time:", "")

            if time_label == "Last hour":
                cutoff = now - timedelta(hours=1)
            elif time_label == "Today":
                cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif time_label == "Yesterday":
                cutoff = now - timedelta(hours=48)
                query = query.where(Notification.created_at >= now - timedelta(hours=48))
                query = query.where(Notification.created_at < now - timedelta(hours=24))
                result = await db.execute(query.returning(Notification.id))
                await db.commit()
                return len(list(result))
            elif time_label == "This week":
                cutoff = now - timedelta(days=7)
            elif time_label == "This month":
                cutoff = now - timedelta(days=30)
            else:
                cutoff = now - timedelta(days=365)  # Older

            if time_label != "Yesterday":
                query = query.where(Notification.created_at >= cutoff)
        else:
            # Type-based grouping
            notif_type = group_key.replace("type:", "")
            query = query.where(Notification.notification_type == notif_type)

        result = await db.execute(query.returning(Notification.id))
        await db.commit()
        return len(list(result))

    async def get_unique_group_count(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        group_mode: str = "type",
    ) -> int:
        """Get count of unique groups with unread notifications.

        Uses a SQL COUNT(DISTINCT …) aggregation so no rows are fetched into
        Python — this is the query behind the notification-bell badge which is
        called on every window focus from the frontend.
        """
        base_filter = [
            Notification.user_id == user_id,
            Notification.is_read == False,  # noqa: E712
        ]

        group_key_expr = _build_group_key_expr(group_mode)

        count_query = (
            select(func.count(func.distinct(group_key_expr)))
            .where(*base_filter)
        )
        return (await db.execute(count_query)).scalar_one()

    async def _send_immediate_notification_email(
        self,
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

    async def _send_push_notification(
        self,
        db: AsyncSession,
        notification: Notification,
        prefs: NotificationPreference,
    ) -> None:
        """Send push notification for a new notification."""
        channel_prefs = prefs.channel_preferences or {}
        if not channel_prefs.get("push", True):
            return

        # Generate deep link for mobile app
        deep_link = push_service.generate_deep_link(
            notification.entity_type,
            notification.entity_id,
        )

        await push_service.send_push_notification(
            db,
            user_id=notification.user_id,
            title=notification.title,
            body=notification.body,
            data={
                "id": str(notification.id),
                "type": notification.notification_type,
                "action_url": notification.action_url,
                "deep_link": deep_link,
                "action_label": notification.action_label,
                "entity_type": notification.entity_type,
                "entity_id": str(notification.entity_id) if notification.entity_id else None,
                "priority": notification.priority,
            },
            preferences=prefs,
        )

    async def _send_realtime_notification(
        self,
        notification: Notification,
    ) -> None:
        """Broadcast notification via WebSocket for real-time updates."""
        # TODO: Implement WebSocket broadcast when real-time infrastructure is added
        logger.debug("Real-time notification %s broadcast (not implemented)", notification.id)

    async def send_digest(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> None:
        """Send email digest for a user based on their preferences.

        Only includes notifications that have not already been emailed (i.e.
        those not delivered via the ``immediate`` channel), regardless of
        whether the user has already read them in the portal.
        """
        # Get user preferences
        prefs = await self.get_or_create_preferences(db, user_id)

        if not prefs.digest_enabled or prefs.digest_frequency == "never":
            return

        # Only digest notifications that haven't been emailed yet.
        # Notifications sent with ``immediate`` frequency are already marked
        # email_delivered=True, so they are excluded here.
        notifications, _ = await self.get_notifications_for_user(
            db, user_id, not_email_delivered=True, limit=100
        )

        if not notifications:
            return

        # Send email digest
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user:
            notifications_data = [
                {
                    "id": str(n.id),
                    "notification_type": n.notification_type,
                    "title": n.title,
                }
                for n in notifications
            ]
            from app.services.email_service import send_notification_digest

            await send_notification_digest(
                email=user.email,
                notifications=notifications_data,
                portal_url=settings.FRONTEND_URL,
            )

        # Mark all digested notifications as email delivered
        for notif in notifications:
            notif.email_delivered = True

        await db.commit()

    async def process_queued_notifications(  # noqa: PLR0912, PLR0915
        self,
        db: AsyncSession,
        limit: int = 100,
    ) -> tuple[int, int]:
        """Process all queued notifications for delivery.

        This runs periodically (every 15 minutes by default) to check for any
        users with queued notifications and deliver them when they exit quiet hours.

        Args:
            db: Database session
            limit: Maximum number of notifications to process per batch

        Returns:
            Tuple with count of processed push, count of processed emails
        """
        # Get all queued notifications
        result = await db.execute(
            select(Notification)
            .where(
                or_(
                    Notification.push_queued == True,  # noqa: E712
                    Notification.email_queued == True,  # noqa: E712
                )
            )
            .limit(limit)
        )

        notifications = list(result.scalars().all())

        if not notifications:
            logger.info("No queued notifications found")
            return 0, 0

        # Group by user
        user_notifications: dict[uuid.UUID, list[Notification]] = {}
        for notification in notifications:
            user_id = notification.user_id
            if user_id not in user_notifications:
                user_notifications[user_id] = []
            user_notifications[user_id].append(notification)

        # Build a map of user_id -> prefs for batch processing
        user_prefs: dict[uuid.UUID, NotificationPreference] = {}
        for user_id in user_notifications:
            try:
                prefs = await self.get_or_create_preferences(db, user_id)
                if prefs is None:
                    continue
                user_prefs[user_id] = prefs
            except Exception:
                logger.exception("Failed to get preferences for user %s", user_id)
                continue

        processed_push = 0
        processed_email = 0
        skipped = 0

        # Process each user's notifications
        for user_id, user_notifs in user_notifications.items():
            user_pref = user_prefs.get(user_id)
            if user_pref is None:
                continue

            # Check if user is still in quiet hours
            in_quiet_hours = push_service.is_in_quiet_hours(
                user_pref.quiet_hours_enabled,
                user_pref.quiet_hours_start,
                user_pref.quiet_hours_end,
                user_pref.timezone or "UTC",
            )

            if in_quiet_hours:
                logger.debug(
                    "User %s still in quiet hours, skipping",
                    user_id,
                )
                skipped += len(user_notifs)
                continue

            # User is outside quiet hours - deliver queued notifications
            for notification in user_notifs:
                try:
                    channel_prefs = user_pref.channel_preferences or {}

                    # Send push notification if queued
                    if notification.push_queued and channel_prefs.get("push", True):
                        entity_id_str = (
                            str(notification.entity_id) if notification.entity_id else None
                        )
                        # Generate deep link for mobile app
                        deep_link = push_service.generate_deep_link(
                            notification.entity_type,
                            notification.entity_id,
                        )
                        sent_push = await push_service.send_push_notification(
                            db,
                            user_id=notification.user_id,
                            title=notification.title,
                            body=notification.body,
                            data={
                                "id": str(notification.id),
                                "type": notification.notification_type,
                                "action_url": notification.action_url,
                                "deep_link": deep_link,
                                "action_label": notification.action_label,
                                "entity_type": notification.entity_type,
                                "entity_id": entity_id_str,
                                "priority": notification.priority,
                            },
                            preferences=user_pref,
                        )
                        if sent_push:
                            notification.push_queued = False
                            processed_push += 1
                            logger.info(
                                "Push delivered for queued notification %s",
                                notification.id,
                            )

                    # Send email if queued
                    if notification.email_queued and channel_prefs.get("email", True):
                        await self._send_immediate_notification_email(db, notification)
                        notification.email_queued = False
                        notification.email_delivered = True
                        processed_email += 1
                        logger.info(
                            "Email delivered for queued notification %s",
                            notification.id,
                        )
                except Exception:
                    logger.exception(
                        "Failed to deliver queued notification %s",
                        notification.id,
                    )

            await db.commit()

        logger.info(
            "Processed queued: %d push, %d email, %d skipped (quiet hours)",
            processed_push,
            processed_email,
            skipped,
        )
        return processed_push, processed_email

    # Maximum number of times a notification can be snoozed
    MAX_SNOOZE_COUNT = 3

    def _calculate_snooze_until(
        self,
        snooze_duration_minutes: int | None,
        snooze_until: datetime | None,
        user_timezone: str = "UTC",
    ) -> datetime:
        """Calculate the snooze_until datetime based on duration or explicit time.

        Args:
            snooze_duration_minutes: Duration in minutes (e.g., 60 for 1 hour)
            snooze_until: Explicit datetime to snooze until
            user_timezone: User's timezone for relative calculations

        Returns:
            The calculated snooze_until datetime in UTC
        """
        now_utc = datetime.now(UTC)

        if snooze_until:
            # Use explicit datetime if provided
            return snooze_until

        if snooze_duration_minutes is None:
            # Default to 1 hour if nothing specified
            snooze_duration_minutes = 60

        # Predefined duration mappings for common presets
        # 60 = 1 hour, 240 = 4 hours
        if snooze_duration_minutes == 60:
            return now_utc + timedelta(hours=1)
        elif snooze_duration_minutes == 240:
            return now_utc + timedelta(hours=4)
        elif snooze_duration_minutes == 1440:  # Tomorrow morning (9 AM)
            # Calculate next 9 AM in user's timezone
            from zoneinfo import ZoneInfo

            tz = ZoneInfo(user_timezone)
            now_local = datetime.now(tz)
            tomorrow = now_local + timedelta(days=1)
            tomorrow_9am = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
            return tomorrow_9am.astimezone(UTC)
        elif snooze_duration_minutes == 1441:  # Tomorrow afternoon (2 PM)
            from zoneinfo import ZoneInfo

            tz = ZoneInfo(user_timezone)
            now_local = datetime.now(tz)
            tomorrow = now_local + timedelta(days=1)
            tomorrow_2pm = tomorrow.replace(hour=14, minute=0, second=0, microsecond=0)
            return tomorrow_2pm.astimezone(UTC)
        elif snooze_duration_minutes == 10080:  # Next week (Monday 9 AM)
            from zoneinfo import ZoneInfo

            tz = ZoneInfo(user_timezone)
            now_local = datetime.now(tz)
            # Find next Monday
            days_until_monday = (7 - now_local.weekday()) % 7
            if days_until_monday == 0:
                days_until_monday = 7  # If today is Monday, go to next Monday
            next_monday = now_local + timedelta(days=days_until_monday)
            next_monday_9am = next_monday.replace(hour=9, minute=0, second=0, microsecond=0)
            return next_monday_9am.astimezone(UTC)
        else:
            # Generic duration in minutes
            return now_utc + timedelta(minutes=snooze_duration_minutes)

    async def snooze_notification(
        self,
        db: AsyncSession,
        notification_id: uuid.UUID,
        user_id: uuid.UUID,
        snooze_request: SnoozeRequest,
        user_timezone: str = "UTC",
    ) -> Notification:
        """Snooze a notification until a specified time.

        Args:
            db: Database session
            notification_id: ID of the notification to snooze
            user_id: ID of the user who owns the notification
            snooze_request: Request containing snooze duration or explicit time
            user_timezone: User's timezone for relative calculations

        Returns:
            The updated notification

        Raises:
            NotFoundException: If notification doesn't exist
            ValueError: If max snooze count exceeded
        """
        # Fetch the notification
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            from app.core.exceptions import NotFoundException

            raise NotFoundException("Notification not found")

        # Check max snooze count
        if notification.snooze_count >= self.MAX_SNOOZE_COUNT:
            raise ValueError(
                f"Notification has been snoozed the maximum of {self.MAX_SNOOZE_COUNT} times"
            )

        # Calculate snooze_until time
        snooze_until = self._calculate_snooze_until(
            snooze_duration_minutes=snooze_request.snooze_duration_minutes,
            snooze_until=snooze_request.snooze_until,
            user_timezone=user_timezone,
        )

        # Update notification
        notification.snoozed_until = snooze_until
        notification.snooze_count += 1

        await db.commit()
        await db.refresh(notification)

        logger.info(
            "Snoozed notification %s until %s (count: %d)",
            notification_id,
            snooze_until,
            notification.snooze_count,
        )

        return notification

    async def unsnooze_notification(
        self,
        db: AsyncSession,
        notification_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Notification:
        """Unsnooze a notification immediately.

        Args:
            db: Database session
            notification_id: ID of the notification to unsnooze
            user_id: ID of the user who owns the notification

        Returns:
            The updated notification

        Raises:
            NotFoundException: If notification doesn't exist
        """
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            from app.core.exceptions import NotFoundException

            raise NotFoundException("Notification not found")

        notification.snoozed_until = None
        # Note: We don't reset snooze_count - it tracks total snoozes

        await db.commit()
        await db.refresh(notification)

        logger.info("Unsnoozed notification %s", notification_id)

        return notification

    async def get_snoozed_notifications(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Notification], int]:
        """Get all currently snoozed notifications for a user.

        Args:
            db: Database session
            user_id: User ID
            skip: Pagination offset
            limit: Maximum results

        Returns:
            Tuple of (snoozed notifications, total count)
        """
        now_utc = datetime.now(UTC)

        # Get notifications that are currently snoozed (snoozed_until is in the future)
        query = (
            select(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.snoozed_until.is_not(None),
                Notification.snoozed_until > now_utc,
            )
            .order_by(Notification.snoozed_until.asc())
        )

        count_query = (
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.snoozed_until.is_not(None),
                Notification.snoozed_until > now_utc,
            )
        )

        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.offset(skip).limit(limit))
        notifications = list(result.scalars().all())

        return notifications, total

    async def process_expired_snoozes(
        self,
        db: AsyncSession,
        limit: int = 100,
    ) -> int:
        """Process notifications whose snooze period has expired.

        This should be called periodically by a background job to unsnooze
        notifications that have reached their snooze_until time.

        Args:
            db: Database session
            limit: Maximum notifications to process per batch

        Returns:
            Number of notifications unsnoozed
        """
        now_utc = datetime.now(UTC)

        # Find notifications where snooze has expired
        result = await db.execute(
            select(Notification)
            .where(
                Notification.snoozed_until.is_not(None),
                Notification.snoozed_until <= now_utc,
            )
            .limit(limit)
        )

        notifications = list(result.scalars().all())
        unsnoozed_count = 0

        for notification in notifications:
            notification.snoozed_until = None
            unsnoozed_count += 1
            logger.info(
                "Auto-unsnoozed notification %s for user %s",
                notification.id,
                notification.user_id,
            )

        if notifications:
            await db.commit()

        return unsnoozed_count


notification_service = NotificationService(Notification)
