"""Meeting scheduler service — availability management and booking logic."""

import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.meeting_slot import Meeting, RMAvailability, RMBlackout
from app.models.meeting_type import MeetingType
from app.models.scheduled_event import ScheduledEvent
from app.models.user import User
from app.schemas.meeting import AvailableSlot

logger = logging.getLogger(__name__)

# ─── Default meeting types to seed ────────────────────────────────────────────

DEFAULT_MEETING_TYPES = [
    {
        "slug": "quick_checkin",
        "label": "Quick Check-in",
        "duration_minutes": 15,
        "description": "A brief 15-minute touch-base with your Relationship Manager.",
        "display_order": 0,
    },
    {
        "slug": "standard",
        "label": "Standard Meeting",
        "duration_minutes": 30,
        "description": "A 30-minute meeting to discuss updates, questions, or next steps.",
        "display_order": 1,
    },
    {
        "slug": "extended",
        "label": "Extended Discussion",
        "duration_minutes": 60,
        "description": "A 60-minute in-depth session for strategic reviews or complex topics.",
        "display_order": 2,
    },
]


# ─── Seed helpers ─────────────────────────────────────────────────────────────


async def seed_meeting_types(db: AsyncSession) -> None:
    """Ensure the three default meeting types exist in the database."""
    for data in DEFAULT_MEETING_TYPES:
        result = await db.execute(select(MeetingType).where(MeetingType.slug == data["slug"]))
        if result.scalar_one_or_none() is None:
            db.add(MeetingType(**data))
    await db.commit()


# ─── Meeting Types ─────────────────────────────────────────────────────────────


async def list_meeting_types(db: AsyncSession) -> list[MeetingType]:
    """Return all active meeting types ordered by display_order."""
    result = await db.execute(
        select(MeetingType)
        .where(MeetingType.is_active.is_(True))
        .order_by(MeetingType.display_order)
    )
    return list(result.scalars().all())


async def get_meeting_type(db: AsyncSession, meeting_type_id: uuid.UUID) -> MeetingType | None:
    result = await db.execute(select(MeetingType).where(MeetingType.id == meeting_type_id))
    return result.scalar_one_or_none()


# ─── RM Availability ──────────────────────────────────────────────────────────


async def create_availability(
    db: AsyncSession,
    rm_id: uuid.UUID,
    data: dict[str, Any],
) -> RMAvailability:
    avail = RMAvailability(rm_id=rm_id, **data)
    db.add(avail)
    await db.commit()
    await db.refresh(avail)
    return avail


async def list_availability(
    db: AsyncSession,
    rm_id: uuid.UUID,
) -> list[RMAvailability]:
    result = await db.execute(
        select(RMAvailability)
        .where(RMAvailability.rm_id == rm_id, RMAvailability.is_active.is_(True))
        .order_by(RMAvailability.day_of_week, RMAvailability.start_time)
    )
    return list(result.scalars().all())


async def update_availability(
    db: AsyncSession,
    slot_id: uuid.UUID,
    rm_id: uuid.UUID,
    data: dict[str, Any],
) -> RMAvailability | None:
    result = await db.execute(
        select(RMAvailability).where(RMAvailability.id == slot_id, RMAvailability.rm_id == rm_id)
    )
    avail = result.scalar_one_or_none()
    if not avail:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(avail, key, value)
    await db.commit()
    await db.refresh(avail)
    return avail


async def delete_availability(
    db: AsyncSession,
    slot_id: uuid.UUID,
    rm_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(RMAvailability).where(RMAvailability.id == slot_id, RMAvailability.rm_id == rm_id)
    )
    avail = result.scalar_one_or_none()
    if not avail:
        return False
    await db.delete(avail)
    await db.commit()
    return True


# ─── Blackouts ────────────────────────────────────────────────────────────────


async def create_blackout(
    db: AsyncSession,
    rm_id: uuid.UUID,
    blackout_date: date,
    reason: str | None,
) -> RMBlackout:
    blackout = RMBlackout(rm_id=rm_id, blackout_date=blackout_date, reason=reason)
    db.add(blackout)
    await db.commit()
    await db.refresh(blackout)
    return blackout


async def list_blackouts(
    db: AsyncSession,
    rm_id: uuid.UUID,
    from_date: date | None = None,
) -> list[RMBlackout]:
    query = select(RMBlackout).where(RMBlackout.rm_id == rm_id)
    if from_date:
        query = query.where(RMBlackout.blackout_date >= from_date)
    query = query.order_by(RMBlackout.blackout_date)
    result = await db.execute(query)
    return list(result.scalars().all())


async def delete_blackout(
    db: AsyncSession,
    blackout_id: uuid.UUID,
    rm_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(RMBlackout).where(RMBlackout.id == blackout_id, RMBlackout.rm_id == rm_id)
    )
    blackout = result.scalar_one_or_none()
    if not blackout:
        return False
    await db.delete(blackout)
    await db.commit()
    return True


