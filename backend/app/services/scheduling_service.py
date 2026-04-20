"""Scheduling and coordination service."""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EventStatus
from app.models.scheduled_event import ScheduledEvent
from app.models.user import User
from app.schemas.notification import CreateNotificationRequest

logger = logging.getLogger(__name__)


async def create_event(
    db: AsyncSession,
    event_data: dict[str, Any],
    organizer_id: uuid.UUID,
) -> ScheduledEvent:
    """Create a scheduled event and notify attendees."""
    from app.services.notification_service import notification_service

    event = ScheduledEvent(
        **event_data,
        organizer_id=organizer_id,
    )
    db.add(event)
    await db.flush()

    # Notify attendees
    if event.attendee_ids:
        organizer_result = await db.execute(select(User.full_name).where(User.id == organizer_id))
        organizer_name = organizer_result.scalar_one_or_none() or "Someone"

        for attendee_id in event.attendee_ids:
            if attendee_id != organizer_id:
                await notification_service.create_notification(
                    db,
                    CreateNotificationRequest(
                        user_id=attendee_id,
                        notification_type="system",
                        title=f"Event Invitation: {event.title}",
                        body=(
                            f"{organizer_name} invited you to "
                            f"'{event.title}' on "
                            f"{event.start_time.strftime('%b %d, %Y at %H:%M')} UTC."
                        ),
                        priority="normal",
                        entity_type="scheduled_event",
                        entity_id=event.id,
                    ),
                )

    await db.commit()
    await db.refresh(event)
    return event


async def check_conflicts(
    db: AsyncSession,
    user_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> list[ScheduledEvent]:
    """Check for overlapping events for a user."""
    result = await db.execute(
        select(ScheduledEvent).where(
            and_(
                or_(
                    ScheduledEvent.organizer_id == user_id,
                    ScheduledEvent.attendee_ids.any(user_id),  # type: ignore[arg-type]
                ),
                ScheduledEvent.status.notin_(["cancelled", "completed"]),
                ScheduledEvent.start_time < end,
                ScheduledEvent.end_time > start,
            )
        )
    )
    return list(result.scalars().all())


async def send_reminders(db: AsyncSession) -> int:
    """Find events starting within their reminder window and send notifications."""
    from app.services.notification_service import notification_service

    now = datetime.now(UTC)
    # Find events with various reminder windows (5 to 120 minutes)
    max_window = now + timedelta(minutes=120)

    result = await db.execute(
        select(ScheduledEvent).where(
            ScheduledEvent.status.in_(["scheduled", "confirmed"]),
            ScheduledEvent.start_time > now,
            ScheduledEvent.start_time <= max_window,
        )
    )
    events = result.scalars().all()

    reminders_sent = 0
    for event in events:
        minutes_until = (event.start_time - now).total_seconds() / 60
        # Only send if within the event's reminder window
        # Add a 5-minute buffer so we don't re-send every cycle
        if minutes_until <= event.reminder_minutes and minutes_until > (event.reminder_minutes - 6):
            # Collect all relevant user IDs
            notify_ids: set[uuid.UUID] = {event.organizer_id}
            if event.attendee_ids:
                notify_ids.update(event.attendee_ids)

            for uid in notify_ids:
                await notification_service.create_notification(
                    db,
                    CreateNotificationRequest(
                        user_id=uid,
                        notification_type="system",
                        title=f"Reminder: {event.title}",
                        body=(f"'{event.title}' starts in {int(minutes_until)} minutes."),
                        priority="normal",
                        entity_type="scheduled_event",
                        entity_id=event.id,
                    ),
                )
                reminders_sent += 1

    if reminders_sent > 0:
        await db.commit()

    return reminders_sent


async def update_event_status(
    db: AsyncSession,
    event_id: uuid.UUID,
    new_status: str,
    actor_id: uuid.UUID,
) -> ScheduledEvent | None:
    """Update event status and notify attendees."""
    from app.services.notification_service import notification_service

    result = await db.execute(select(ScheduledEvent).where(ScheduledEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        return None

    old_status = event.status
    event.status = EventStatus(new_status)
    event.updated_at = datetime.now(UTC)

    # Notify all participants of the status change
    notify_ids: set[uuid.UUID] = {event.organizer_id}
    if event.attendee_ids:
        notify_ids.update(event.attendee_ids)
    notify_ids.discard(actor_id)  # Don't notify the person who changed it

    actor_result = await db.execute(select(User.full_name).where(User.id == actor_id))
    actor_name = actor_result.scalar_one_or_none() or "Someone"

    for uid in notify_ids:
        await notification_service.create_notification(
            db,
            CreateNotificationRequest(
                user_id=uid,
                notification_type="system",
                title=f"Event {new_status}: {event.title}",
                body=(f"{actor_name} changed '{event.title}' from {old_status} to {new_status}."),
                priority="normal",
                entity_type="scheduled_event",
                entity_id=event.id,
            ),
        )

    await db.commit()
    await db.refresh(event)
    return event


async def get_user_schedule(
    db: AsyncSession,
    user_id: uuid.UUID,
    start_date: datetime,
    end_date: datetime,
) -> list[ScheduledEvent]:
    """Get all events for a user within a date range."""
    result = await db.execute(
        select(ScheduledEvent)
        .where(
            or_(
                ScheduledEvent.organizer_id == user_id,
                ScheduledEvent.attendee_ids.any(user_id),  # type: ignore[arg-type]
            ),
            ScheduledEvent.start_time < end_date,
            ScheduledEvent.end_time > start_date,
        )
        .order_by(ScheduledEvent.start_time)
    )
    return list(result.scalars().all())


async def get_event(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> ScheduledEvent | None:
    """Get a single event by ID."""
    result = await db.execute(select(ScheduledEvent).where(ScheduledEvent.id == event_id))
    return result.scalar_one_or_none()


async def update_event(
    db: AsyncSession,
    event_id: uuid.UUID,
    update_data: dict[str, Any],
) -> ScheduledEvent | None:
    """Update an event's fields."""
    result = await db.execute(select(ScheduledEvent).where(ScheduledEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        return None

    for key, value in update_data.items():
        if value is not None:
            setattr(event, key, value)
    event.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(event)
    return event


async def delete_event(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> bool:
    """Delete an event."""
    result = await db.execute(select(ScheduledEvent).where(ScheduledEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        return False

    await db.delete(event)
    await db.commit()
    return True


async def list_events(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    status: str | None = None,
    event_type: str | None = None,
) -> tuple[list[ScheduledEvent], int]:
    """List events with filters."""
    query = select(ScheduledEvent)
    count_query = select(func.count(ScheduledEvent.id))

    if status:
        query = query.where(ScheduledEvent.status == status)
        count_query = count_query.where(ScheduledEvent.status == status)
    if event_type:
        query = query.where(ScheduledEvent.event_type == event_type)
        count_query = count_query.where(ScheduledEvent.event_type == event_type)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(ScheduledEvent.start_time.desc())
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    events = list(result.scalars().all())

    return events, total
