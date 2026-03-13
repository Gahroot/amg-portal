"""CRM integration service for bi-directional sync of client profiles.

Portal is the master record — portal data always overwrites CRM data on conflict.
CRM→Portal sync only imports new fields that are empty in the portal.
"""

from __future__ import annotations

import logging
import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.client_profile import ClientProfile
from app.models.communication import Communication

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data transfer types
# ---------------------------------------------------------------------------


class CRMContact:
    """Normalised CRM contact representation used across providers."""

    def __init__(
        self,
        *,
        external_id: str,
        email: str,
        first_name: str | None = None,
        last_name: str | None = None,
        company: str | None = None,
        phone: str | None = None,
        address: str | None = None,
        properties: dict[str, Any] | None = None,
    ) -> None:
        self.external_id = external_id
        self.email = email
        self.first_name = first_name
        self.last_name = last_name
        self.company = company
        self.phone = phone
        self.address = address
        self.properties = properties or {}


class CRMSyncResult:
    """Result of a single sync operation."""

    def __init__(
        self,
        *,
        success: bool,
        direction: str,
        external_id: str | None = None,
        changes: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        self.success = success
        self.direction = direction  # "portal_to_crm" | "crm_to_portal"
        self.external_id = external_id
        self.changes = changes or {}
        self.error = error


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------


class BaseCRMService(ABC):
    """Abstract CRM integration interface."""

    @abstractmethod
    async def sync_client_to_crm(
        self, db: AsyncSession, client_profile: ClientProfile
    ) -> CRMSyncResult:
        """Push portal client data to CRM. Portal is master — overwrites CRM."""

    @abstractmethod
    async def sync_client_from_crm(
        self, db: AsyncSession, external_id: str
    ) -> CRMSyncResult:
        """Pull CRM data into portal. Only fills empty portal fields."""

    @abstractmethod
    async def sync_communications(
        self, db: AsyncSession, client_id: uuid.UUID
    ) -> CRMSyncResult:
        """Sync communication history for a client to CRM."""

    @abstractmethod
    async def search_crm_contact(self, email: str) -> CRMContact | None:
        """Search CRM for a contact by email."""


# ---------------------------------------------------------------------------
# HubSpot implementation
# ---------------------------------------------------------------------------


class HubSpotCRMService(BaseCRMService):
    """HubSpot CRM integration using the CRM v3 API."""

    def __init__(self) -> None:
        self.api_key = settings.CRM_API_KEY
        self.base_url = settings.CRM_BASE_URL or "https://api.hubapi.com"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    # -- field mapping -------------------------------------------------------

    @staticmethod
    def _profile_to_hubspot_properties(profile: ClientProfile) -> dict[str, str]:
        """Map portal ClientProfile fields to HubSpot contact properties."""
        # HubSpot expects first/last name; we split legal_name heuristically.
        parts = (profile.legal_name or "").split(maxsplit=1)
        first_name = parts[0] if parts else ""
        last_name = parts[1] if len(parts) > 1 else ""

        props: dict[str, str] = {
            "email": profile.primary_email,
            "firstname": first_name,
            "lastname": last_name,
            "phone": profile.phone or "",
            "address": profile.address or "",
            "company": profile.display_name or profile.legal_name,
        }
        if profile.entity_type:
            props["hs_lead_status"] = profile.entity_type
        if profile.jurisdiction:
            props["state"] = profile.jurisdiction
        return props

    @staticmethod
    def _hubspot_to_profile_updates(
        properties: dict[str, str], profile: ClientProfile
    ) -> dict[str, str]:
        """Compute portal updates from HubSpot data.

        Portal is master — only fill fields that are currently empty/None.
        """
        updates: dict[str, str] = {}

        hs_phone = properties.get("phone", "")
        if hs_phone and not profile.phone:
            updates["phone"] = hs_phone

        hs_address = properties.get("address", "")
        if hs_address and not profile.address:
            updates["address"] = hs_address

        hs_jurisdiction = properties.get("state", "")
        if hs_jurisdiction and not profile.jurisdiction:
            updates["jurisdiction"] = hs_jurisdiction

        hs_entity_type = properties.get("hs_lead_status", "")
        if hs_entity_type and not profile.entity_type:
            updates["entity_type"] = hs_entity_type

        hs_display = properties.get("company", "")
        if hs_display and not profile.display_name:
            updates["display_name"] = hs_display

        return updates

    # -- API helpers ---------------------------------------------------------

    async def _create_contact(
        self, properties: dict[str, str]
    ) -> dict[str, Any]:
        """POST /crm/v3/objects/contacts to create a new contact."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/crm/v3/objects/contacts",
                headers=self._headers(),
                json={"properties": properties},
            )
            resp.raise_for_status()
            result: dict[str, Any] = resp.json()
            return result

    async def _update_contact(
        self, contact_id: str, properties: dict[str, str]
    ) -> dict[str, Any]:
        """PATCH /crm/v3/objects/contacts/{id} to update an existing contact."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.patch(
                f"{self.base_url}/crm/v3/objects/contacts/{contact_id}",
                headers=self._headers(),
                json={"properties": properties},
            )
            resp.raise_for_status()
            result: dict[str, Any] = resp.json()
            return result

    async def _get_contact(self, contact_id: str) -> dict[str, Any]:
        """GET /crm/v3/objects/contacts/{id}."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/crm/v3/objects/contacts/{contact_id}",
                headers=self._headers(),
                params={
                    "properties": (
                        "email,firstname,lastname,phone,"
                        "address,company,state,hs_lead_status"
                    ),
                },
            )
            resp.raise_for_status()
            result: dict[str, Any] = resp.json()
            return result

    async def _create_note(
        self, contact_id: str, body: str, timestamp: datetime | None = None
    ) -> dict[str, Any]:
        """Create a note engagement associated with a contact."""
        ts = timestamp or datetime.now(UTC)
        ts_ms = str(int(ts.timestamp() * 1000))

        note_payload: dict[str, Any] = {
            "properties": {
                "hs_timestamp": ts_ms,
                "hs_note_body": body,
            },
            "associations": [
                {
                    "to": {"id": contact_id},
                    "types": [
                        {
                            "associationCategory": "HUBSPOT_DEFINED",
                            "associationTypeId": 202,
                        }
                    ],
                }
            ],
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/crm/v3/objects/notes",
                headers=self._headers(),
                json=note_payload,
            )
            resp.raise_for_status()
            result: dict[str, Any] = resp.json()
            return result

    # -- public interface ----------------------------------------------------

    async def search_crm_contact(self, email: str) -> CRMContact | None:
        """Search HubSpot for a contact by email."""
        payload = {
            "filterGroups": [
                {
                    "filters": [
                        {
                            "propertyName": "email",
                            "operator": "EQ",
                            "value": email,
                        }
                    ]
                }
            ],
            "properties": [
                "email",
                "firstname",
                "lastname",
                "phone",
                "address",
                "company",
                "state",
                "hs_lead_status",
            ],
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{self.base_url}/crm/v3/objects/contacts/search",
                    headers=self._headers(),
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

            results: list[dict[str, Any]] = data.get("results", [])
            if not results:
                return None

            hit = results[0]
            props = hit.get("properties", {})
            return CRMContact(
                external_id=str(hit["id"]),
                email=props.get("email", email),
                first_name=props.get("firstname"),
                last_name=props.get("lastname"),
                company=props.get("company"),
                phone=props.get("phone"),
                address=props.get("address"),
                properties=props,
            )
        except httpx.HTTPStatusError:
            logger.exception("HubSpot search failed for email=%s", email)
            return None

    async def sync_client_to_crm(
        self, db: AsyncSession, client_profile: ClientProfile
    ) -> CRMSyncResult:
        """Push client profile to HubSpot. Portal is master — overwrites CRM."""
        properties = self._profile_to_hubspot_properties(client_profile)

        try:
            if client_profile.external_crm_id:
                # Update existing contact
                await self._update_contact(client_profile.external_crm_id, properties)
                await _log_crm_sync(
                    db,
                    action="crm_sync_push",
                    entity_id=str(client_profile.id),
                    after_state={
                        "direction": "portal_to_crm",
                        "external_id": client_profile.external_crm_id,
                        "properties_synced": list(properties.keys()),
                    },
                )
                return CRMSyncResult(
                    success=True,
                    direction="portal_to_crm",
                    external_id=client_profile.external_crm_id,
                    changes=properties,
                )
            else:
                # Search by email first to avoid duplicates
                existing = await self.search_crm_contact(client_profile.primary_email)
                if existing:
                    # Update found contact and store the external ID
                    await self._update_contact(existing.external_id, properties)
                    client_profile.external_crm_id = existing.external_id
                    await _log_crm_sync(
                        db,
                        action="crm_sync_link",
                        entity_id=str(client_profile.id),
                        after_state={
                            "direction": "portal_to_crm",
                            "external_id": existing.external_id,
                            "linked_by": "email_match",
                        },
                    )
                else:
                    # Create new contact
                    result = await self._create_contact(properties)
                    client_profile.external_crm_id = str(result["id"])
                    await _log_crm_sync(
                        db,
                        action="crm_sync_create",
                        entity_id=str(client_profile.id),
                        after_state={
                            "direction": "portal_to_crm",
                            "external_id": client_profile.external_crm_id,
                        },
                    )

                return CRMSyncResult(
                    success=True,
                    direction="portal_to_crm",
                    external_id=client_profile.external_crm_id,
                    changes=properties,
                )

        except httpx.HTTPStatusError as exc:
            error_msg = f"HubSpot API error: {exc.response.status_code}"
            logger.exception("CRM sync push failed for client %s", client_profile.id)
            return CRMSyncResult(
                success=False, direction="portal_to_crm", error=error_msg
            )

    async def sync_client_from_crm(
        self, db: AsyncSession, external_id: str
    ) -> CRMSyncResult:
        """Pull CRM data into portal. Only fills empty portal fields."""
        try:
            crm_data = await self._get_contact(external_id)
            properties: dict[str, str] = crm_data.get("properties", {})

            # Find portal profile linked to this CRM ID
            result = await db.execute(
                select(ClientProfile).where(
                    ClientProfile.external_crm_id == external_id
                )
            )
            profile = result.scalar_one_or_none()
            if not profile:
                return CRMSyncResult(
                    success=False,
                    direction="crm_to_portal",
                    external_id=external_id,
                    error="No portal profile linked to this CRM ID",
                )

            updates = self._hubspot_to_profile_updates(properties, profile)
            if updates:
                for field, value in updates.items():
                    setattr(profile, field, value)
                await _log_crm_sync(
                    db,
                    action="crm_sync_pull",
                    entity_id=str(profile.id),
                    after_state={
                        "direction": "crm_to_portal",
                        "external_id": external_id,
                        "fields_imported": list(updates.keys()),
                    },
                )

            return CRMSyncResult(
                success=True,
                direction="crm_to_portal",
                external_id=external_id,
                changes=updates,
            )

        except httpx.HTTPStatusError as exc:
            error_msg = f"HubSpot API error: {exc.response.status_code}"
            logger.exception("CRM sync pull failed for external_id=%s", external_id)
            return CRMSyncResult(
                success=False,
                direction="crm_to_portal",
                external_id=external_id,
                error=error_msg,
            )

    async def sync_communications(
        self, db: AsyncSession, client_id: uuid.UUID
    ) -> CRMSyncResult:
        """Sync communication records from portal to CRM as HubSpot notes."""
        # Look up the profile to find the CRM contact ID
        result = await db.execute(
            select(ClientProfile).where(ClientProfile.id == client_id)
        )
        profile = result.scalar_one_or_none()
        if not profile or not profile.external_crm_id:
            return CRMSyncResult(
                success=False,
                direction="portal_to_crm",
                error="Client has no linked CRM contact",
            )

        # Fetch sent communications for this client
        comms_result = await db.execute(
            select(Communication)
            .where(
                Communication.client_id == client_id,
                Communication.status == "sent",
            )
            .order_by(Communication.sent_at.desc())
            .limit(50)
        )
        communications = comms_result.scalars().all()

        synced_count = 0
        errors: list[str] = []
        for comm in communications:
            note_body = f"[{comm.channel}] {comm.subject or 'No subject'}\n\n{comm.body}"
            try:
                await self._create_note(
                    profile.external_crm_id,
                    note_body,
                    timestamp=comm.sent_at,
                )
                synced_count += 1
            except httpx.HTTPStatusError:
                errors.append(str(comm.id))
                logger.exception(
                    "Failed to sync communication %s to CRM", comm.id
                )

        await _log_crm_sync(
            db,
            action="crm_sync_comms",
            entity_id=str(client_id),
            after_state={
                "direction": "portal_to_crm",
                "external_id": profile.external_crm_id,
                "synced_count": synced_count,
                "error_count": len(errors),
            },
        )

        return CRMSyncResult(
            success=len(errors) == 0,
            direction="portal_to_crm",
            external_id=profile.external_crm_id,
            changes={"synced": synced_count, "errors": errors},
        )


# ---------------------------------------------------------------------------
# No-op implementation (when CRM is disabled)
# ---------------------------------------------------------------------------


class NoOpCRMService(BaseCRMService):
    """No-op CRM service used when CRM integration is disabled."""

    async def sync_client_to_crm(
        self, db: AsyncSession, client_profile: ClientProfile
    ) -> CRMSyncResult:
        return CRMSyncResult(success=True, direction="portal_to_crm")

    async def sync_client_from_crm(
        self, db: AsyncSession, external_id: str
    ) -> CRMSyncResult:
        return CRMSyncResult(success=True, direction="crm_to_portal")

    async def sync_communications(
        self, db: AsyncSession, client_id: uuid.UUID
    ) -> CRMSyncResult:
        return CRMSyncResult(success=True, direction="portal_to_crm")

    async def search_crm_contact(self, email: str) -> CRMContact | None:
        return None


# ---------------------------------------------------------------------------
# Audit helper
# ---------------------------------------------------------------------------


async def _log_crm_sync(
    db: AsyncSession,
    *,
    action: str,
    entity_id: str,
    after_state: dict[str, Any],
) -> None:
    """Write an audit-log entry for a CRM sync operation."""
    entry = AuditLog(
        user_id=None,
        user_email="system@crm-sync",
        action=action,
        entity_type="client_profile",
        entity_id=entity_id,
        before_state=None,
        after_state=after_state,
    )
    db.add(entry)
    await db.flush()


# ---------------------------------------------------------------------------
# Bulk sync (used by scheduler)
# ---------------------------------------------------------------------------


async def run_crm_sync_all(service: BaseCRMService, db: AsyncSession) -> dict[str, int]:
    """Sync all client profiles modified since last sync.

    Returns counts of successful and failed syncs.
    """
    result = await db.execute(select(ClientProfile))
    profiles = result.scalars().all()

    stats = {"pushed": 0, "pulled": 0, "errors": 0}

    for profile in profiles:
        # Portal → CRM (push)
        push_result = await service.sync_client_to_crm(db, profile)
        if push_result.success:
            stats["pushed"] += 1
        else:
            stats["errors"] += 1
            logger.warning(
                "CRM push failed for client %s: %s",
                profile.id,
                push_result.error,
            )

        # CRM → Portal (pull — only fills empty fields)
        if profile.external_crm_id:
            pull_result = await service.sync_client_from_crm(
                db, profile.external_crm_id
            )
            if pull_result.success:
                stats["pulled"] += 1
            else:
                stats["errors"] += 1
                logger.warning(
                    "CRM pull failed for client %s: %s",
                    profile.id,
                    pull_result.error,
                )

    await db.commit()
    return stats


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def get_crm_service() -> BaseCRMService:
    """Return the appropriate CRM service based on configuration."""
    if not settings.CRM_SYNC_ENABLED or not settings.CRM_PROVIDER:
        return NoOpCRMService()

    provider = settings.CRM_PROVIDER.lower()
    if provider == "hubspot":
        return HubSpotCRMService()

    logger.warning("Unknown CRM provider '%s', using no-op service", provider)
    return NoOpCRMService()


crm_service = get_crm_service()
