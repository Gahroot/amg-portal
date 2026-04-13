import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.enums import LeadStatus
from app.models.lead import Lead
from app.schemas.lead import LeadConvertRequest, LeadCreate, LeadUpdate
from app.services.crud_base import CRUDBase


class LeadService(CRUDBase[Lead, LeadCreate, LeadUpdate]):
    def __init__(self) -> None:
        super().__init__(Lead)

    async def create_for_owner(
        self,
        db: AsyncSession,
        *,
        data: LeadCreate,
        default_owner_id: uuid.UUID,
    ) -> Lead:
        payload: dict[str, Any] = data.model_dump(exclude_unset=True)
        if not payload.get("owner_id"):
            payload["owner_id"] = default_owner_id
        db_obj = Lead(**payload)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def convert_to_client(
        self,
        db: AsyncSession,
        *,
        lead_id: uuid.UUID,
        convert: LeadConvertRequest,
        created_by_id: uuid.UUID,
    ) -> Lead:
        """Convert a qualified lead into a ClientProfile intake.

        Creates a ClientProfile in pending-compliance state and stamps the lead
        as converted. Existing intake workflow handles downstream notifications.
        """
        lead = await self.get(db, lead_id)
        if not lead:
            raise NotFoundException("Lead not found")
        if lead.status == LeadStatus.converted:
            raise BadRequestException("Lead already converted")
        if lead.status == LeadStatus.disqualified:
            raise BadRequestException("Cannot convert a disqualified lead")

        from app.models.client_profile import ClientProfile
        from app.models.enums import ApprovalStatus, ComplianceStatus

        profile = ClientProfile(
            legal_name=convert.legal_name,
            display_name=convert.legal_name,
            primary_email=convert.primary_email,
            phone=convert.phone,
            entity_type=convert.entity_type.value,
            assigned_rm_id=lead.owner_id,
            created_by=created_by_id,
            compliance_status=ComplianceStatus.pending_review.value,
            approval_status=ApprovalStatus.pending_compliance.value,
        )
        if convert.notes:
            profile.compliance_notes = convert.notes
        db.add(profile)
        await db.flush()

        lead.status = LeadStatus.converted
        lead.converted_at = datetime.now(UTC)
        lead.converted_client_profile_id = profile.id
        await db.commit()
        await db.refresh(lead)

        from app.services.intake_workflow_service import on_intake_created

        await on_intake_created(db, profile)
        return lead


lead_service = LeadService()
