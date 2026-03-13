"""Calendar integration API endpoints."""

import logging
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, require_rm_or_above
from app.models.calendar import CalendarConnection, CalendarReminder
from app.models.enums import CalendarProvider
from app.models.milestone import Milestone
from app.models.program import Program
from app.schemas.calendar import (
    AvailabilityRequest,
    AvailabilityResponse,
    BatchSyncRequest,
    BatchSyncResponse,
    CalendarConnectionResponse,
    CalendarConnectionUpdate,
    CalendarListResponse,
    CalendarReminderResponse,
    OAuthAuthorizeRequest,
    OAuthAuthorizeResponse,
    OAuthCallbackRequest,
    SyncMilestoneRequest,
    SyncMilestoneResponse,
    SyncStatusResponse,
)
from app.services.calendar_service import calendar_service

logger = logging.getLogger(__name__)

router = APIRouter()


# --- OAuth Flow ---


@router.post("/connect/authorize", response_model=OAuthAuthorizeResponse)
async def get_authorization_url(
    data: OAuthAuthorizeRequest,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
):
    """Get OAuth authorization URL for connecting a calendar."""
    state = calendar_service.generate_state()

    # Store state in session/cache for validation (in production, use Redis)
    # For now, we'll encode user_id in state
    encoded_state = f"{state}:{current_user.id}"

    auth_url = await calendar_service.get_authorization_url(
        data.provider,
        data.redirect_uri,
        encoded_state,
    )

    return OAuthAuthorizeResponse(authorization_url=auth_url, state=encoded_state)


@router.post("/connect/callback", response_model=CalendarConnectionResponse)
async def oauth_callback(
    data: OAuthCallbackRequest,
    db: DB,
    current_user: CurrentUser,
):
    """Handle OAuth callback and complete calendar connection."""
    # Validate state
    try:
        state_parts = data.state.split(":")
        if len(state_parts) != 2:
            raise ValueError("Invalid state")
        _, user_id_str = state_parts
        user_id = uuid.UUID(user_id_str)
        if user_id != current_user.id:
            raise ValueError("State user mismatch")
    except (ValueError, IndexError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid state parameter: {e}",
        ) from e

    try:
        connection = await calendar_service.complete_oauth(
            db,
            current_user.id,
            data.provider,
            data.code,
            data.redirect_uri,
        )

        return CalendarConnectionResponse(
            id=connection.id,
            provider=CalendarProvider(connection.provider),
            provider_email=connection.provider_email,
            calendar_id=connection.calendar_id,
            calendar_name=connection.calendar_name,
            is_primary=connection.is_primary,
            is_active=connection.is_active,
            sync_milestones=connection.sync_milestones,
            sync_tasks=connection.sync_tasks,
            reminder_minutes=connection.reminder_minutes,
            last_sync_at=connection.last_sync_at,
            sync_error=connection.sync_error,
            created_at=connection.created_at,
            updated_at=connection.updated_at,
        )
    except Exception as e:
        logger.exception("OAuth callback failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect calendar: {e}",
        ) from e


# --- Calendar Connections ---


