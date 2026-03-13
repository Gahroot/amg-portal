"""Calendar integration service supporting Google and Outlook calendars."""

import logging
import secrets
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.calendar import CalendarConnection, CalendarEvent, CalendarReminder
from app.models.enums import CalendarProvider
from app.models.milestone import Milestone
from app.models.program import Program
from app.schemas.calendar import (
    AvailabilityResponse,
    AvailabilitySlot,
    SyncMilestoneResponse,
    TimeSlot,
    UserAvailabilityResponse,
)

logger = logging.getLogger(__name__)


class CalendarProviderService(ABC):
    """Abstract base class for calendar provider implementations."""

    @abstractmethod
    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Generate OAuth authorization URL."""
        ...

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> dict[str, Any]:
        """Exchange authorization code for tokens."""
        ...

    @abstractmethod
    async def refresh_access_token(self, connection: CalendarConnection) -> str:
        """Refresh expired access token."""
        ...

    @abstractmethod
    async def get_calendars(self, access_token: str) -> list[dict[str, Any]]:
        """Get list of available calendars."""
        ...

    @abstractmethod
    async def create_event(
        self,
        access_token: str,
        calendar_id: str,
        title: str,
        description: str,
        start_time: datetime,
        end_time: datetime,
        reminder_minutes: int | None = None,
    ) -> dict[str, Any]:
        """Create a calendar event."""
        ...

    @abstractmethod
    async def update_event(
        self,
        access_token: str,
        calendar_id: str,
        event_id: str,
        title: str,
        description: str,
        start_time: datetime,
        end_time: datetime,
        reminder_minutes: int | None = None,
    ) -> dict[str, Any]:
        """Update a calendar event."""
        ...

    @abstractmethod
    async def delete_event(self, access_token: str, calendar_id: str, event_id: str) -> bool:
        """Delete a calendar event."""
        ...

    @abstractmethod
    async def get_availability(
        self,
        access_token: str,
        calendar_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> list[dict[str, Any]]:
        """Get busy/free availability for a time range."""
        ...


class GoogleCalendarService(CalendarProviderService):
    """Google Calendar API integration."""

    AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    API_BASE = "https://www.googleapis.com/calendar/v3"

    SCOPES = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.readonly",
    ]

    def __init__(self, client_id: str | None = None, client_secret: str | None = None) -> Any:
        self.client_id = client_id or getattr(settings, "GOOGLE_CLIENT_ID", None)
        self.client_secret = client_secret or getattr(settings, "GOOGLE_CLIENT_SECRET", None)

    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Generate Google OAuth authorization URL."""
        import urllib.parse

        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"{self.AUTH_URL}?{urllib.parse.urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> dict[str, Any]:
        """Exchange authorization code for tokens."""
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            response.raise_for_status()
            return response.json()

    async def refresh_access_token(self, connection: CalendarConnection) -> str:
        """Refresh Google access token."""
        import httpx

        if not connection.refresh_token:
            raise ValueError("No refresh token available")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "refresh_token": connection.refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "refresh_token",
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["access_token"]

    async def _get_user_info(self, access_token: str) -> dict[str, Any]:
        """Get user info from Google."""
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    async def get_calendars(self, access_token: str) -> list[dict[str, Any]]:
        """Get list of Google calendars."""
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.API_BASE}/users/me/calendarList",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()
            return [
                {
                    "id": cal["id"],
                    "name": cal.get("summary", cal["id"]),
                    "is_primary": cal.get("primary", False),
                }
                for cal in data.get("items", [])
            ]

    async def create_event(
        self,
        access_token: str,
        calendar_id: str,
        title: str,
        description: str,
        start_time: datetime,
        end_time: datetime,
        reminder_minutes: int | None = None,
    ) -> dict[str, Any]:
        """Create a Google Calendar event."""
        import httpx

        event_data = {
            "summary": title,
            "description": description,
            "start": {"dateTime": start_time.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": end_time.isoformat(), "timeZone": "UTC"},
        }

        if reminder_minutes is not None:
            event_data["reminders"] = {
                "useDefault": False,
                "overrides": [{"method": "popup", "minutes": reminder_minutes}],
            }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.API_BASE}/calendars/{calendar_id}/events",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=event_data,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "id": data["id"],
                "htmlLink": data.get("htmlLink"),
                "status": data.get("status", "confirmed"),
            }

    async def update_event(
        self,
        access_token: str,
        calendar_id: str,
        event_id: str,
        title: str,
        description: str,
        start_time: datetime,
        end_time: datetime,
        reminder_minutes: int | None = None,
    ) -> dict[str, Any]:
        """Update a Google Calendar event."""
        import httpx

        event_data = {
            "summary": title,
            "description": description,
            "start": {"dateTime": start_time.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": end_time.isoformat(), "timeZone": "UTC"},
        }

        if reminder_minutes is not None:
            event_data["reminders"] = {
                "useDefault": False,
                "overrides": [{"method": "popup", "minutes": reminder_minutes}],
            }

        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self.API_BASE}/calendars/{calendar_id}/events/{event_id}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=event_data,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "id": data["id"],
                "htmlLink": data.get("htmlLink"),
                "status": data.get("status", "confirmed"),
            }

    async def delete_event(self, access_token: str, calendar_id: str, event_id: str) -> bool:
        """Delete a Google Calendar event."""
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.API_BASE}/calendars/{calendar_id}/events/{event_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            return response.status_code == 204

    async def get_availability(
        self,
        access_token: str,
        calendar_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> list[dict[str, Any]]:
        """Get busy/free availability from Google Calendar."""
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.API_BASE}/freeBusy",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "timeMin": start_time.isoformat() + "Z",
                    "timeMax": end_time.isoformat() + "Z",
                    "items": [{"id": calendar_id}],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("calendars", {}).get(calendar_id, {}).get("busy", [])


class OutlookCalendarService(CalendarProviderService):
    """Microsoft Outlook Calendar API integration using Microsoft Graph."""

    AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    GRAPH_BASE = "https://graph.microsoft.com/v1.0"

    SCOPES = [
        "offline_access",
        "Calendars.ReadWrite",
        "Calendars.Read",
        "User.Read",
    ]

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        tenant_id: str | None = None,
    ):
        self.client_id = client_id or getattr(settings, "OUTLOOK_CLIENT_ID", None)
        self.client_secret = client_secret or getattr(settings, "OUTLOOK_CLIENT_SECRET", None)
        self.tenant_id = tenant_id or getattr(settings, "OUTLOOK_TENANT_ID", "common")

    @property
    def auth_url(self) -> str:
        if self.tenant_id and self.tenant_id != "common":
            return f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/authorize"
        return self.AUTH_URL

    @property
    def token_url(self) -> str:
        if self.tenant_id and self.tenant_id != "common":
            return f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        return self.TOKEN_URL

    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Generate Microsoft OAuth authorization URL."""
        import urllib.parse

        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.SCOPES),
            "response_mode": "query",
            "state": state,
            "prompt": "consent",
        }
        return f"{self.auth_url}?{urllib.parse.urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> dict[str, Any]:
        """Exchange authorization code for tokens."""
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            response.raise_for_status()
            return response.json()

    async def refresh_access_token(self, connection: CalendarConnection) -> str:
        """Refresh Microsoft access token."""
        import httpx

        if not connection.refresh_token:
            raise ValueError("No refresh token available")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "refresh_token": connection.refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "refresh_token",
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["access_token"]

    async def get_calendars(self, access_token: str) -> list[dict[str, Any]]:
        """Get list of Outlook calendars."""
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GRAPH_BASE}/me/calendars",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()
            return [
                {
                    "id": cal["id"],
                    "name": cal.get("name", cal["id"]),
                    "is_primary": cal.get("isDefaultCalendar", False),
                }
                for cal in data.get("value", [])
            ]

    async def create_event(
        self,
        access_token: str,
        calendar_id: str,
        title: str,
        description: str,
        start_time: datetime,
        end_time: datetime,
        reminder_minutes: int | None = None,
    ) -> dict[str, Any]:
        """Create an Outlook Calendar event."""
        import httpx

        event_data = {
            "subject": title,
            "body": {"contentType": "text", "content": description},
            "start": {"dateTime": start_time.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
            "end": {"dateTime": end_time.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
        }

        if reminder_minutes is not None:
            event_data["isReminderOn"] = True
            event_data["reminderMinutesBeforeStart"] = reminder_minutes

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.GRAPH_BASE}/me/calendars/{calendar_id}/events",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=event_data,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "id": data["id"],
                "htmlLink": data.get("webLink"),
                "status": "confirmed"
                if data.get("responseStatus", {}).get("response") != "declined"
                else "cancelled",
            }

    async def update_event(
        self,
        access_token: str,
        calendar_id: str,
        event_id: str,
        title: str,
        description: str,
        start_time: datetime,
        end_time: datetime,
        reminder_minutes: int | None = None,
    ) -> dict[str, Any]:
        """Update an Outlook Calendar event."""
        import httpx

        event_data = {
            "subject": title,
            "body": {"contentType": "text", "content": description},
            "start": {"dateTime": start_time.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
            "end": {"dateTime": end_time.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
        }

        if reminder_minutes is not None:
            event_data["isReminderOn"] = True
            event_data["reminderMinutesBeforeStart"] = reminder_minutes

        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.GRAPH_BASE}/me/calendars/{calendar_id}/events/{event_id}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=event_data,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "id": data["id"],
                "htmlLink": data.get("webLink"),
                "status": "confirmed",
            }

    async def delete_event(self, access_token: str, calendar_id: str, event_id: str) -> bool:
        """Delete an Outlook Calendar event."""
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.GRAPH_BASE}/me/calendars/{calendar_id}/events/{event_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            return response.status_code == 204

    async def get_availability(
        self,
        access_token: str,
        calendar_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> list[dict[str, Any]]:
        """Get busy/free availability from Outlook Calendar."""
        import httpx

        async with httpx.AsyncClient() as client:
            # Use the schedule endpoint for availability
            response = await client.post(
                f"{self.GRAPH_BASE}/me/calendar/getSchedule",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "Prefer": 'outlook.timezone="UTC"',
                },
                json={
                    "schedules": [calendar_id],
                    "startTime": {
                        "dateTime": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
                        "timeZone": "UTC",
                    },
                    "endTime": {
                        "dateTime": end_time.strftime("%Y-%m-%dT%H:%M:%S"),
                        "timeZone": "UTC",
                    },
                    "availabilityViewInterval": 30,
                },
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("value", [])
            return []


class CalendarService:
    """Main calendar service coordinating provider-specific implementations."""

    def __init__(self) -> Any:
        self._providers: dict[CalendarProvider, CalendarProviderService] = {}

    def get_provider(self, provider: CalendarProvider) -> CalendarProviderService:
        """Get the appropriate provider service."""
        if provider not in self._providers:
            if provider == CalendarProvider.google:
                self._providers[provider] = GoogleCalendarService()
            elif provider == CalendarProvider.outlook:
                self._providers[provider] = OutlookCalendarService()
            else:
                raise ValueError(f"Unsupported calendar provider: {provider}")
        return self._providers[provider]

    def generate_state(self) -> str:
        """Generate a secure state parameter for OAuth."""
        return secrets.token_urlsafe(32)

    async def get_authorization_url(
        self,
        provider: CalendarProvider,
        redirect_uri: str,
        state: str,
    ) -> str:
        """Get OAuth authorization URL for a calendar provider."""
        service = self.get_provider(provider)
        return service.get_authorization_url(redirect_uri, state)

    async def complete_oauth(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        provider: CalendarProvider,
        code: str,
        redirect_uri: str,
    ) -> CalendarConnection:
        """Complete OAuth flow and create calendar connection."""
        service = self.get_provider(provider)
        token_data = await service.exchange_code(code, redirect_uri)

        # Get user info and calendars
        access_token = token_data["access_token"]
        calendars = await service.get_calendars(access_token)

        # Find primary calendar
        primary_cal = next(
            (c for c in calendars if c.get("is_primary")), calendars[0] if calendars else None
        )

        # Check for existing connection
        result = await db.execute(
            select(CalendarConnection).where(
                CalendarConnection.user_id == user_id,
                CalendarConnection.provider == provider.value,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing connection
            existing.access_token = access_token
            existing.refresh_token = token_data.get("refresh_token") or existing.refresh_token
            existing.is_active = True
            if token_data.get("expires_in"):
                existing.token_expires_at = datetime.utcnow() + timedelta(
                    seconds=token_data["expires_in"]
                )
            if primary_cal:
                existing.calendar_id = primary_cal["id"]
                existing.calendar_name = primary_cal["name"]
            existing.sync_error = None
            connection = existing
        else:
            # Create new connection
            connection = CalendarConnection(
                user_id=user_id,
                provider=provider.value,
                access_token=access_token,
                refresh_token=token_data.get("refresh_token"),
                calendar_id=primary_cal["id"] if primary_cal else None,
                calendar_name=primary_cal["name"] if primary_cal else None,
                is_primary=True,
                sync_milestones=True,
            )
            if token_data.get("expires_in"):
                connection.token_expires_at = datetime.utcnow() + timedelta(
                    seconds=token_data["expires_in"]
                )
            db.add(connection)

        await db.commit()
        await db.refresh(connection)
        return connection

    async def get_connections(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[CalendarConnection]:
        """Get all calendar connections for a user."""
        result = await db.execute(
            select(CalendarConnection).where(CalendarConnection.user_id == user_id)
        )
        return list(result.scalars().all())

    async def get_connection(
        self,
        db: AsyncSession,
        connection_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> CalendarConnection | None:
        """Get a specific calendar connection."""
        result = await db.execute(
            select(CalendarConnection).where(
                CalendarConnection.id == connection_id,
                CalendarConnection.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_connection(
        self,
        db: AsyncSession,
        connection: CalendarConnection,
        **kwargs: Any,
    ) -> CalendarConnection:
        """Update calendar connection settings."""
        for key, value in kwargs.items():
            if hasattr(connection, key):
                setattr(connection, key, value)
        await db.commit()
        await db.refresh(connection)
        return connection

    async def delete_connection(
        self,
        db: AsyncSession,
        connection: CalendarConnection,
    ) -> None:
        """Delete a calendar connection."""
        await db.delete(connection)
        await db.commit()

    async def get_available_calendars(
        self,
        db: AsyncSession,
        connection: CalendarConnection,
    ) -> list[dict[str, Any]]:
        """Get list of calendars from the provider."""
        service = self.get_provider(CalendarProvider(connection.provider))
        access_token = await self._ensure_valid_token(connection, service)
        return await service.get_calendars(access_token)

    async def sync_milestone_to_calendar(
        self,
        db: AsyncSession,
        milestone: Milestone,
        connection: CalendarConnection,
        event_title: str | None = None,
        event_description: str | None = None,
        reminder_minutes: int | None = None,
    ) -> SyncMilestoneResponse:
        """Sync a milestone to a user's calendar."""
        if not milestone.due_date:
            raise ValueError("Milestone must have a due date to sync to calendar")

        service = self.get_provider(CalendarProvider(connection.provider))
        access_token = await self._ensure_valid_token(connection, service)

        # Build event details
        title = event_title or f"Milestone: {milestone.title}"
        description = event_description or milestone.description or ""

        # Get program info for context
        result = await db.execute(select(Program).where(Program.id == milestone.program_id))
        program = result.scalar_one_or_none()
        if program:
            description = f"Program: {program.title}\n\n{description}"

        # Set event time (all-day event at due date)
        start_time = datetime.combine(milestone.due_date, datetime.min.time())
        end_time = start_time + timedelta(hours=1)

        # Check for existing event
        result = await db.execute(
            select(CalendarEvent).where(
                CalendarEvent.connection_id == connection.id,
                CalendarEvent.milestone_id == milestone.id,
            )
        )
        existing_event = result.scalar_one_or_none()

        reminder = reminder_minutes or connection.reminder_minutes

        try:
            if existing_event:
                # Update existing event
                event_data = await service.update_event(
                    access_token,
                    connection.calendar_id or "primary",
                    existing_event.external_event_id,
                    title,
                    description,
                    start_time,
                    end_time,
                    reminder,
                )
                existing_event.last_synced_at = datetime.utcnow()
                existing_event.event_url = event_data.get("htmlLink")
                existing_event.status = event_data.get("status", "confirmed")
                await db.commit()
                await db.refresh(existing_event)

                return SyncMilestoneResponse(
                    calendar_event_id=existing_event.id,
                    external_event_id=existing_event.external_event_id,
                    event_url=existing_event.event_url,
                    status=existing_event.status,
                )
            else:
                # Create new event
                event_data = await service.create_event(
                    access_token,
                    connection.calendar_id or "primary",
                    title,
                    description,
                    start_time,
                    end_time,
                    reminder,
                )

                calendar_event = CalendarEvent(
                    connection_id=connection.id,
                    milestone_id=milestone.id,
                    external_event_id=event_data["id"],
                    event_url=event_data.get("htmlLink"),
                    status=event_data.get("status", "confirmed"),
                )
                db.add(calendar_event)
                await db.commit()
                await db.refresh(calendar_event)

                return SyncMilestoneResponse(
                    calendar_event_id=calendar_event.id,
                    external_event_id=calendar_event.external_event_id,
                    event_url=calendar_event.event_url,
                    status=calendar_event.status,
                )
        except Exception as e:
            connection.sync_error = str(e)
            await db.commit()
            raise

    async def unsync_milestone(
        self,
        db: AsyncSession,
        milestone_id: uuid.UUID,
        connection_id: uuid.UUID,
    ) -> None:
        """Remove a milestone's event from the calendar."""
        result = await db.execute(
            select(CalendarEvent)
            .options(selectinload(CalendarEvent.connection))
            .where(
                CalendarEvent.connection_id == connection_id,
                CalendarEvent.milestone_id == milestone_id,
            )
        )
        calendar_event = result.scalar_one_or_none()

        if not calendar_event:
            return

        connection = calendar_event.connection
        service = self.get_provider(CalendarProvider(connection.provider))

        try:
            access_token = await self._ensure_valid_token(connection, service)
            await service.delete_event(
                access_token,
                connection.calendar_id or "primary",
                calendar_event.external_event_id,
            )
        except Exception as e:
            logger.warning("Failed to delete calendar event: %s", e)

        await db.delete(calendar_event)
        await db.commit()

    async def check_availability(
        self,
        db: AsyncSession,
        user_ids: list[uuid.UUID],
        start_time: datetime,
        end_time: datetime,
    ) -> AvailabilityResponse:
        """Check availability for multiple users."""
        user_availabilities: list[UserAvailabilityResponse] = []

        for user_id in user_ids:
            result = await db.execute(
                select(CalendarConnection)
                .options(selectinload(CalendarConnection.user))
                .where(
                    CalendarConnection.user_id == user_id,
                    CalendarConnection.is_active == True,  # noqa: E712
                )
            )
            connections = result.scalars().all()

            if not connections:
                user_availabilities.append(
                    UserAvailabilityResponse(
                        user_id=user_id,
                        user_name=None,
                        slots=[],
                        has_calendar=False,
                    )
                )
                continue

            # Get availability from first active connection
            connection = connections[0]
            service = self.get_provider(CalendarProvider(connection.provider))

            try:
                access_token = await self._ensure_valid_token(connection, service)
                busy_periods = await service.get_availability(
                    access_token,
                    connection.calendar_id or "primary",
                    start_time,
                    end_time,
                )

                # Convert busy periods to slots
                slots = self._build_availability_slots(start_time, end_time, busy_periods)

                user_availabilities.append(
                    UserAvailabilityResponse(
                        user_id=user_id,
                        user_name=connection.user.full_name if connection.user else None,
                        slots=slots,
                        has_calendar=True,
                    )
                )
            except Exception as e:
                logger.warning("Failed to get availability for user %s: %s", user_id, e)
                user_availabilities.append(
                    UserAvailabilityResponse(
                        user_id=user_id,
                        user_name=None,
                        slots=[
                            AvailabilitySlot(
                                start_time=start_time,
                                end_time=end_time,
                                status=TimeSlot.unknown,
                            )
                        ],
                        has_calendar=True,
                    )
                )

        return AvailabilityResponse(
            start_time=start_time,
            end_time=end_time,
            users=user_availabilities,
        )

    def _build_availability_slots(
        self,
        start_time: datetime,
        end_time: datetime,
        busy_periods: list[dict[str, Any]],
    ) -> list[AvailabilitySlot]:
        """Build availability slots from busy periods."""
        slots: list[AvailabilitySlot] = []

        if not busy_periods:
            return [
                AvailabilitySlot(
                    start_time=start_time,
                    end_time=end_time,
                    status=TimeSlot.free,
                )
            ]

        # Sort busy periods by start time
        sorted_busy = sorted(
            busy_periods,
            key=lambda x: (
                x.get("start", "")
                if isinstance(x.get("start"), str)
                else x.get("start", {}).get("dateTime", "")
            ),
        )

        current = start_time
        for busy in sorted_busy:
            # Handle both Google and Outlook formats
            busy_start_raw = busy.get("start")
            busy_end_raw = busy.get("end")

            if isinstance(busy_start_raw, str):
                busy_start = datetime.fromisoformat(busy_start_raw.replace("Z", "+00:00"))
                busy_end = datetime.fromisoformat(busy_end_raw.replace("Z", "+00:00"))
            else:
                busy_start = datetime.fromisoformat(
                    busy_start_raw.get("dateTime", "").replace("Z", "+00:00")
                )
                busy_end = datetime.fromisoformat(
                    busy_end_raw.get("dateTime", "").replace("Z", "+00:00")
                )

            # Add free slot before busy period
            if current < busy_start:
                slots.append(
                    AvailabilitySlot(
                        start_time=current,
                        end_time=min(busy_start, end_time),
                        status=TimeSlot.free,
                    )
                )

            # Add busy slot
            if busy_start < end_time:
                slots.append(
                    AvailabilitySlot(
                        start_time=max(busy_start, current),
                        end_time=min(busy_end, end_time),
                        status=TimeSlot.busy,
                    )
                )

            current = max(current, busy_end)

        # Add remaining free time
        if current < end_time:
            slots.append(
                AvailabilitySlot(
                    start_time=current,
                    end_time=end_time,
                    status=TimeSlot.free,
                )
            )

        return slots

    async def _ensure_valid_token(
        self,
        connection: CalendarConnection,
        service: CalendarProviderService,
    ) -> str:
        """Ensure the access token is valid, refreshing if necessary."""
        if connection.token_expires_at and connection.token_expires_at <= datetime.utcnow():
            if connection.refresh_token:
                new_token = await service.refresh_access_token(connection)
                connection.access_token = new_token
                connection.token_expires_at = datetime.utcnow() + timedelta(hours=1)
                return new_token
            raise ValueError("Token expired and no refresh token available")
        return connection.access_token

    async def create_reminder(
        self,
        db: AsyncSession,
        milestone_id: uuid.UUID,
        user_id: uuid.UUID,
        reminder_minutes: int,
    ) -> CalendarReminder:
        """Create a reminder for a milestone."""
        reminder = CalendarReminder(
            milestone_id=milestone_id,
            user_id=user_id,
            reminder_minutes=reminder_minutes,
        )
        db.add(reminder)
        await db.commit()
        await db.refresh(reminder)
        return reminder

    async def get_milestone_sync_status(
        self,
        db: AsyncSession,
        milestone_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Get sync status for a milestone."""
        result = await db.execute(
            select(CalendarEvent).where(CalendarEvent.milestone_id == milestone_id)
        )
        events = result.scalars().all()

        result = await db.execute(
            select(CalendarReminder).where(CalendarReminder.milestone_id == milestone_id)
        )
        reminders = result.scalars().all()

        return {
            "milestone_id": milestone_id,
            "is_synced": len(events) > 0,
            "calendar_events": events,
            "reminders": reminders,
        }


# Global service instance
calendar_service = CalendarService()