# ─── Available Slot Computation ───────────────────────────────────────────────


async def get_available_slots(
    db: AsyncSession,
    rm_id: uuid.UUID,
    meeting_type_id: uuid.UUID,
    from_date: date,
    to_date: date,
) -> list[AvailableSlot]:
    """Compute available booking slots for an RM over a date range.

    Algorithm:
    1. Load the RM's active weekly availability windows
    2. Load blackout dates in range
    3. Load existing confirmed/pending meetings in range (conflicts)
    4. For each day in range → if not blacked out and has availability windows:
       - Walk the window in meeting_duration + buffer steps
       - Emit a slot if it doesn't conflict with an existing meeting
    """
    meeting_type = await get_meeting_type(db, meeting_type_id)
    if not meeting_type:
        return []

    duration_minutes = meeting_type.duration_minutes

    # Load availability windows
    avail_result = await db.execute(
        select(RMAvailability).where(
            RMAvailability.rm_id == rm_id, RMAvailability.is_active.is_(True)
        )
    )
    avail_windows = avail_result.scalars().all()

    # Group by day_of_week
    avail_by_dow: dict[int, list[RMAvailability]] = {}
    for window in avail_windows:
        avail_by_dow.setdefault(window.day_of_week, []).append(window)

    # Load blackout dates
    blackout_result = await db.execute(
        select(RMBlackout.blackout_date).where(
            RMBlackout.rm_id == rm_id,
            RMBlackout.blackout_date >= from_date,
            RMBlackout.blackout_date <= to_date,
        )
    )
    blackout_dates: set[date] = set(blackout_result.scalars().all())

    # Load existing meetings for this RM in range (pending + confirmed)
    range_start = datetime(from_date.year, from_date.month, from_date.day, tzinfo=UTC)
    range_end = datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=UTC)
    meetings_result = await db.execute(
        select(Meeting).where(
            Meeting.rm_id == rm_id,
            Meeting.status.in_(["pending", "confirmed"]),
            Meeting.start_time < range_end,
            Meeting.end_time > range_start,
        )
    )
    existing_meetings = meetings_result.scalars().all()
    busy_intervals = [(m.start_time, m.end_time) for m in existing_meetings]

    slots: list[AvailableSlot] = []
    now = datetime.now(UTC)

    day_cursor = from_date
    while day_cursor <= to_date:
        # ISO weekday: Mon=1 … Sun=7 → we use 0-indexed: Mon=0 … Sun=6
        dow = day_cursor.isoweekday() - 1  # 0 = Monday

        if day_cursor not in blackout_dates and dow in avail_by_dow:
            for window in avail_by_dow[dow]:
                buffer = window.buffer_minutes
                step = timedelta(minutes=duration_minutes + buffer)

                # Build candidate slot start times
                slot_start = datetime(
                    day_cursor.year,
                    day_cursor.month,
                    day_cursor.day,
                    window.start_time.hour,
                    window.start_time.minute,
                    tzinfo=UTC,
                )
                window_end = datetime(
                    day_cursor.year,
                    day_cursor.month,
                    day_cursor.day,
                    window.end_time.hour,
                    window.end_time.minute,
                    tzinfo=UTC,
                )

                while True:
                    slot_end = slot_start + timedelta(minutes=duration_minutes)
                    if slot_end > window_end:
                        break
                    # Must be in the future (with 30-min grace)
                    if slot_start <= now + timedelta(minutes=30):
                        slot_start += step
                        continue
                    # Check for conflicts
                    if not _has_conflict(slot_start, slot_end, busy_intervals):
                        slots.append(
                            AvailableSlot(
                                start_time=slot_start,
                                end_time=slot_end,
                                date=day_cursor,
                                rm_id=rm_id,
                            )
                        )
                    slot_start += step

        day_cursor += timedelta(days=1)

    return slots


def _has_conflict(
    start: datetime,
    end: datetime,
    busy: list[tuple[datetime, datetime]],
) -> bool:
    return any(start < b_end and end > b_start for b_start, b_end in busy)


# ─── Booking ──────────────────────────────────────────────────────────────────


