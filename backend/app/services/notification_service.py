"""Service for notification operations."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.user import User
from app.schemas.notification import (
    CreateNotificationRequest,
    NotificationPreferenceUpdate,
)
from app.services.crud_base import CRUDBase


class NotificationService(CRUDBase[Notification, CreateNotificationRequest, dict[str, Any]]):
    """Service for notification operations."""

    async def get_notifications_for_user(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        unread_only: bool = False,
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
        from sqlalchemy import update

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
    ) -> Notification:
        """Create a new notification and send push/real-time notifications."""
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
        )
        db.add(notification)
        await db.commit()
        await db.refresh(notification)

        # Get user preferences
        prefs = await self.get_or_create_preferences(db, data.user_id)

        # Send push notification
        await self._send_push_notification(db, notification, prefs)

        # Send real-time notification via WebSocket
        await self._send_realtime_notification(notification)

        return notification

    async def _send_push_notification(
        self,
        db: AsyncSession,
        notification: Notification,
        prefs: NotificationPreference,
    ) -> None:
        """Send push notification for a new notification."""
        from app.services.push_service import push_service

        channel_prefs = prefs.channel_preferences or {}
        if not channel_prefs.get("push", True):
            return

        await push_service.send_push_notification(
            db,
            user_id=notification.user_id,
            title=notification.title,
            body=notification.body,
            data={
                "id": str(notification.id),
                "type": notification.notification_type,
                "action_url": notification.action_url,
                "entity_type": notification.entity_type,
                "entity_id": str(notification.entity_id) if notification.entity_id else None,
                "priority": notification.priority,
            },
            preferences=prefs,
        )

    async def _send_realtime_notification(self, notification: Notification) -> None:
        """Send real-time notification via WebSocket."""
        from app.api.ws_connection import connection_manager

        await connection_manager.broadcast_notification(
            notification.user_id,
            {
                "id": str(notification.id),
                "type": notification.notification_type,
                "title": notification.title,
                "body": notification.body,
                "action_url": notification.action_url,
                "action_label": notification.action_label,
                "entity_type": notification.entity_type,
                "entity_id": str(notification.entity_id) if notification.entity_id else None,
                "priority": notification.priority,
                "created_at": notification.created_at.isoformat(),
            },
        )

    async def send_digest(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> None:
        """Send email digest for a user based on their preferences."""
        # Get user preferences
        prefs = await self.get_or_create_preferences(db, user_id)

        if not prefs.digest_enabled or prefs.digest_frequency == "never":
            return

        # Get unread notifications
        notifications, _ = await self.get_notifications_for_user(
            db, user_id, unread_only=True, limit=100
        )

        if not notifications:
            return

        # Group notifications by type
        grouped: dict[str, list[Notification]] = {}
        for notif in notifications:
            if notif.notification_type not in grouped:
                grouped[notif.notification_type] = []
            grouped[notif.notification_type].append(notif)

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

        # Mark as email delivered
        for notif in notifications:
            notif.email_delivered = True

        await db.commit()


notification_service = NotificationService(Notification)
