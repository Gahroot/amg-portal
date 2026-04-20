"""Service for Expo push notification operations."""

import json
import uuid
from datetime import UTC, datetime, time
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.http_client import get_internal_client
from app.models.push_token import PushToken
from app.services.crud_base import CRUDBase

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Deep link scheme for mobile app
DEEP_LINK_SCHEME = "amgportal://"

# Entity type to deep link path mapping
ENTITY_TO_DEEP_LINK_PATH: dict[str, str] = {
    "program": "programs",
    "programs": "programs",
    "message": "messages",
    "messages": "messages",
    "conversation": "messages",
    "conversations": "messages",
    "decision": "decisions",
    "decisions": "decisions",
}


def generate_deep_link(entity_type: str | None, entity_id: str | uuid.UUID | None) -> str | None:
    """Generate a deep link URL from entity type and ID.

    Args:
        entity_type: The type of entity (e.g., 'program', 'decision', 'message')
        entity_id: The UUID of the entity

    Returns:
        Deep link URL (e.g., 'amgportal://programs/123') or None if invalid
    """
    if not entity_type or not entity_id:
        return None

    path = ENTITY_TO_DEEP_LINK_PATH.get(entity_type.lower())
    if not path:
        return None

    entity_id_str = str(entity_id)
    return f"{DEEP_LINK_SCHEME}{path}/{entity_id_str}"


class PushService(CRUDBase[PushToken, dict[str, Any], dict[str, Any]]):
    """Service for Expo push notification operations."""

    # Expose the module-level helper as an instance method so callers can use
    # ``push_service.generate_deep_link(...)`` uniformly.
    generate_deep_link = staticmethod(generate_deep_link)

    async def register_token(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        token: str,
        platform: str,
        device_name: str | None = None,
    ) -> PushToken:
        """Register or update a push token for a user."""
        # Check if token already exists
        result = await db.execute(select(PushToken).where(PushToken.token == token))
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing token
            existing.user_id = user_id
            existing.platform = platform
            existing.device_name = device_name
            existing.is_active = True
            await db.commit()
            await db.refresh(existing)
            return existing

        # Create new token
        push_token = PushToken(
            user_id=user_id,
            token=token,
            platform=platform,
            device_name=device_name,
        )
        db.add(push_token)
        await db.commit()
        await db.refresh(push_token)
        return push_token

    async def unregister_token(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        token: str,
    ) -> bool:
        """Unregister a push token."""
        result = await db.execute(
            select(PushToken).where(
                PushToken.token == token,
                PushToken.user_id == user_id,
            )
        )
        push_token = result.scalar_one_or_none()

        if push_token:
            await db.delete(push_token)
            await db.commit()
            return True
        return False

    async def get_tokens_for_user(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[PushToken]:
        """Get all active push tokens for a user."""
        result = await db.execute(
            select(PushToken).where(
                PushToken.user_id == user_id,
                PushToken.is_active == True,  # noqa: E712
            )
        )
        return list(result.scalars().all())

    def is_in_quiet_hours(
        self,
        quiet_hours_enabled: bool,
        quiet_hours_start: time | None,
        quiet_hours_end: time | None,
        timezone: str,
    ) -> bool:
        """Check if current time is within quiet hours."""
        if not quiet_hours_enabled or not quiet_hours_start or not quiet_hours_end:
            return False

        try:
            tz = ZoneInfo(timezone)
        except Exception:
            tz = ZoneInfo("UTC")

        now = datetime.now(tz).time()

        # Handle overnight quiet hours (e.g., 22:00 - 07:00)
        if quiet_hours_start > quiet_hours_end:
            return now >= quiet_hours_start or now <= quiet_hours_end
        else:
            return quiet_hours_start <= now <= quiet_hours_end

    async def send_push_notification(  # noqa: PLR0911
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        title: str,
        body: str,
        data: dict[str, Any] | None = None,
        *,
        skip_quiet_hours: bool = False,
        preferences: Any = None,
    ) -> bool:
        """Send a push notification to all of a user's devices."""
        tokens = await self.get_tokens_for_user(db, user_id)

        if not tokens:
            return False

        # Check quiet hours
        if not skip_quiet_hours and preferences:
            if self.is_in_quiet_hours(
                preferences.quiet_hours_enabled,
                preferences.quiet_hours_start,
                preferences.quiet_hours_end,
                preferences.timezone,
            ):
                # Don't send push during quiet hours
                return False

            # Check if push is enabled in channel preferences
            channel_prefs = preferences.channel_preferences or {}
            if not channel_prefs.get("push", True):
                return False

        # Prepare push messages
        messages = []
        token_strings = []

        for push_token in tokens:
            token_strings.append(push_token.token)
            messages.append(
                {
                    "to": push_token.token,
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "sound": "default",
                    "priority": "high",
                }
            )

        if not messages:
            return False

        # Send to Expo — trusted Expo endpoint, shared internal client.
        try:
            client = get_internal_client()
            response = await client.post(
                EXPO_PUSH_URL,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                content=json.dumps(messages),
                timeout=30.0,
            )

            if response.status_code == 200:
                result = response.json()
                # Handle ticket responses
                tickets = result.get("data", [])

                # Update last_used_at for successful sends
                now = datetime.now(UTC)
                for i, ticket in enumerate(tickets):
                    if ticket.get("status") == "ok" and i < len(tokens):
                        tokens[i].last_used_at = now

                # Deactivate invalid tokens
                await self._handle_ticket_errors(db, tickets, token_strings)

                await db.commit()
                return True

        except Exception:
            return False

        return False

    async def _handle_ticket_errors(
        self,
        db: AsyncSession,
        tickets: list[dict[str, Any]],
        token_strings: list[str],
    ) -> None:
        """Handle errors from Expo push API and deactivate invalid tokens."""
        tokens_to_deactivate = []

        for i, ticket in enumerate(tickets):
            if ticket.get("status") == "error":
                error = ticket.get("details", {})
                error_code = error.get("error")

                # Deactivate tokens with these errors
                if error_code in (
                    "DeviceNotRegistered",
                    "InvalidCredentials",
                    "MessageTooBig",
                ) and i < len(token_strings):
                    tokens_to_deactivate.append(token_strings[i])

        if tokens_to_deactivate:
            await db.execute(
                update(PushToken)
                .where(PushToken.token.in_(tokens_to_deactivate))
                .values(is_active=False)
            )

    async def deactivate_all_tokens_for_user(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        """Deactivate all push tokens for a user."""
        result = await db.execute(
            update(PushToken).where(PushToken.user_id == user_id).values(is_active=False)
        )
        await db.commit()
        return int(result.rowcount)  # type: ignore[attr-defined]


push_service = PushService(PushToken)
