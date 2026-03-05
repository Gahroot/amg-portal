import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.client_profile import ClientProfile
from app.models.enums import ApprovalStatus, ComplianceStatus
from app.schemas.client_profile import (
    ClientProfileCreate,
    ClientProfileUpdate,
    ClientProvisionRequest,
    ComplianceCertificate,
    ComplianceReviewRequest,
    MDApprovalRequest,
)
from app.services.crud_base import CRUDBase


class ClientService(CRUDBase[ClientProfile, ClientProfileCreate, ClientProfileUpdate]):
    def __init__(self) -> None:
        super().__init__(ClientProfile)

    async def create_intake(
        self, db: AsyncSession, *, data: ClientProfileCreate, created_by_id: uuid.UUID
    ) -> ClientProfile:
        return await self.create(
            db,
            obj_in=data,
            created_by=created_by_id,
            compliance_status=ComplianceStatus.pending_review.value,
            approval_status=ApprovalStatus.pending_compliance.value,
        )

    async def submit_compliance_review(
        self,
        db: AsyncSession,
        *,
        profile_id: uuid.UUID,
        review: ComplianceReviewRequest,
        reviewer_id: uuid.UUID,
    ) -> ClientProfile:
        profile = await self.get(db, profile_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
        if profile.compliance_status not in (
            ComplianceStatus.pending_review.value,
            ComplianceStatus.under_review.value,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot review profile in {profile.compliance_status} state",
            )

        update_data = {
            "compliance_status": review.status.value,
            "compliance_notes": review.notes,
            "compliance_reviewed_by": reviewer_id,
            "compliance_reviewed_at": datetime.now(UTC),
        }
        if review.status == ComplianceStatus.cleared:
            update_data["approval_status"] = ApprovalStatus.pending_md_approval.value
        elif review.status == ComplianceStatus.rejected:
            update_data["approval_status"] = ApprovalStatus.rejected.value

        updated_profile = await self.update(db, db_obj=profile, obj_in=update_data)

        final_statuses = (
            ComplianceStatus.cleared,
            ComplianceStatus.rejected,
            ComplianceStatus.flagged,
        )
        if review.status in final_statuses:
            from app.services.email_service import send_compliance_notification

            await send_compliance_notification(
                email=updated_profile.primary_email,
                profile_name=updated_profile.display_name or updated_profile.legal_name,
                status=review.status.value,
            )

        return updated_profile

    async def submit_md_approval(
        self,
        db: AsyncSession,
        *,
        profile_id: uuid.UUID,
        approval: MDApprovalRequest,
        approver_id: uuid.UUID,
    ) -> ClientProfile:
        profile = await self.get(db, profile_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
        if profile.approval_status != ApprovalStatus.pending_md_approval.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot approve profile in {profile.approval_status} state",
            )

        update_data: dict[str, Any] = {
            "approved_by": approver_id,
            "approved_at": datetime.now(UTC),
        }
        if approval.approved:
            update_data["approval_status"] = ApprovalStatus.approved.value
            if approval.assigned_rm_id:
                update_data["assigned_rm_id"] = approval.assigned_rm_id
        else:
            update_data["approval_status"] = ApprovalStatus.rejected.value
        if approval.notes:
            update_data["compliance_notes"] = (
                profile.compliance_notes or ""
            ) + f"\nMD: {approval.notes}"

        return await self.update(db, db_obj=profile, obj_in=update_data)

    async def provision_client_user(
        self, db: AsyncSession, *, profile_id: uuid.UUID, request: ClientProvisionRequest
    ) -> ClientProfile:
        from app.core.security import hash_password
        from app.models.user import User

        profile = await self.get(db, profile_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
        if profile.approval_status != ApprovalStatus.approved.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Profile must be approved before provisioning",
            )
        if profile.user_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Client user already provisioned"
            )

        password = request.password or str(uuid.uuid4())[:12]
        user = User(
            email=profile.primary_email,
            hashed_password=hash_password(password),
            full_name=profile.display_name or profile.legal_name,
            role="client",
            status="active",
        )
        db.add(user)
        await db.flush()

        profile.user_id = user.id
        profile.portal_access_enabled = True
        profile.welcome_email_sent = request.send_welcome_email
        await db.commit()
        await db.refresh(profile)

        if request.send_welcome_email:
            from app.services.email_service import send_welcome_email

            await send_welcome_email(
                email=profile.primary_email,
                name=profile.display_name or profile.legal_name,
                portal_url=settings.FRONTEND_URL,
            )

        return profile

    async def generate_compliance_certificate(
        self, db: AsyncSession, profile_id: uuid.UUID
    ) -> ComplianceCertificate:
        profile = await self.get(db, profile_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

        reviewer_name = None
        if profile.compliance_reviewed_by:
            from app.models.user import User

            result = await db.execute(select(User).where(User.id == profile.compliance_reviewed_by))
            reviewer = result.scalar_one_or_none()
            if reviewer:
                reviewer_name = reviewer.full_name

        return ComplianceCertificate(
            profile_id=profile.id,
            legal_name=profile.legal_name,
            compliance_status=profile.compliance_status,
            reviewed_by=reviewer_name,
            reviewed_at=profile.compliance_reviewed_at,
            certificate_date=datetime.now(UTC),
        )

    async def update_intelligence_file(
        self, db: AsyncSession, profile_id: uuid.UUID, data: dict[str, Any]
    ) -> ClientProfile:
        profile = await self.get(db, profile_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
        existing = profile.intelligence_file or {}
        existing.update(data)
        profile.intelligence_file = existing
        await db.commit()
        await db.refresh(profile)
        return profile

    async def get_rm_portfolio(
        self, db: AsyncSession, rm_id: uuid.UUID, *, skip: int = 0, limit: int = 50
    ) -> tuple[list[ClientProfile], int]:
        return await self.get_multi(
            db, skip=skip, limit=limit, filters=[ClientProfile.assigned_rm_id == rm_id]
        )

    async def get_client_dashboard_data(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> ClientProfile | None:
        result = await db.execute(select(ClientProfile).where(ClientProfile.user_id == user_id))
        return result.scalar_one_or_none()


client_service = ClientService()
