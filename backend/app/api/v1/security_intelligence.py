"""Security & Intelligence Feed endpoints.

These endpoints are strictly gated to MD and RM roles.  Every access to
security brief data creates an immutable audit log entry.  Security data
must never be exposed to the client portal or partner portal.
"""

import uuid
from datetime import datetime as _dt
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    DB,
    CurrentUser,
    RLSContext,
    require_rm_or_above,
)
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.audit_log import AuditLog
from app.models.client_profile import ClientProfile
from app.models.enums import SecurityProfileLevel, UserRole
from app.schemas.security_intelligence import (
    SecurityBriefResponse,
    SecurityProfileLevelUpdate,
    SecurityProfileLevelUpdateResponse,
    ThreatSummary,
    TravelAdvisory,
)
from app.services.security_intelligence_service import security_intelligence_service

router = APIRouter()


async def _write_security_access_log(
    db: AsyncSession,
    user_id: uuid.UUID,
    user_email: str,
    client_profile_id: uuid.UUID,
    ip_address: str | None,
    user_agent: str | None,
) -> None:
    """Append an immutable audit log entry every time security data is accessed."""
    log = AuditLog(
        user_id=user_id,
        user_email=user_email,
        action="read",
        entity_type="security_brief",
        entity_id=str(client_profile_id),
        before_state=None,
        after_state={"accessed": True},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)
    await db.commit()


@router.get(
    "/{profile_id}/security-brief",
    response_model=SecurityBriefResponse,
    dependencies=[Depends(require_rm_or_above)],
    summary="Get security intelligence brief for a client",
    description=(
        "Returns discreet threat monitoring data and travel advisories for "
        "executive-level clients.  Access is restricted to MD and RM roles.  "
        "Every invocation is written to the audit trail.  "
        "⚠ This endpoint must never be proxied to the client or partner portal."
    ),
)
async def get_security_brief(
    profile_id: uuid.UUID,
    request: Request,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> SecurityBriefResponse:
    # --- Fetch and authorise the profile ---
    result = await db.execute(select(ClientProfile).where(ClientProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Profile not found")

    # RMs can only access clients in their portfolio
    if (
        current_user.role == UserRole.relationship_manager
        and profile.assigned_rm_id != current_user.id
    ):
        raise ForbiddenException("Access denied: client not in your portfolio")

    # Only executive-level (or elevated) clients have security briefs
    if profile.security_profile_level == SecurityProfileLevel.standard:
        raise ForbiddenException(
            "Security brief is not available for standard-level profiles. "
            "Upgrade the client's security profile level to 'elevated' or 'executive'."
        )

    # --- Audit log — every access is recorded ---
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await _write_security_access_log(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        client_profile_id=profile_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    # --- Build destinations from intelligence file ---
    destinations: list[str] = []
    if profile.intelligence_file:
        lifestyle = profile.intelligence_file.get("lifestyle_profile", {})
        if isinstance(lifestyle, dict):
            preferred = lifestyle.get("preferred_destinations", [])
            if isinstance(preferred, list):
                destinations = [str(d) for d in preferred]

    # --- Fetch brief from service ---
    brief_data = await security_intelligence_service.get_security_brief(
        client_id=str(profile_id),
        destinations=destinations,
    )

    # --- Deserialise into response model ---
    # brief_data values are typed as Any (from SecurityBriefData = dict[str, Any])
    threat_raw: dict[str, Any] = brief_data["threat_summary"]
    threat_summary = ThreatSummary(
        client_id=str(threat_raw["client_id"]),
        threat_level=str(threat_raw["threat_level"]),
        feed_status=str(threat_raw["feed_status"]),
        feed_error=threat_raw.get("feed_error"),
        alerts=[],
        last_updated=None,
        note=threat_raw.get("note"),
    )

    raw_advisories: list[dict[str, Any]] = brief_data.get("travel_advisories", [])
    travel_advisories = [
        TravelAdvisory(
            destination=str(adv["destination"]),
            risk_level=str(adv["risk_level"]),
            feed_status=str(adv["feed_status"]),
            feed_error=adv.get("feed_error"),
            summary=str(adv["summary"]),
            last_updated=None,
        )
        for adv in raw_advisories
    ]

    generated_at_raw = brief_data["generated_at"]
    generated_at = (
        _dt.fromisoformat(generated_at_raw)
        if isinstance(generated_at_raw, str)
        else generated_at_raw
    )

    return SecurityBriefResponse(
        client_id=profile_id,
        generated_at=generated_at,
        provider=str(brief_data["provider"]),
        feed_connected=bool(brief_data["feed_connected"]),
        threat_summary=threat_summary,
        travel_advisories=travel_advisories,
        access_logged=True,
    )


@router.patch(
    "/{profile_id}/security-profile-level",
    response_model=SecurityProfileLevelUpdateResponse,
    dependencies=[Depends(require_rm_or_above)],
    summary="Update a client's security profile level",
    description=(
        "Update the security profile level (standard / elevated / executive) for a client. "
        "Restricted to MD and RM roles."
    ),
)
async def update_security_profile_level(
    profile_id: uuid.UUID,
    data: SecurityProfileLevelUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> SecurityProfileLevelUpdateResponse:
    result = await db.execute(select(ClientProfile).where(ClientProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise NotFoundException("Profile not found")

    if (
        current_user.role == UserRole.relationship_manager
        and profile.assigned_rm_id != current_user.id
    ):
        raise ForbiddenException("Access denied: client not in your portfolio")

    old_level = profile.security_profile_level
    profile.security_profile_level = data.security_profile_level.value

    # Audit the level change
    log = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="security_profile_level",
        entity_id=str(profile_id),
        before_state={"security_profile_level": old_level},
        after_state={"security_profile_level": data.security_profile_level.value},
    )
    db.add(log)
    await db.commit()

    return SecurityProfileLevelUpdateResponse(
        profile_id=profile_id,
        security_profile_level=data.security_profile_level.value,
    )