@router.get("/connections", response_model=list[CalendarConnectionResponse])
async def list_connections(
    db: DB,
    current_user: CurrentUser,
):
    """List all calendar connections for the current user."""
    result = await db.execute(
        select(CalendarConnection).where(CalendarConnection.user_id == current_user.id)
    )
    connections = result.scalars().all()

    return [
        CalendarConnectionResponse(
            id=c.id,
            provider=CalendarProvider(c.provider),
            provider_email=c.provider_email,
            calendar_id=c.calendar_id,
            calendar_name=c.calendar_name,
            is_primary=c.is_primary,
            is_active=c.is_active,
            sync_milestones=c.sync_milestones,
            sync_tasks=c.sync_tasks,
            reminder_minutes=c.reminder_minutes,
            last_sync_at=c.last_sync_at,
            sync_error=c.sync_error,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in connections
    ]


@router.get("/connections/{connection_id}", response_model=CalendarConnectionResponse)
async def get_connection(
    connection_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Get a specific calendar connection."""
    result = await db.execute(
        select(CalendarConnection).where(
            CalendarConnection.id == connection_id,
            CalendarConnection.user_id == current_user.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar connection not found",
        )

    return CalendarConnectionResponse(
        id=connection.id,
        provider=CalendarProvider(connection.provider),
        provider_email=connection.provider_email,
        calendar_id=connection.calendar_id,
        calendar_name=connection.calendar_name,
        is_primary=connection.is_primary,
        is_active=connection.is_active,
        sync_milestones=connection.sync_milestones,
        sync_tasks=connection.sync_tasks,
        reminder_minutes=connection.reminder_minutes,
        last_sync_at=connection.last_sync_at,
        sync_error=connection.sync_error,
        created_at=connection.created_at,
        updated_at=connection.updated_at,
    )


@router.patch("/connections/{connection_id}", response_model=CalendarConnectionResponse)
async def update_connection(
    connection_id: uuid.UUID,
    data: CalendarConnectionUpdate,
    db: DB,
    current_user: CurrentUser,
):
    """Update calendar connection settings."""
    result = await db.execute(
        select(CalendarConnection).where(
            CalendarConnection.id == connection_id,
            CalendarConnection.user_id == current_user.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar connection not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(connection, field, value)

    await db.commit()
    await db.refresh(connection)

    return CalendarConnectionResponse(
        id=connection.id,
        provider=CalendarProvider(connection.provider),
        provider_email=connection.provider_email,
        calendar_id=connection.calendar_id,
        calendar_name=connection.calendar_name,
        is_primary=connection.is_primary,
        is_active=connection.is_active,
        sync_milestones=connection.sync_milestones,
        sync_tasks=connection.sync_tasks,
        reminder_minutes=connection.reminder_minutes,
        last_sync_at=connection.last_sync_at,
        sync_error=connection.sync_error,
        created_at=connection.created_at,
        updated_at=connection.updated_at,
    )


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Disconnect a calendar."""
    result = await db.execute(
        select(CalendarConnection).where(
            CalendarConnection.id == connection_id,
            CalendarConnection.user_id == current_user.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar connection not found",
        )

    await db.delete(connection)
    await db.commit()


@router.get("/connections/{connection_id}/calendars", response_model=CalendarListResponse)
async def list_available_calendars(
    connection_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """List available calendars from a connected provider."""
    result = await db.execute(
        select(CalendarConnection).where(
            CalendarConnection.id == connection_id,
            CalendarConnection.user_id == current_user.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar connection not found",
        )

    try:
        service = calendar_service.get_provider(CalendarProvider(connection.provider))
        access_token = await calendar_service._ensure_valid_token(connection, service)
        calendars = await service.get_calendars(access_token)

        return CalendarListResponse(calendars=calendars)
    except Exception as e:
        logger.exception("Failed to list calendars: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list calendars: {e}",
        ) from e


# --- Milestone Sync ---


@router.post("/milestones/{milestone_id}/sync", response_model=SyncMilestoneResponse)
async def sync_milestone_to_calendar(
    milestone_id: uuid.UUID,
    data: SyncMilestoneRequest,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
):
    """Sync a milestone to a calendar."""
    # Get milestone with program info
    result = await db.execute(
        select(Milestone)
        .options(selectinload(Milestone.program).selectinload(Program.client))
        .where(Milestone.id == milestone_id)
    )
    milestone = result.scalar_one_or_none()

    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )

    # Verify connection belongs to user
    result = await db.execute(
        select(CalendarConnection).where(
            CalendarConnection.id == data.connection_id,
            CalendarConnection.user_id == current_user.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar connection not found",
        )

    try:
        # Build event title and description
        program = milestone.program
        client_name = program.client.name if program and program.client else "Unknown Client"
        program_title = program.title if program else "Unknown Program"

        title = data.event_title or f"[AMG] {milestone.title} - {program_title}"
        description = data.event_description or (
            f"Milestone: {milestone.title}\n"
            f"Program: {program_title}\n"
            f"Client: {client_name}\n\n"
            f"{milestone.description or ''}"
        )

        # Use due date for event (all-day or timed event)
        if milestone.due_date:
            start_time = datetime.combine(milestone.due_date, datetime.min.time())
            end_time = start_time + timedelta(hours=1)
        else:
            # Default to 1 week from now if no due date
            start_time = datetime.utcnow() + timedelta(days=7)
            end_time = start_time + timedelta(hours=1)

        reminder = data.reminder_minutes or connection.reminder_minutes

        result = await calendar_service.sync_milestone(
            db,
            milestone,
            connection,
            title,
            description,
            start_time,
            end_time,
            reminder,
        )

        # Update connection sync time
        connection.last_sync_at = datetime.utcnow()
        connection.sync_error = None
        await db.commit()

        return result
    except Exception as e:
        logger.exception("Failed to sync milestone: %s", e)
        connection.sync_error = str(e)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to sync milestone: {e}",
        ) from e


@router.delete(
    "/milestones/{milestone_id}/sync/{connection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unsync_milestone(
    milestone_id: uuid.UUID,
    connection_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Remove a milestone from a calendar."""
    # Verify connection belongs to user
    result = await db.execute(
        select(CalendarConnection).where(
            CalendarConnection.id == connection_id,
            CalendarConnection.user_id == current_user.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar connection not found",
        )

    try:
        await calendar_service.unsync_milestone(db, milestone_id, connection_id)
    except Exception as e:
        logger.exception("Failed to unsync milestone: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to remove milestone from calendar: {e}",
        ) from e


@router.post("/milestones/batch-sync", response_model=BatchSyncResponse)
async def batch_sync_milestones(
    data: BatchSyncRequest,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
):
    """Sync multiple milestones to a calendar."""
    # Verify connection belongs to user
    result = await db.execute(
        select(CalendarConnection).where(
            CalendarConnection.id == data.connection_id,
            CalendarConnection.user_id == current_user.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar connection not found",
        )

    synced: list[uuid.UUID] = []
    failed: list[dict[str, str]] = []

    for milestone_id in data.milestone_ids:
        try:
            result = await db.execute(
                select(Milestone)
                .options(selectinload(Milestone.program).selectinload(Program.client))
                .where(Milestone.id == milestone_id)
            )
            milestone = result.scalar_one_or_none()

            if not milestone:
                failed.append({"milestone_id": str(milestone_id), "error": "Milestone not found"})
                continue

            program = milestone.program
            client_name = program.client.name if program and program.client else "Unknown Client"
            program_title = program.title if program else "Unknown Program"

            title = f"[AMG] {milestone.title} - {program_title}"
            description = (
                f"Milestone: {milestone.title}\n"
                f"Program: {program_title}\n"
                f"Client: {client_name}\n\n"
                f"{milestone.description or ''}"
            )

            if milestone.due_date:
                start_time = datetime.combine(milestone.due_date, datetime.min.time())
                end_time = start_time + timedelta(hours=1)
            else:
                start_time = datetime.utcnow() + timedelta(days=7)
                end_time = start_time + timedelta(hours=1)

            await calendar_service.sync_milestone(
                db,
                milestone,
                connection,
                title,
                description,
                start_time,
                end_time,
                connection.reminder_minutes,
            )
            synced.append(milestone_id)
        except Exception as e:
            failed.append({"milestone_id": str(milestone_id), "error": str(e)})

    connection.last_sync_at = datetime.utcnow()
    await db.commit()

    return BatchSyncResponse(synced=synced, failed=failed)


@router.get("/milestones/{milestone_id}/status", response_model=SyncStatusResponse)
async def get_milestone_sync_status(
    milestone_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Get sync status for a milestone."""
    status_data = await calendar_service.get_milestone_sync_status(db, milestone_id)

    return SyncStatusResponse(
        milestone_id=milestone_id,
        is_synced=status_data["is_synced"],
        calendar_events=status_data["calendar_events"],
        reminders=status_data["reminders"],
    )


# --- Availability ---


@router.post("/availability", response_model=AvailabilityResponse)
async def check_availability(
    data: AvailabilityRequest,
    db: DB,
    current_user: CurrentUser,
):
    """Check availability for users in a time range."""
    return await calendar_service.check_availability(
        db,
        data.user_ids,
        data.start_time,
        data.end_time,
    )


# --- Reminders ---


@router.post(
    "/milestones/{milestone_id}/reminders",
    response_model=CalendarReminderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reminder(
    milestone_id: uuid.UUID,
    reminder_minutes: int = Query(..., ge=0, description="Minutes before due date"),
    db: DB = None,
    current_user: CurrentUser = None,
):
    """Create a reminder for a milestone."""
    # Verify milestone exists
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()

    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )

    reminder = await calendar_service.create_reminder(
        db,
        milestone_id,
        current_user.id,
        reminder_minutes,
    )

    return CalendarReminderResponse(
        id=reminder.id,
        milestone_id=reminder.milestone_id,
        user_id=reminder.user_id,
        reminder_minutes=reminder.reminder_minutes,
        notification_sent=reminder.notification_sent,
        notification_sent_at=reminder.notification_sent_at,
        created_at=reminder.created_at,
    )


@router.get("/milestones/{milestone_id}/reminders", response_model=list[CalendarReminderResponse])
async def list_reminders(
    milestone_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """List reminders for a milestone."""
    result = await db.execute(
        select(CalendarReminder).where(
            CalendarReminder.milestone_id == milestone_id,
            CalendarReminder.user_id == current_user.id,
        )
    )
    reminders = result.scalars().all()

    return [
        CalendarReminderResponse(
            id=r.id,
            milestone_id=r.milestone_id,
            user_id=r.user_id,
            reminder_minutes=r.reminder_minutes,
            notification_sent=r.notification_sent,
            notification_sent_at=r.notification_sent_at,
            created_at=r.created_at,
        )
        for r in reminders
    ]


@router.delete("/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """Delete a reminder."""
    result = await db.execute(
        select(CalendarReminder).where(
            CalendarReminder.id == reminder_id,
            CalendarReminder.user_id == current_user.id,
        )
    )
    reminder = result.scalar_one_or_none()

    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reminder not found",
        )

    await db.delete(reminder)
    await db.commit()
