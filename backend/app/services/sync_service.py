"""Service for multi-device synchronization."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dashboard_config import DashboardConfig
from app.models.device_session import DeviceSession
from app.models.notification_preference import NotificationPreference
from app.models.read_status import ReadStatus
from app.models.sync_queue import SyncQueueItem
from app.models.user_preferences import UserPreferences
from app.schemas.sync import (
    DeviceRegisterRequest,
    ReadStatusResponse,
    ReadStatusUpdate,
    SyncChange,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
)
from app.schemas.user_preferences import (
    ConflictResolution,
    DashboardConfigSummary,
    UIPreferences,
    UserPreferencesResponse,
    UserPreferencesSyncResponse,
    UserPreferencesUpdate,
)

logger = logging.getLogger(__name__)

# Maximum retry attempts for failed sync items
MAX_RETRY_ATTEMPTS = 3


class SyncService:
    """Service for multi-device synchronization of preferences and read status."""

    async def get_or_create_user_preferences(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> UserPreferences:
        """Get or create user preferences for a user."""
        result = await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == user_id)
        )
        prefs = result.scalar_one_or_none()

        if prefs is None:
            prefs = UserPreferences(
                user_id=user_id,
                ui_preferences=UIPreferences().model_dump(),
                version=1,
                sync_enabled=True,
            )
            db.add(prefs)
            await db.commit()
            await db.refresh(prefs)

        return prefs

    async def get_user_preferences_response(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> UserPreferencesResponse:
        """Build full preferences response for a user."""
        prefs = await self.get_or_create_user_preferences(db, user_id)

        # Get notification preferences
        notif_result = await db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user_id
            )
        )
        notif_prefs = notif_result.scalar_one_or_none()

        # Get dashboard config
        dash_result = await db.execute(
            select(DashboardConfig).where(DashboardConfig.user_id == user_id)
        )
        dash_config = dash_result.scalar_one_or_none()

        return UserPreferencesResponse(
            id=prefs.id,
            user_id=prefs.user_id,
            ui_preferences=UIPreferences(**prefs.ui_preferences),
            notification_preferences=notif_prefs,  # type: ignore[arg-type]
            dashboard_config=DashboardConfigSummary(
                layout_mode=dash_config.layout_mode if dash_config else "grid",
                columns=dash_config.columns if dash_config else 3,
                widgets=dash_config.widgets if dash_config else [],
            )
            if dash_config
            else None,
            sync_enabled=prefs.sync_enabled,
            version=prefs.version,
            created_at=prefs.created_at,
            updated_at=prefs.updated_at,
        )

    async def update_user_preferences(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        update_data: UserPreferencesUpdate,
        device_id: str | None = None,
    ) -> UserPreferencesSyncResponse:
        """Update user preferences with optimistic locking."""
        prefs = await self.get_or_create_user_preferences(db, user_id)

        # Check for version conflict
        conflict = None
        if update_data.version != prefs.version:
            # Version mismatch - potential conflict
            conflict = ConflictResolution(
                server_version=prefs.version,
                client_version=update_data.version,
                server_updated_at=prefs.updated_at,
                conflict_fields=list(update_data.ui_preferences.model_dump(exclude_unset=True).keys())
                if update_data.ui_preferences
                else [],
                resolution_strategy="server_wins",
            )
            # Still return current server state
            return UserPreferencesSyncResponse(
                preferences=await self.get_user_preferences_response(db, user_id),
                conflict=conflict,
                synced_at=datetime.now(UTC),
            )

        # Apply updates
        if update_data.ui_preferences:
            current_ui = prefs.ui_preferences.copy()
            update_dict = update_data.ui_preferences.model_dump(exclude_unset=True)
            current_ui.update(update_dict)
            prefs.ui_preferences = current_ui

        if update_data.sync_enabled is not None:
            prefs.sync_enabled = update_data.sync_enabled

        # Increment version
        prefs.version = prefs.version + 1

        await db.commit()
        await db.refresh(prefs)

        return UserPreferencesSyncResponse(
            preferences=await self.get_user_preferences_response(db, user_id),
            conflict=None,
            synced_at=datetime.now(UTC),
        )

    async def push_changes(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        request: SyncPushRequest,
    ) -> SyncPushResponse:
        """Push changes from a client device to the server."""
        processed = 0
        failed: list[dict[str, Any]] = []
        now = datetime.now(UTC)

        for change in request.changes:
            try:
                await self._process_change(db, user_id, request.device_id, change)
                processed += 1
            except Exception as e:
                logger.exception(f"Failed to process sync change: {change}")
                failed.append(
                    {
                        "entity_type": change.entity_type,
                        "entity_id": str(change.entity_id) if change.entity_id else None,
                        "action": change.action,
                        "error": str(e),
                    }
                )

        # Update device last seen
        await self._update_device_last_seen(db, user_id, request.device_id)

        # Get current version
        prefs = await self.get_or_create_user_preferences(db, user_id)

        await db.commit()

        return SyncPushResponse(
            success=len(failed) == 0,
            server_version=prefs.version,
            processed_changes=processed,
            failed_changes=failed if failed else None,
            synced_at=now,
        )

    async def _process_change(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        device_id: str,
        change: SyncChange,
    ) -> None:
        """Process a single sync change."""
        if change.action in ("mark_read", "mark_unread"):
            await self._process_read_status_change(
                db, user_id, device_id, change
            )
        elif change.action in ("update_preference", "update_ui_preference"):
            await self._process_preference_change(
                db, user_id, device_id, change
            )
        else:
            raise ValueError(f"Unknown sync action: {change.action}")

    async def _process_read_status_change(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        device_id: str,
        change: SyncChange,
    ) -> None:
        """Process a read status change."""
        if not change.entity_id:
            raise ValueError("entity_id required for read status changes")

        is_read = change.action == "mark_read"
        now = datetime.now(UTC)

        # Find existing or create new
        result = await db.execute(
            select(ReadStatus).where(
                and_(
                    ReadStatus.user_id == user_id,
                    ReadStatus.entity_type == change.entity_type,
                    ReadStatus.entity_id == change.entity_id,
                )
            )
        )
        status = result.scalar_one_or_none()

        if status:
            status.is_read = is_read
            status.read_at = now if is_read else None
            status.device_id = device_id
            status.updated_at = now
        else:
            status = ReadStatus(
                user_id=user_id,
                entity_type=change.entity_type,
                entity_id=change.entity_id,
                is_read=is_read,
                read_at=now if is_read else None,
                device_id=device_id,
            )
            db.add(status)

    async def _process_preference_change(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        device_id: str,
        change: SyncChange,
    ) -> None:
        """Process a preference change."""
        prefs = await self.get_or_create_user_preferences(db, user_id)

        # Update UI preferences from payload
        if change.payload:
            current_ui = prefs.ui_preferences.copy()
            current_ui.update(change.payload)
            prefs.ui_preferences = current_ui
            prefs.version = prefs.version + 1

    async def pull_changes(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        device_id: str,
        since_version: int | None = None,
    ) -> SyncPullResponse:
        """Pull changes from the server to a client device."""
        now = datetime.now(UTC)

        # Get current preferences
        preferences = await self.get_user_preferences_response(db, user_id)

        # Get read statuses (optionally filtered by version/timestamp)
        read_statuses = await self._get_read_statuses(db, user_id, since_version)

        # Update device last seen
        await self._update_device_last_seen(db, user_id, device_id)

        await db.commit()

        return SyncPullResponse(
            server_version=preferences.version,
            preferences=preferences,
            read_statuses=read_statuses,
            pending_changes=None,  # Could be used for offline queue
            synced_at=now,
        )

    async def _get_read_statuses(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        since_version: int | None = None,
    ) -> list[ReadStatusResponse]:
        """Get read statuses for a user."""
        query = select(ReadStatus).where(ReadStatus.user_id == user_id)

        # For now, return all statuses; could add timestamp filtering
        result = await db.execute(query)
        statuses = result.scalars().all()

        return [
            ReadStatusResponse(
                id=s.id,
                user_id=s.user_id,
                entity_type=s.entity_type,
                entity_id=s.entity_id,
                is_read=s.is_read,
                read_at=s.read_at,
                updated_at=s.updated_at,
            )
            for s in statuses
        ]

    async def update_read_status(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        update: ReadStatusUpdate,
    ) -> ReadStatusResponse:
        """Update read status for a single entity."""
        now = datetime.now(UTC)

        result = await db.execute(
            select(ReadStatus).where(
                and_(
                    ReadStatus.user_id == user_id,
                    ReadStatus.entity_type == update.entity_type,
                    ReadStatus.entity_id == update.entity_id,
                )
            )
        )
        status = result.scalar_one_or_none()

        if status:
            status.is_read = update.is_read
            status.read_at = now if update.is_read else None
            status.device_id = update.device_id
            status.updated_at = now
        else:
            status = ReadStatus(
                user_id=user_id,
                entity_type=update.entity_type,
                entity_id=update.entity_id,
                is_read=update.is_read,
                read_at=now if update.is_read else None,
                device_id=update.device_id,
            )
            db.add(status)

        await db.commit()
        await db.refresh(status)

        return ReadStatusResponse(
            id=status.id,
            user_id=status.user_id,
            entity_type=status.entity_type,
            entity_id=status.entity_id,
            is_read=status.is_read,
            read_at=status.read_at,
            updated_at=status.updated_at,
        )

    async def batch_update_read_status(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        updates: list[ReadStatusUpdate],
    ) -> list[ReadStatusResponse]:
        """Batch update read statuses."""
        results = []
        for update in updates:
            result = await self.update_read_status(db, user_id, update)
            results.append(result)
        return results

    async def register_device(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        request: DeviceRegisterRequest,
    ) -> DeviceSession:
        """Register or update a device session."""
        result = await db.execute(
            select(DeviceSession).where(
                and_(
                    DeviceSession.user_id == user_id,
                    DeviceSession.device_id == request.device_id,
                )
            )
        )
        session = result.scalar_one_or_none()

        now = datetime.now(UTC)

        if session:
            session.device_type = request.device_type
            session.device_name = request.device_name
            session.user_agent = request.user_agent
            session.app_version = request.app_version
            session.last_seen_at = now
            session.is_active = True
        else:
            session = DeviceSession(
                user_id=user_id,
                device_id=request.device_id,
                device_type=request.device_type,
                device_name=request.device_name,
                user_agent=request.user_agent,
                app_version=request.app_version,
                last_seen_at=now,
                is_active=True,
            )
            db.add(session)

        await db.commit()
        await db.refresh(session)

        return session

    async def _update_device_last_seen(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        device_id: str,
    ) -> None:
        """Update device last seen timestamp."""
        result = await db.execute(
            select(DeviceSession).where(
                and_(
                    DeviceSession.user_id == user_id,
                    DeviceSession.device_id == device_id,
                )
            )
        )
        session = result.scalar_one_or_none()

        if session:
            session.last_seen_at = datetime.now(UTC)
            session.is_active = True

    async def get_user_devices(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[DeviceSession]:
        """Get all devices for a user."""
        result = await db.execute(
            select(DeviceSession)
            .where(DeviceSession.user_id == user_id)
            .order_by(DeviceSession.last_seen_at.desc())
        )
        return list(result.scalars().all())

    async def deactivate_device(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        device_id: str,
    ) -> bool:
        """Deactivate a device session."""
        result = await db.execute(
            select(DeviceSession).where(
                and_(
                    DeviceSession.user_id == user_id,
                    DeviceSession.device_id == device_id,
                )
            )
        )
        session = result.scalar_one_or_none()

        if session:
            session.is_active = False
            await db.commit()
            return True

        return False

    async def queue_offline_change(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        device_id: str,
        change: SyncChange,
    ) -> SyncQueueItem:
        """Queue a change for later sync (offline mode)."""
        item = SyncQueueItem(
            user_id=user_id,
            device_id=device_id,
            entity_type=change.entity_type,
            entity_id=change.entity_id,
            action=change.action,
            payload=change.payload,
            client_timestamp=change.client_timestamp,
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return item

    async def get_pending_sync_items(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[SyncQueueItem]:
        """Get pending sync items for a user."""
        result = await db.execute(
            select(SyncQueueItem)
            .where(
                and_(
                    SyncQueueItem.user_id == user_id,
                    SyncQueueItem.synced_at.is_(None),
                    SyncQueueItem.retry_count < MAX_RETRY_ATTEMPTS,
                )
            )
            .order_by(SyncQueueItem.client_timestamp)
        )
        return list(result.scalars().all())

    async def cleanup_old_sync_items(
        self,
        db: AsyncSession,
        older_than_days: int = 30,
    ) -> int:
        """Clean up old synced items from the queue."""
        cutoff = datetime.now(UTC).replace(
            day=datetime.now(UTC).day - older_than_days
        )
        result = await db.execute(
            delete(SyncQueueItem)
            .where(
                and_(
                    SyncQueueItem.synced_at.isnot(None),
                    SyncQueueItem.synced_at < cutoff,
                )
            )
            .returning(SyncQueueItem.id)
        )
        deleted_ids = list(result.scalars().all())
        await db.commit()
        return len(deleted_ids)


# Singleton instance
sync_service = SyncService()
