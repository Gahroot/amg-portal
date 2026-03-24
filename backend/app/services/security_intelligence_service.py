"""Security & Intelligence Feed Service — Phase 2 Integration.

Provides discreet threat monitoring data for executive-level clients.
When no provider is configured (SECURITY_FEED_PROVIDER is None), all methods
return safe stub data so the rest of the platform operates normally.

IMPORTANT: Data returned by this service is strictly need-to-know.
Access is gated to MD and RM roles only, and every retrieval is written
to the audit log by the calling endpoint.
"""

import logging
from datetime import UTC, datetime
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data shapes (plain dicts — serialised via Pydantic schemas at the API layer)
# ---------------------------------------------------------------------------

ThreatAlert = dict[str, Any]
ThreatSummary = dict[str, Any]
TravelAdvisory = dict[str, Any]
SecurityBriefData = dict[str, Any]


class SecurityIntelligenceService:
    """Facade over the configured security feed provider.

    Instantiate once at module level (see bottom of file).  All public
    methods are async so they can be awaited inside FastAPI route handlers.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_threat_summary(self, client_id: str) -> ThreatSummary:
        """Return current threat level and relevant alerts for a client.

        When no feed is configured the method returns a stub response that
        clearly indicates the offline state so operators are not misled.
        """
        if not self._is_configured():
            return self._stub_threat_summary(client_id)

        try:
            return await self._fetch_threat_summary(client_id)
        except Exception as exc:
            logger.warning(
                "Security feed threat summary unavailable for client %s: %s",
                client_id,
                exc,
            )
            return self._stub_threat_summary(client_id, error=str(exc))

    async def get_travel_advisories(self, destinations: list[str]) -> list[TravelAdvisory]:
        """Return travel risk assessments for the supplied destinations.

        Destinations should be ISO country codes or recognisable place names.
        Returns an empty list when the destination list is empty.
        """
        if not destinations:
            return []

        if not self._is_configured():
            return self._stub_travel_advisories(destinations)

        try:
            return await self._fetch_travel_advisories(destinations)
        except Exception as exc:
            logger.warning(
                "Security feed travel advisories unavailable for %s: %s",
                destinations,
                exc,
            )
            return self._stub_travel_advisories(destinations, error=str(exc))

    async def get_security_brief(
        self,
        client_id: str,
        destinations: list[str] | None = None,
    ) -> SecurityBriefData:
        """Composite brief: threat summary + travel advisories.

        This is the primary method called by the API endpoint.
        """
        threat_summary = await self.get_threat_summary(client_id)
        travel_advisories = await self.get_travel_advisories(destinations or [])

        return {
            "client_id": client_id,
            "generated_at": datetime.now(UTC).isoformat(),
            "provider": settings.SECURITY_FEED_PROVIDER or "offline",
            "feed_connected": self._is_configured(),
            "threat_summary": threat_summary,
            "travel_advisories": travel_advisories,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _is_configured(self) -> bool:
        return bool(settings.SECURITY_FEED_PROVIDER and settings.SECURITY_FEED_API_KEY)

    # ------------------------------------------------------------------
    # Stub / offline implementations
    # ------------------------------------------------------------------

    def _stub_threat_summary(
        self, client_id: str, error: str | None = None
    ) -> ThreatSummary:
        return {
            "client_id": client_id,
            "threat_level": "unknown",
            "feed_status": "offline" if not error else "error",
            "feed_error": error,
            "alerts": [],
            "last_updated": None,
            "note": (
                "Security feed not configured. "
                "Set SECURITY_FEED_PROVIDER and SECURITY_FEED_API_KEY to enable live data."
            ),
        }

    def _stub_travel_advisories(
        self, destinations: list[str], error: str | None = None
    ) -> list[TravelAdvisory]:
        return [
            {
                "destination": dest,
                "risk_level": "unknown",
                "feed_status": "offline" if not error else "error",
                "feed_error": error,
                "summary": (
                    "Travel advisory data unavailable — security feed not configured."
                ),
                "last_updated": None,
            }
            for dest in destinations
        ]

    # ------------------------------------------------------------------
    # Live provider implementations (placeholder — wire up your provider here)
    # ------------------------------------------------------------------

    async def _fetch_threat_summary(self, client_id: str) -> ThreatSummary:
        """Fetch live threat data from the configured provider.

        Replace the body of this method with your provider's SDK/HTTP calls.
        The provider name is available via ``settings.SECURITY_FEED_PROVIDER``.
        """
        # TODO: Implement provider-specific integration when a feed is contracted.
        # Example providers: Flashpoint, Recorded Future, Maxmind, custom REST API.
        raise NotImplementedError(
            f"Live feed fetch not yet implemented for provider "
            f"'{settings.SECURITY_FEED_PROVIDER}'. "
            "Implement _fetch_threat_summary() in security_intelligence_service.py."
        )

    async def _fetch_travel_advisories(
        self, destinations: list[str]
    ) -> list[TravelAdvisory]:
        """Fetch live travel advisories from the configured provider."""
        raise NotImplementedError(
            f"Live feed fetch not yet implemented for provider "
            f"'{settings.SECURITY_FEED_PROVIDER}'. "
            "Implement _fetch_travel_advisories() in security_intelligence_service.py."
        )


# Module-level singleton — import this throughout the application.
security_intelligence_service = SecurityIntelligenceService()