async def book_meeting(
    db: AsyncSession,
    client_id: uuid.UUID,
    booked_by_user_id: uuid.UUID,
    rm_id: uuid.UUID,
    meeting_type_id: uuid.UUID,
    start_time: datetime,
    timezone: str,
    agenda: str | None,
) -> Meeting:
    """Book a meeting and notify both parties."""
    from app.schemas.notification import CreateNotificationRequest
    from app.services.notification_service import notification_service

    meeting_type = await get_meeting_type(db, meeting_type_id)
    if not meeting_type:
        raise ValueError("Invalid meeting type")

    end_time = start_time + timedelta(minutes=meeting_type.duration_minutes)

    # Validate slot is still available
    existing = await db.execute(
        select(Meeting).where(
            Meeting.rm_id == rm_id,
            Meeting.status.in_(["pending", "confirmed"]),
            Meeting.start_time < end_time,
            Meeting.end_time > start_time,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("The selected time slot is no longer available")

    meeting = Meeting(
        meeting_type_id=meeting_type_id,
        rm_id=rm_id,
        client_id=client_id,
        booked_by_user_id=booked_by_user_id,
        start_time=start_time,
        end_time=end_time,
        timezone=timezone,
        status="pending",
        agenda=agenda,
    )
    db.add(meeting)
    await db.flush()

    # Fetch names for notifications
    rm_result = await db.execute(select(User.full_name).where(User.id == rm_id))
    rm_name = rm_result.scalar_one_or_none() or "Your RM"

    client_user_result = await db.execute(
        select(User.full_name).where(User.id == booked_by_user_id)
    )
    client_name = client_user_result.scalar_one_or_none() or "Your client"

    formatted_time = start_time.strftime("%b %d, %Y at %H:%M UTC")

    # Notify RM
    await notification_service.create_notification(
        db,
        CreateNotificationRequest(
            user_id=rm_id,
            notification_type="system",
            title=f"New Meeting Request: {meeting_type.label}",
            body=(
                f"{client_name} has requested a {meeting_type.label} "
                f"({meeting_type.duration_minutes} min) on {formatted_time}."
            ),
            priority="normal",
            entity_type="meeting",
            entity_id=meeting.id,
        ),
    )

    # Notify client (confirmation receipt)
    await notification_service.create_notification(
        db,
        CreateNotificationRequest(
            user_id=booked_by_user_id,
            notification_type="system",
            title=f"Meeting Request Sent: {meeting_type.label}",
            body=(
                f"Your {meeting_type.label} with {rm_name} on {formatted_time} "
                f"has been requested and is awaiting confirmation."
            ),
            priority="normal",
            entity_type="meeting",
            entity_id=meeting.id,
        ),
    )

    await db.commit()
    await db.refresh(meeting)

    # Eagerly load meeting_type relationship
    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.meeting_type)).where(Meeting.id == meeting.id)
    )
    return result.scalar_one()


async def confirm_meeting(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    rm_id: uuid.UUID,
) -> Meeting | None:
    """RM confirms a pending meeting."""
    from app.schemas.notification import CreateNotificationRequest
    from app.services.notification_service import notification_service

    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.meeting_type))
        .where(Meeting.id == meeting_id, Meeting.rm_id == rm_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        return None

    meeting.status = "confirmed"

    # Create a ScheduledEvent for calendar integration
    if not meeting.scheduled_event_id:
        mt_label = meeting.meeting_type.label if meeting.meeting_type else "Meeting"
        event = ScheduledEvent(
            title=mt_label,
            description=meeting.agenda,
            event_type="meeting",
            start_time=meeting.start_time,
            end_time=meeting.end_time,
            timezone=meeting.timezone,
            organizer_id=rm_id,
            client_id=meeting.client_id,
            attendee_ids=[meeting.booked_by_user_id],
            status="confirmed",
            reminder_minutes=30,
            notes=meeting.agenda,
        )
        db.add(event)
        await db.flush()
        meeting.scheduled_event_id = event.id

    formatted_time = meeting.start_time.strftime("%b %d, %Y at %H:%M UTC")
    mt_label = meeting.meeting_type.label if meeting.meeting_type else "Meeting"

    await notification_service.create_notification(
        db,
        CreateNotificationRequest(
            user_id=meeting.booked_by_user_id,
            notification_type="system",
            title=f"Meeting Confirmed: {mt_label}",
            body=f"Your {mt_label} has been confirmed for {formatted_time}.",
            priority="normal",
            entity_type="meeting",
            entity_id=meeting.id,
        ),
    )

    await db.commit()
    await db.refresh(meeting)
    return meeting


async def cancel_meeting(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    cancelled_by_id: uuid.UUID,
    reason: str | None,
) -> Meeting | None:
    """Cancel a meeting. Can be initiated by either the RM or the client."""
    from app.schemas.notification import CreateNotificationRequest
    from app.services.notification_service import notification_service

    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.meeting_type)).where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        return None

    meeting.status = "cancelled"
    meeting.cancelled_by_id = cancelled_by_id
    meeting.cancellation_reason = reason

    actor_result = await db.execute(select(User.full_name).where(User.id == cancelled_by_id))
    actor_name = actor_result.scalar_one_or_none() or "Someone"

    mt_label = meeting.meeting_type.label if meeting.meeting_type else "Meeting"
    formatted_time = meeting.start_time.strftime("%b %d, %Y at %H:%M UTC")

    # Notify the other party
    notify_ids: set[uuid.UUID] = {meeting.rm_id, meeting.booked_by_user_id}
    notify_ids.discard(cancelled_by_id)

    for uid in notify_ids:
        await notification_service.create_notification(
            db,
            CreateNotificationRequest(
                user_id=uid,
                notification_type="system",
                title=f"Meeting Cancelled: {mt_label}",
                body=(
                    f"{actor_name} has cancelled the {mt_label} scheduled for "
                    f"{formatted_time}." + (f" Reason: {reason}" if reason else "")
                ),
                priority="normal",
                entity_type="meeting",
                entity_id=meeting.id,
            ),
        )

    await db.commit()
    await db.refresh(meeting)
    return meeting


