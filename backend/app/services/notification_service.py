"""Service for notification operations.

Grouping logic lives in ``notification_grouping``.
Preference and snooze logic lives in ``notification_preferences``.
Email/push/WebSocket delivery lives in ``notification_delivery``.
Digest and queued processing live in ``notification_queuing_digest``.
"""

import logging
import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.schemas.notification import (
    CreateNotificationRequest,
    NotificationGroupResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
    SnoozeRequest,
)
from app.services.crud_base import CRUDBase
from app.services.notification_delivery import (
    build_push_data,
)
from app.services.notification_delivery import (
    send_immediate_notification_email as _send_immediate_email_fn,
)
from app.services.notification_delivery import (
    send_realtime_notification as _send_realtime_fn,
)
from app.services.notification_grouping import (
    _build_group_key_expr,
    generate_group_key,
    get_group_key_for_mode,
    get_group_label,
)
from app.services.notification_preferences import (
    get_or_create_preferences,
    get_snoozed_notifications,
    process_expired_snoozes,
    update_preferences,
)
from app.services.notification_preferences import (
    snooze_notification as _snooze_notification,
)
from app.services.notification_preferences import (
    unsnooze_notification as _unsnooze_notification,
)
from app.services.notification_queuing_digest import (
    process_queued_notifications as _process_queued_fn,
)
from app.services.notification_queuing_digest import (
    send_digest as _send_digest_fn,
)
from app.services.push_service import push_service

logger = logging.getLogger(__name__)


