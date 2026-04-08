"""Pydantic schemas for Security & Intelligence Feed responses.

All data in these schemas is strictly need-to-know (MD + RM only).
These schemas are never exposed to the client portal or partner portal.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import SecurityProfileLevel

# ---------------------------------------------------------------------------
# Security profile management
# ---------------------------------------------------------------------------


class SecurityProfileLevelUpdate(BaseModel):
    """Request body for updating a client's security profile level."""

    security_profile_level: SecurityProfileLevel


class SecurityProfileLevelUpdateResponse(BaseModel):
    """Response body after updating a client's security profile level."""

    profile_id: UUID
    security_profile_level: str


# ---------------------------------------------------------------------------
# Feed response shapes
# ---------------------------------------------------------------------------


class ThreatAlert(BaseModel):
    """A single threat alert from the intelligence feed."""

    alert_id: str | None = None
    severity: str  # e.g. "low", "medium", "high", "critical"
    category: str  # e.g. "cyber", "physical", "reputational", "travel"
    title: str
    summary: str
    source: str | None = None
    detected_at: datetime | None = None


class ThreatSummary(BaseModel):
    """Aggregated threat summary for a client."""

    client_id: str
    threat_level: str  # "low", "medium", "high", "critical", "unknown"
    feed_status: str  # "live", "offline", "error"
    feed_error: str | None = None
    alerts: list[ThreatAlert] = []
    last_updated: datetime | None = None
    note: str | None = None


class TravelAdvisory(BaseModel):
    """Travel risk assessment for a specific destination."""

    destination: str
    risk_level: str  # "low", "medium", "high", "extreme", "unknown"
    feed_status: str  # "live", "offline", "error"
    feed_error: str | None = None
    summary: str
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
    provider: str
    feed_connected: bool
    threat_summary: ThreatSummary
    travel_advisories: list[TravelAdvisory] = []
    access_logged: bool = True
    disclaimer: str = (
        "Security information is strictly need-to-know. "
        "Unauthorised disclosure is a serious breach of client confidentiality."
    )