async def reschedule_meeting(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    requested_by_id: uuid.UUID,
    new_start_time: datetime,
    timezone: str | None,
    reason: str | None,
) -> Meeting | None:
    """Cancel the existing meeting and book a replacement, linked via reschedule_of_id."""
    from app.schemas.notification import CreateNotificationRequest
    from app.services.notification_service import notification_service

    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.meeting_type)).where(Meeting.id == meeting_id)
    )
    old_meeting = result.scalar_one_or_none()
    if not old_meeting:
        return None

    # Cancel the old meeting silently first
    old_meeting.status = "cancelled"
    old_meeting.cancelled_by_id = requested_by_id
    old_meeting.cancellation_reason = reason or "Rescheduled"

    duration = old_meeting.meeting_type.duration_minutes if old_meeting.meeting_type else 30
    new_end_time = new_start_time + timedelta(minutes=duration)

    new_meeting = Meeting(
        meeting_type_id=old_meeting.meeting_type_id,
        rm_id=old_meeting.rm_id,
        client_id=old_meeting.client_id,
        booked_by_user_id=old_meeting.booked_by_user_id,
        start_time=new_start_time,
        end_time=new_end_time,
        timezone=timezone or old_meeting.timezone,
        status="pending",
        agenda=old_meeting.agenda,
        reschedule_of_id=old_meeting.id,
    )
    db.add(new_meeting)
    await db.flush()

    actor_result = await db.execute(select(User.full_name).where(User.id == requested_by_id))
    actor_name = actor_result.scalar_one_or_none() or "Someone"

    mt_label = old_meeting.meeting_type.label if old_meeting.meeting_type else "Meeting"
    new_time_str = new_start_time.strftime("%b %d, %Y at %H:%M UTC")

    notify_ids: set[uuid.UUID] = {old_meeting.rm_id, old_meeting.booked_by_user_id}
    notify_ids.discard(requested_by_id)

    for uid in notify_ids:
        await notification_service.create_notification(
            db,
            CreateNotificationRequest(
                user_id=uid,
                notification_type="system",
                title=f"Meeting Rescheduled: {mt_label}",
                body=(f"{actor_name} has rescheduled the {mt_label} to {new_time_str}."),
                priority="normal",
                entity_type="meeting",
                entity_id=new_meeting.id,
            ),
        )

    await db.commit()
    await db.refresh(new_meeting)

    # Load eager relations
    final_result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.meeting_type))
        .where(Meeting.id == new_meeting.id)
    )
    return final_result.scalar_one()


# ─── Listing ──────────────────────────────────────────────────────────────────


async def list_meetings(
    db: AsyncSession,
    *,
    rm_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Meeting], int]:
    query = select(Meeting).options(selectinload(Meeting.meeting_type))
    count_query = select(func.count(Meeting.id))

    filters = []
    if rm_id:
        filters.append(Meeting.rm_id == rm_id)
    if client_id:
        filters.append(Meeting.client_id == client_id)
    if status:
        filters.append(Meeting.status == status)

    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Meeting.start_time.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_meeting(
    db: AsyncSession,
    meeting_id: uuid.UUID,
) -> Meeting | None:
    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.meeting_type)).where(Meeting.id == meeting_id)
    )
    return result.scalar_one_or_none()


async def get_client_for_user(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> Client | None:
    """Return the Client record linked to a user via their ClientProfile.

    Uses the same resolution pattern as the client portal:
    User → ClientProfile (via user_id) → Client (matched by legal_name + rm_id).
    """
    from app.models.client_profile import ClientProfile

    profile_result = await db.execute(select(ClientProfile).where(ClientProfile.user_id == user_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return None

    client_query = select(Client).where(Client.name == profile.legal_name)
    if profile.assigned_rm_id is not None:
        client_query = client_query.where(Client.rm_id == profile.assigned_rm_id)
    client_result = await db.execute(client_query.limit(1))
    return client_result.scalar_one_or_none()
