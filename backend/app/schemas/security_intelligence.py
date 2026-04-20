"""Pydantic schemas for Security & Intelligence Feed responses.

All data in these schemas is strictly need-to-know (MD + RM only).
These schemas are never exposed to the client portal or partner portal.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import SecurityProfileLevel
from app.schemas.base import Str50, Str100, Str255, Str500, Str2000

# ---------------------------------------------------------------------------
# Security profile management
# ---------------------------------------------------------------------------


class SecurityProfileLevelUpdate(BaseModel):
    """Request body for updating a client's security profile level."""

    security_profile_level: SecurityProfileLevel


class SecurityProfileLevelUpdateResponse(BaseModel):
    """Response body after updating a client's security profile level."""

    profile_id: UUID
    security_profile_level: Str50


# ---------------------------------------------------------------------------
# Feed response shapes
# ---------------------------------------------------------------------------


class ThreatAlert(BaseModel):
    """A single threat alert from the intelligence feed."""

    alert_id: Str100 | None = None
    severity: Str50  # e.g. "low", "medium", "high", "critical"
    category: Str50  # e.g. "cyber", "physical", "reputational", "travel"
    title: Str255
    summary: Str2000
    source: Str255 | None = None
    detected_at: datetime | None = None


class ThreatSummary(BaseModel):
    """Aggregated threat summary for a client."""

    client_id: Str100
    threat_level: Str50  # "low", "medium", "high", "critical", "unknown"
    feed_status: Str50  # "live", "offline", "error"
    feed_error: Str500 | None = None
    alerts: list[ThreatAlert] = []
    last_updated: datetime | None = None
    note: Str2000 | None = None


class TravelAdvisory(BaseModel):
    """Travel risk assessment for a specific destination."""

    destination: Str255
    risk_level: Str50  # "low", "medium", "high", "extreme", "unknown"
    feed_status: Str50  # "live", "offline", "error"
    feed_error: Str500 | None = None
    summary: Str2000
    key_risks: list[str] = []
    last_updated: datetime | None = None


class SecurityBriefResponse(BaseModel):
    """Full security brief for an executive-level client.

    Composed of a threat summary plus travel advisories for any
    destinations linked to the client's active programs.

    ⚠ This response must never be surfaced to the client portal or
    partner portal.  Enforce access control at the route level.
    """

    client_id: UUID
    generated_at: datetime
    provider: Str100
    feed_connected: bool
    threat_summary: ThreatSummary
    travel_advisories: list[TravelAdvisory] = []
    access_logged: bool = True
    disclaimer: Str500 = (
        "Security information is strictly need-to-know. "
        "Unauthorised disclosure is a serious breach of client confidentiality."
    )
