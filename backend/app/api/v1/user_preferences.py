"""API endpoints for user preferences and multi-device sync."""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import DB, CurrentUser
from app.core.exceptions import NotFoundException
from app.schemas.sync import (
    BatchReadStatusUpdate,
    DeviceListResponse,
    DeviceRegisterRequest,
    DeviceSessionResponse,
    ReadStatusResponse,
    ReadStatusUpdate,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
    SyncStatusResponse,
)
from app.schemas.user_preferences import (
    UserPreferencesResponse,
    UserPreferencesSyncResponse,
    UserPreferencesUpdate,
)
from app.services.sync_service import sync_service

router = APIRouter(tags=["user-preferences"])


@router.get("/preferences", response_model=UserPreferencesResponse)
async def get_user_preferences(
    current_user: CurrentUser,
    db: DB,
) -> UserPreferencesResponse:
    """Get the current user's preferences."""
    return await sync_service.get_user_preferences_response(db, current_user.id)


@router.patch("/preferences", response_model=UserPreferencesSyncResponse)
async def update_user_preferences(
    update_data: UserPreferencesUpdate,
    current_user: CurrentUser,
    db: DB,
    device_id: str | None = None,
) -> UserPreferencesSyncResponse:
    """Update user preferences with optimistic locking.

    Send the current version number with your update. If the version doesn't
    match the server's version, a conflict will be returned with the current
    server state.
    """
    return await sync_service.update_user_preferences(db, current_user.id, update_data, device_id)


@router.post("/preferences/sync", response_model=SyncPullResponse)
async def sync_preferences(
    request: SyncPushRequest,
    current_user: CurrentUser,
    db: DB,
) -> SyncPullResponse:
    """Push local changes and pull remote changes.

    This is the main sync endpoint that handles:
    - Pushing changes from the client device
    - Pulling the latest server state
    - Returning all read statuses
    """
    # First push any changes
    if request.changes:
        await sync_service.push_changes(db, current_user.id, request)

    # Then pull latest state
    return await sync_service.pull_changes(
        db, current_user.id, request.device_id, request.client_version
    )


@router.post("/preferences/push", response_model=SyncPushResponse)
async def push_changes(
    request: SyncPushRequest,
    current_user: CurrentUser,
    db: DB,
) -> SyncPushResponse:
    """Push changes from client to server only."""
    return await sync_service.push_changes(db, current_user.id, request)


@router.post("/preferences/pull", response_model=SyncPullResponse)
async def pull_changes(
    device_id: str,
    current_user: CurrentUser,
    db: DB,
    since_version: int | None = None,
) -> SyncPullResponse:
    """Pull changes from server to client only."""
    return await sync_service.pull_changes(db, current_user.id, device_id, since_version)


@router.get("/preferences/status", response_model=SyncStatusResponse)
async def get_sync_status(
    current_user: CurrentUser,
    db: DB,
) -> SyncStatusResponse:
    """Get the current sync status for the user."""
    prefs = await sync_service.get_or_create_user_preferences(db, current_user.id)
    devices = await sync_service.get_user_devices(db, current_user.id)
    pending = await sync_service.get_pending_sync_items(db, current_user.id)

    return SyncStatusResponse(
        is_syncing=False,  # Could be tracked per-user if needed
        last_synced_at=prefs.updated_at,
        pending_changes=len(pending),
        server_version=prefs.version,
        sync_enabled=prefs.sync_enabled,
        connected_devices=len([d for d in devices if d.is_active]),
    )


# Read Status Endpoints


@router.post("/read-status", response_model=ReadStatusResponse)
async def update_read_status(
    update: ReadStatusUpdate,
    current_user: CurrentUser,
    db: DB,
) -> ReadStatusResponse:
    """Update read status for a single entity."""
    return await sync_service.update_read_status(db, current_user.id, update)


@router.post("/read-status/batch", response_model=list[ReadStatusResponse])
async def batch_update_read_status(
    updates: BatchReadStatusUpdate,
    current_user: CurrentUser,
    db: DB,
) -> list[ReadStatusResponse]:
    """Batch update read statuses for multiple entities."""
    return await sync_service.batch_update_read_status(db, current_user.id, updates.updates)


@router.get("/read-status/{entity_type}/{entity_id}", response_model=ReadStatusResponse)
async def get_read_status(
    entity_type: str,
    entity_id: UUID,
    current_user: CurrentUser,
    db: DB,
) -> ReadStatusResponse:
    """Get read status for a specific entity."""
    from sqlalchemy import select

    from app.models.read_status import ReadStatus

    result = await db.execute(
        select(ReadStatus).where(
            ReadStatus.user_id == current_user.id,
            ReadStatus.entity_type == entity_type,
            ReadStatus.entity_id == entity_id,
        )
    )
    read_status_record = result.scalar_one_or_none()

    if not read_status_record:
        raise NotFoundException("Read status not found")

    return ReadStatusResponse(
        id=read_status_record.id,
        user_id=read_status_record.user_id,
        entity_type=read_status_record.entity_type,
        entity_id=read_status_record.entity_id,
        is_read=read_status_record.is_read,
        read_at=read_status_record.read_at,
        updated_at=read_status_record.updated_at,
    )


# Device Management Endpoints


@router.post("/devices/register", response_model=DeviceSessionResponse)
async def register_device(
    request: DeviceRegisterRequest,
    current_user: CurrentUser,
    db: DB,
) -> DeviceSessionResponse:
    """Register or update a device session."""
    session = await sync_service.register_device(db, current_user.id, request)
    return DeviceSessionResponse(
        id=session.id,
        device_id=session.device_id,
        device_type=session.device_type,
        device_name=session.device_name,
        last_seen_at=session.last_seen_at,
        is_active=session.is_active,
        app_version=session.app_version,
    )


@router.get("/devices", response_model=DeviceListResponse)
async def list_devices(
    current_user: CurrentUser,
    db: DB,
    current_device_id: str | None = None,
) -> DeviceListResponse:
    """List all devices for the current user."""
    devices = await sync_service.get_user_devices(db, current_user.id)
    return DeviceListResponse(
        devices=[
            DeviceSessionResponse(
                id=d.id,
                device_id=d.device_id,
                device_type=d.device_type,
                device_name=d.device_name,
                last_seen_at=d.last_seen_at,
                is_active=d.is_active,
                app_version=d.app_version,
            )
            for d in devices
        ],
        current_device_id=current_device_id,
        total=len(devices),
    )


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_device(
    device_id: str,
    current_user: CurrentUser,
    db: DB,
) -> None:
    """Deactivate a device session."""
    success = await sync_service.deactivate_device(db, current_user.id, device_id)
    if not success:
        raise NotFoundException("Device not found")