class NotificationService(CRUDBase[Notification, CreateNotificationRequest, dict[str, Any]]):
    """Service for notification operations."""

    # ------------------------------------------------------------------ #
    # Preference helpers — delegate to notification_preferences module     #
    # ------------------------------------------------------------------ #

    async def get_or_create_preferences(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> NotificationPreference:
        """Get or create notification preferences for a user."""
        return await get_or_create_preferences(db, user_id)

    async def update_preferences(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        update_data: NotificationPreferenceUpdate,
    ) -> NotificationPreference:
        """Update notification preferences for a user."""
        return await update_preferences(db, user_id, update_data)

    # ------------------------------------------------------------------ #
    # Basic notification CRUD                                              #
    # ------------------------------------------------------------------ #

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
        return int(result.rowcount)  # type: ignore[attr-defined]

    # ------------------------------------------------------------------ #
    # Notification creation & delivery                                     #
    # ------------------------------------------------------------------ #

    async def create_notification(
        self,
        db: AsyncSession,
        data: CreateNotificationRequest,
    ) -> Notification:
        """Create a new notification respecting user preferences.

        Delivery logic based on per-type or global frequency preference:
        - ``immediate``— create in-portal notification and send email immediately
        - ``daily`` / ``weekly`` — create in-portal only; digest job handles email

        Quiet hours handling:
        - In-portal notifications always appear immediately
        - Push and email are queued if user is in quiet hours (unless urgent)
        - Urgent notifications bypass quiet hours
        """
        prefs = await self.get_or_create_preferences(db, data.user_id)

        type_prefs: dict[str, Any] = prefs.notification_type_preferences or {}
        type_frequency: str | None = type_prefs.get(data.notification_type)
        effective_frequency: str = type_frequency or prefs.digest_frequency

        is_urgent = data.priority == "urgent"
        in_quiet_hours = push_service.is_in_quiet_hours(
            prefs.quiet_hours_enabled,
            prefs.quiet_hours_start,
            prefs.quiet_hours_end,
            prefs.timezone or "UTC",
        )
        should_queue = in_quiet_hours and not is_urgent

        group_key = data.group_key or generate_group_key(
            data.notification_type,
            data.entity_type,
            data.entity_id,
        )

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

        if effective_frequency == "immediate" and channel_prefs.get("email", True):
            if should_queue:
                notification.email_queued = True
            else:
                await self._send_immediate_notification_email(db, notification)
                notification.email_delivered = True

        await db.commit()
        await db.refresh(notification)

        deep_link = push_service.generate_deep_link(
            notification.entity_type,
            notification.entity_id,
        )

        sent_push = await push_service.send_push_notification(
            db,
            user_id=notification.user_id,
            title=notification.title,
            body=notification.body,
            data=build_push_data(notification, deep_link),
            preferences=prefs,
        )
        if sent_push:
            notification.push_queued = False

        await self._send_realtime_notification(notification)

        return notification

    # ------------------------------------------------------------------ #
    # Grouping — delegate to notification_grouping module                 #
    # ------------------------------------------------------------------ #

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

        agg_query = (
            select(
                group_key_expr.label("group_key"),
                func.count().label("total_count"),
                func.sum(case((Notification.is_read == False, 1), else_=0)).label("unread_count"),  # noqa: E712
                func.max(Notification.created_at).label("latest_created_at"),
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

        page_agg_rows = agg_rows[skip : skip + limit]
        if not page_agg_rows:
            return [], total_groups, total_notifications

        page_group_keys = [r["group_key"] for r in page_agg_rows]

        rows_query = (
            select(Notification)
            .where(
                *base_filter,
                group_key_expr.in_(page_group_keys),
            )
            .order_by(Notification.created_at.desc())
        )
        page_notifications = list((await db.execute(rows_query)).scalars().all())

        notifs_by_key: dict[str, list[Notification]] = defaultdict(list)
        for notif in page_notifications:
            key = get_group_key_for_mode(notif, group_mode)
            notifs_by_key[key].append(notif)

        priority_rank_to_label = {4: "urgent", 3: "high", 2: "normal", 1: "low"}

        groups: list[NotificationGroupResponse] = []
        for row in page_agg_rows:
            gkey = row["group_key"]
            group_notifs = notifs_by_key.get(gkey, [])
            latest = group_notifs[0] if group_notifs else None
            highest_priority = priority_rank_to_label.get(row["max_priority_rank"], "low")
            group_lbl = get_group_label(gkey, latest, group_mode) if latest else gkey

            groups.append(
                NotificationGroupResponse(
                    group_key=gkey,
                    group_label=group_lbl,
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
        query = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
            .values(is_read=True, read_at=datetime.now(UTC))
        )

        if group_mode == "entity" and group_key.startswith("entity:"):
            parts = group_key.split(":")
            if len(parts) >= 3:
                entity_type = parts[1]
                entity_id = uuid.UUID(parts[2])
                query = query.where(
                    Notification.entity_type == entity_type,
                    Notification.entity_id == entity_id,
                )
            else:
                return 0
        elif group_mode == "time":
            now = datetime.now(UTC)
            time_label = group_key.replace("time:", "")

            if time_label == "Last hour":
                cutoff = now - timedelta(hours=1)
            elif time_label == "Today":
                cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif time_label == "Yesterday":
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
                cutoff = now - timedelta(days=365)

            query = query.where(Notification.created_at >= cutoff)
        else:
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

        count_query = select(func.count(func.distinct(group_key_expr))).where(*base_filter)
        return (await db.execute(count_query)).scalar_one()

    # ------------------------------------------------------------------ #
    # Email / push / realtime delivery helpers                            #
    # ------------------------------------------------------------------ #

    async def _send_immediate_notification_email(
        self,
        db: AsyncSession,
        notification: Notification,
    ) -> None:
        """Send an immediate email for a single notification."""
        await _send_immediate_email_fn(db, notification)

    async def _send_realtime_notification(
        self,
        notification: Notification,
    ) -> None:
        """Broadcast notification via WebSocket for real-time updates."""
        await _send_realtime_fn(notification)

    # ------------------------------------------------------------------ #
    # Digest                                                               #
    # ------------------------------------------------------------------ #

    async def send_digest(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> None:
        """Send email digest for a user based on their preferences."""
        await _send_digest_fn(db, user_id)

    async def process_queued_notifications(
        self,
        db: AsyncSession,
        limit: int = 100,
    ) -> tuple[int, int]:
        """Process all queued notifications for delivery."""
        return await _process_queued_fn(db, limit)

    # ------------------------------------------------------------------ #
    # Snooze — delegate to notification_preferences module                #
    # ------------------------------------------------------------------ #

    async def snooze_notification(
        self,
        db: AsyncSession,
        notification_id: uuid.UUID,
        user_id: uuid.UUID,
        snooze_request: SnoozeRequest,
        user_timezone: str = "UTC",
    ) -> Notification:
        """Snooze a notification until a specified time."""
        return await _snooze_notification(
            db, notification_id, user_id, snooze_request, user_timezone
        )

    async def unsnooze_notification(
        self,
        db: AsyncSession,
        notification_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Notification:
        """Unsnooze a notification immediately."""
        return await _unsnooze_notification(db, notification_id, user_id)

    async def get_snoozed_notifications(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Notification], int]:
        """Get all currently snoozed notifications for a user."""
        return await get_snoozed_notifications(db, user_id, skip, limit)

    async def process_expired_snoozes(
        self,
        db: AsyncSession,
        limit: int = 100,
    ) -> int:
        """Process notifications whose snooze period has expired."""
        return await process_expired_snoozes(db, limit)


notification_service = NotificationService(Notification)
