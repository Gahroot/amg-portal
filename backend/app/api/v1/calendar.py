"""Calendar integration endpoints.

Provides:
- iCal subscription URL for all user milestones
- Google Calendar OAuth flow
- Microsoft/Outlook OAuth flow
- Manual sync endpoint
"""

import logging
import urllib.parse
import uuid
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import PlainTextResponse

from app.api.deps import DB, CurrentUser
from app.core.config import settings
from app.core.exceptions import BadRequestException, NotFoundException
from app.services.calendar_service import (
    CalendarError,
    generate_ical_for_user,
    sync_all_milestones_to_calendar,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# OAuth scopes
GOOGLE_CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
]

MICROSOFT_CALENDAR_SCOPES = [
    "Calendars.ReadWrite",
    "offline_access",
]


@router.get("/ical/{user_id}.ics")
async def get_ical_feed(user_id: uuid.UUID, db: DB) -> PlainTextResponse:
    """Get iCal feed for a user's program milestones.

    This is a publicly accessible URL that can be subscribed to in calendar apps.
    The user_id is used as a semi-secret token (UUID is hard to guess).
    """
    try:
        ical_content = await generate_ical_for_user(db, user_id)
        return PlainTextResponse(
            content=ical_content,
            media_type="text/calendar; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="amg-milestones-{user_id}.ics"',
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        )
    except CalendarError as e:
        raise NotFoundException(str(e)) from e


@router.get("/status")
async def get_calendar_status(current_user: CurrentUser) -> dict:
    """Get calendar integration status for the current user."""
    return {
        "google_connected": current_user.google_calendar_token is not None,
        "outlook_connected": current_user.outlook_calendar_token is not None,
        "last_synced_at": (
            current_user.calendar_last_synced_at.isoformat()
            if current_user.calendar_last_synced_at
            else None
        ),
        "ical_url": f"{settings.API_V1_PREFIX}/calendar/ical/{current_user.id}.ics",
    }


@router.get("/connect/google")
async def connect_google_calendar(current_user: CurrentUser) -> dict:
    """Get Google Calendar OAuth authorization URL.

    The frontend should redirect the user to this URL to start the OAuth flow.
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Calendar integration is not configured",
        )

    redirect_uri = settings.GOOGLE_CALENDAR_REDIRECT_URI or f"{settings.FRONTEND_URL}/settings/calendar/callback/google"
    state = f"user:{current_user.id}"

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_CALENDAR_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }

    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return {"authorization_url": auth_url}


@router.post("/connect/google/callback")
async def google_calendar_callback(
    data: dict,
    current_user: CurrentUser,
    db: DB,
) -> dict:
    """Handle Google Calendar OAuth callback.

    Exchanges the authorization code for tokens and stores them.
    """
    code = data.get("code")
    if not code:
        raise BadRequestException("Authorization code is required")

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Calendar integration is not configured",
        )

    redirect_uri = settings.GOOGLE_CALENDAR_REDIRECT_URI or f"{settings.FRONTEND_URL}/settings/calendar/callback/google"

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

        if token_response.status_code != 200:
            logger.error(f"Google token exchange failed: {token_response.text}")
            raise BadRequestException("Failed to exchange authorization code for tokens")

        token_data = token_response.json()

    # Store tokens in user record
    current_user.google_calendar_token = {
        "access_token": token_data.get("access_token"),
        "refresh_token": token_data.get("refresh_token"),
        "expires_at": token_data.get("expires_at"),
        "token_type": token_data.get("token_type", "Bearer"),
    }
    await db.commit()

    return {
        "message": "Google Calendar connected successfully",
        "connected": True,
    }


@router.post("/connect/outlook/callback")
async def outlook_calendar_callback(
    data: dict,
    current_user: CurrentUser,
    db: DB,
) -> dict:
    """Handle Microsoft/Outlook OAuth callback.

    Exchanges the authorization code for tokens and stores them.
    """
    code = data.get("code")
    if not code:
        raise BadRequestException("Authorization code is required")

    if not settings.MICROSOFT_CLIENT_ID or not settings.MICROSOFT_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Outlook Calendar integration is not configured",
        )

    redirect_uri = settings.MICROSOFT_CALENDAR_REDIRECT_URI or f"{settings.FRONTEND_URL}/settings/calendar/callback/outlook"
    token_url = f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT_ID}/oauth2/v2.0/token"

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            token_url,
            data={
                "code": code,
                "client_id": settings.MICROSOFT_CLIENT_ID,
                "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "scope": " ".join(MICROSOFT_CALENDAR_SCOPES),
            },
        )

        if token_response.status_code != 200:
            logger.error(f"Microsoft token exchange failed: {token_response.text}")
            raise BadRequestException("Failed to exchange authorization code for tokens")

        token_data = token_response.json()

    # Store tokens in user record
    current_user.outlook_calendar_token = {
        "access_token": token_data.get("access_token"),
        "refresh_token": token_data.get("refresh_token"),
        "expires_at": token_data.get("expires_at"),
        "token_type": token_data.get("token_type", "Bearer"),
    }
    await db.commit()

    return {
        "message": "Outlook Calendar connected successfully",
        "connected": True,
    }


@router.get("/connect/outlook")
async def connect_outlook_calendar(current_user: CurrentUser) -> dict:
    """Get Microsoft/Outlook OAuth authorization URL.

    The frontend should redirect the user to this URL to start the OAuth flow.
    """
    if not settings.MICROSOFT_CLIENT_ID or not settings.MICROSOFT_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Outlook Calendar integration is not configured",
        )

    redirect_uri = settings.MICROSOFT_CALENDAR_REDIRECT_URI or f"{settings.FRONTEND_URL}/settings/calendar/callback/outlook"
    state = f"user:{current_user.id}"

    auth_url = (
        f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize"
    )
    params = {
        "client_id": settings.MICROSOFT_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(MICROSOFT_CALENDAR_SCOPES),
        "response_mode": "query",
        "state": state,
    }

    full_url = f"{auth_url}?{urllib.parse.urlencode(params)}"
    return {"authorization_url": full_url}


@router.post("/sync")
async def sync_calendar(
    current_user: CurrentUser,
    db: DB,
    provider: str = "all",
) -> dict:
    """Manually sync all upcoming milestones to connected calendars.

    Args:
        provider: "google", "outlook", or "all" (default)
    """
    if provider not in ("google", "outlook", "all"):
        raise BadRequestException("Provider must be 'google', 'outlook', or 'all'")

    try:
        results = await sync_all_milestones_to_calendar(db, current_user.id, provider)

        # Update last synced timestamp
        current_user.calendar_last_synced_at = datetime.now(UTC)
        await db.commit()

        return {
            "message": f"Synced {results['synced']} milestones",
            **results,
            "last_synced_at": current_user.calendar_last_synced_at.isoformat(),
        }
    except CalendarError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e


@router.delete("/disconnect/{provider}")
async def disconnect_calendar(
    provider: str,
    current_user: CurrentUser,
    db: DB,
) -> dict:
    """Disconnect a calendar integration.

    Args:
        provider: "google" or "outlook"
    """
    if provider not in ("google", "outlook"):
        raise BadRequestException("Provider must be 'google' or 'outlook'")

    if provider == "google":
        current_user.google_calendar_token = None
    else:
        current_user.outlook_calendar_token = None

    await db.commit()

    return {"message": f"{provider.title()} calendar disconnected"}
