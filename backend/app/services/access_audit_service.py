"""Service for access audit operations."""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.access_audit import AccessAudit, AccessAuditFinding
from app.models.client_profile import ClientProfile
from app.models.partner import PartnerProfile
from app.models.user import User
from app.schemas.access_audit import (
    CreateAccessAuditFindingRequest,
    CreateAccessAuditRequest,
    UpdateAccessAuditFindingRequest,
    UpdateAccessAuditRequest,
)
from app.services.crud_base import CRUDBase

logger = logging.getLogger(__name__)


class AccessAuditService(CRUDBase[AccessAudit, CreateAccessAuditRequest, UpdateAccessAuditRequest]):
    """Service for access audit operations."""

    async def get_current_quarter_audit(
        self,
        db: AsyncSession,
    ) -> AccessAudit | None:
        """Get the audit for the current quarter."""
        now = datetime.now(UTC)
        quarter = (now.month - 1) // 3 + 1
        year = now.year

        result = await db.execute(
            select(AccessAudit)
            .options(selectinload(AccessAudit.findings), selectinload(AccessAudit.auditor))
            .where(AccessAudit.quarter == quarter, AccessAudit.year == year)
        )
        return result.scalar_one_or_none()

    async def get_audits_by_year(
        self,
        db: AsyncSession,
        year: int,
    ) -> list[AccessAudit]:
        """Get all audits for a given year."""
        result = await db.execute(
            select(AccessAudit)
            .options(selectinload(AccessAudit.findings), selectinload(AccessAudit.auditor))
            .where(AccessAudit.year == year)
            .order_by(AccessAudit.quarter)
        )
        return list(result.scalars().all())

    async def create_quarterly_audit(
        self,
        db: AsyncSession,
        quarter: int,
        year: int,
        auditor_id: uuid.UUID | None = None,
    ) -> AccessAudit:
        """Create a new quarterly access audit."""
        audit_period = f"Q{quarter} {year}"
        audit = AccessAudit(
            audit_period=audit_period,
            quarter=quarter,
            year=year,
            status="draft",
            auditor_id=auditor_id,
            started_at=datetime.now(UTC),
        )
        db.add(audit)
        await db.commit()
        await db.refresh(audit)
        return audit

    async def add_finding(
        self,
        db: AsyncSession,
        audit_id: uuid.UUID,
        data: CreateAccessAuditFindingRequest,
    ) -> AccessAuditFinding:
        """Add a finding to an audit."""
        finding = AccessAuditFinding(
            audit_id=audit_id,
            user_id=data.user_id,
            finding_type=data.finding_type,
            severity=data.severity,
            description=data.description,
            recommendation=data.recommendation,
            status="open",
        )
        db.add(finding)

        # Update audit's anomalies_found count
        result = await db.execute(
            select(AccessAudit).where(AccessAudit.id == audit_id)
        )
        audit = result.scalar_one()
        audit.anomalies_found = (audit.anomalies_found or 0) + 1

        await db.commit()
        await db.refresh(finding)
        return finding

    async def update_finding(
        self,
        db: AsyncSession,
        finding_id: uuid.UUID,
        data: UpdateAccessAuditFindingRequest,
    ) -> AccessAuditFinding | None:
        """Update an audit finding."""
        result = await db.execute(
            select(AccessAuditFinding).where(AccessAuditFinding.id == finding_id)
        )
        finding = result.scalar_one_or_none()
        if not finding:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(finding, field, value)

        await db.commit()
        await db.refresh(finding)
        return finding

    async def remediate_finding(
        self,
        db: AsyncSession,
        finding_id: uuid.UUID,
        user_id: uuid.UUID,
        remediation_notes: str | None = None,
    ) -> AccessAuditFinding | None:
        """Mark a finding as remediated."""
        result = await db.execute(
            select(AccessAuditFinding).where(AccessAuditFinding.id == finding_id)
        )
        finding = result.scalar_one_or_none()
        if not finding:
            return None

        finding.status = "remediated"
        finding.remediated_by = user_id
        finding.remediated_at = datetime.now(UTC)
        if remediation_notes:
            finding.remediation_notes = remediation_notes

        await db.commit()
        await db.refresh(finding)
        return finding

    async def acknowledge_finding(
        self,
        db: AsyncSession,
        finding_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> AccessAuditFinding | None:
        """Acknowledge a finding."""
        result = await db.execute(
            select(AccessAuditFinding).where(AccessAuditFinding.id == finding_id)
        )
        finding = result.scalar_one_or_none()
        if not finding:
            return None

        finding.status = "acknowledged"
        finding.acknowledged_by = user_id
        finding.acknowledged_at = datetime.now(UTC)

        await db.commit()
        await db.refresh(finding)
        return finding

    async def waive_finding(
        self,
        db: AsyncSession,
        finding_id: uuid.UUID,
        user_id: uuid.UUID,
        waived_reason: str,
    ) -> AccessAuditFinding | None:
        """Waive a finding with a reason."""
        result = await db.execute(
            select(AccessAuditFinding).where(AccessAuditFinding.id == finding_id)
        )
        finding = result.scalar_one_or_none()
        if not finding:
            return None

        finding.status = "waived"
        finding.waived_by = user_id
        finding.waived_at = datetime.now(UTC)
        finding.waived_reason = waived_reason

        await db.commit()
        await db.refresh(finding)
        return finding

    async def complete_audit(
        self,
        db: AsyncSession,
        audit_id: uuid.UUID,
    ) -> AccessAudit | None:
        """Mark an audit as complete."""
        result = await db.execute(
            select(AccessAudit).where(AccessAudit.id == audit_id)
        )
        audit = result.scalar_one_or_none()
        if not audit:
            return None

        audit.status = "completed"
        audit.completed_at = datetime.now(UTC)

        await db.commit()
        await db.refresh(audit)
        return audit

    async def get_audit_statistics(
        self,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Get statistics about access audits."""
        # Total counts by status
        status_counts = {}
        for status in ["draft", "in_review", "completed"]:
            count_result = await db.execute(
                select(func.count()).where(AccessAudit.status == status)
            )
            status_counts[status] = count_result.scalar_one()

        total_result = await db.execute(select(func.count()).select_from(AccessAudit))
        total = total_result.scalar_one()

        # Finding counts
        total_findings_result = await db.execute(
            select(func.count()).select_from(AccessAuditFinding)
        )
        total_findings = total_findings_result.scalar_one()

        open_findings_result = await db.execute(
            select(func.count()).where(
                AccessAuditFinding.status.in_(["open", "acknowledged", "in_progress"])
            )
        )
        open_findings = open_findings_result.scalar_one()

        remediated_result = await db.execute(
            select(func.count()).where(AccessAuditFinding.status == "remediated")
        )
        remediated_findings = remediated_result.scalar_one()

        waived_result = await db.execute(
            select(func.count()).where(AccessAuditFinding.status == "waived")
        )
        waived_findings = waived_result.scalar_one()

        # By severity
        severity_result = await db.execute(
            select(AccessAuditFinding.severity, func.count().label("count"))
            .group_by(AccessAuditFinding.severity)
        )
        by_severity = {row.severity: row.count for row in severity_result.all()}

        # By quarter
        quarter_result = await db.execute(
            select(AccessAudit.audit_period, func.count().label("count"))
            .group_by(AccessAudit.audit_period)
            .order_by(AccessAudit.year.desc(), AccessAudit.quarter.desc())
            .limit(8)
        )
        by_quarter = {row.audit_period: row.count for row in quarter_result.all()}

        return {
            "total": total,
            **status_counts,
            "total_findings": total_findings,
            "open_findings": open_findings,
            "remediated_findings": remediated_findings,
            "waived_findings": waived_findings,
            "by_severity": by_severity,
            "by_quarter": by_quarter,
        }

    async def get_audit_with_findings(
        self,
        db: AsyncSession,
        audit_id: uuid.UUID,
    ) -> AccessAudit | None:
        """Get an audit with all findings and related user details."""
        result = await db.execute(
            select(AccessAudit)
            .options(
                selectinload(AccessAudit.auditor),
                selectinload(AccessAudit.findings).selectinload(AccessAuditFinding.user),
                selectinload(AccessAudit.findings).selectinload(AccessAuditFinding.remediator),
            )
            .where(AccessAudit.id == audit_id)
        )
        return result.scalar_one_or_none()

    async def list_findings(
        self,
        db: AsyncSession,
        status: str | None = None,
        severity: str | None = None,
        finding_type: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[AccessAuditFinding], int]:
        """List findings across all audits with optional filters."""
        base = select(AccessAuditFinding)

        if status:
            base = base.where(AccessAuditFinding.status == status)
        if severity:
            base = base.where(AccessAuditFinding.severity == severity)
        if finding_type:
            base = base.where(AccessAuditFinding.finding_type == finding_type)

        count_query = select(func.count()).select_from(base.subquery())
        total = (await db.execute(count_query)).scalar_one()

        result = await db.execute(
            base.options(
                selectinload(AccessAuditFinding.audit),
                selectinload(AccessAuditFinding.user),
            )
            .order_by(AccessAuditFinding.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        findings = list(result.scalars().all())
        return findings, total


    async def run_quarterly_access_audit(
        self,
        db: AsyncSession,
    ) -> AccessAudit | None:
        """Auto-create a quarterly access audit with findings for dormant accounts,
        role mismatches, and orphaned accounts.

        Returns the created audit, or ``None`` if an audit already exists for the
        current quarter.
        """
        now = datetime.now(UTC)
        quarter = (now.month - 1) // 3 + 1
        year = now.year

        # Check if an audit already exists for this quarter
        existing = await db.execute(
            select(AccessAudit).where(
                AccessAudit.quarter == quarter,
                AccessAudit.year == year,
            )
        )
        if existing.scalar_one_or_none() is not None:
            logger.info(
                "Quarterly access audit already exists for Q%d %d — skipping",
                quarter,
                year,
            )
            return None

        # Create the audit record
        audit_period = f"Q{quarter} {year}"
        audit = AccessAudit(
            audit_period=audit_period,
            quarter=quarter,
            year=year,
            status="in_review",
            started_at=now,
        )
        db.add(audit)
        await db.flush()  # populate audit.id

        findings: list[AccessAuditFinding] = []

        # --- 1. Dormant account detection ---
        dormant_cutoff = now - timedelta(days=settings.DORMANT_ACCOUNT_DAYS)
        dormant_result = await db.execute(
            select(User).where(
                User.status == "active",
                User.updated_at < dormant_cutoff,
            )
        )
        dormant_users = dormant_result.scalars().all()
        for user in dormant_users:
            days_inactive = (now - user.updated_at).days
            findings.append(
                AccessAuditFinding(
                    audit_id=audit.id,
                    user_id=user.id,
                    finding_type="inactive_user",
                    severity="medium",
                    description=(
                        f"User {user.email} (role: {user.role}) has had no activity "
                        f"for {days_inactive} days (last updated: "
                        f"{user.updated_at.strftime('%Y-%m-%d')})."
                    ),
                    recommendation=(
                        "Review and deactivate if no longer needed."
                    ),
                    status="open",
                )
            )

        # --- 2. Role mismatch detection ---
        # Partners without a PartnerProfile
        partner_users_result = await db.execute(
            select(User).where(User.role == "partner", User.status == "active")
        )
        partner_users = partner_users_result.scalars().all()
        partner_user_ids = [u.id for u in partner_users]

        if partner_user_ids:
            existing_profiles_result = await db.execute(
                select(PartnerProfile.user_id).where(
                    PartnerProfile.user_id.in_(partner_user_ids)
                )
            )
            partner_profile_user_ids = set(existing_profiles_result.scalars().all())
            for user in partner_users:
                if user.id not in partner_profile_user_ids:
                    findings.append(
                        AccessAuditFinding(
                            audit_id=audit.id,
                            user_id=user.id,
                            finding_type="role_mismatch",
                            severity="high",
                            description=(
                                f"User {user.email} has role 'partner' but no "
                                "associated PartnerProfile record."
                            ),
                            recommendation=(
                                "Create a PartnerProfile or correct the user role."
                            ),
                            status="open",
                        )
                    )

        # Clients without a ClientProfile
        client_users_result = await db.execute(
            select(User).where(User.role == "client", User.status == "active")
        )
        client_users = client_users_result.scalars().all()
        client_user_ids = [u.id for u in client_users]

        if client_user_ids:
            existing_client_profiles_result = await db.execute(
                select(ClientProfile.user_id).where(
                    ClientProfile.user_id.in_(client_user_ids)
                )
            )
            client_profile_user_ids = set(
                existing_client_profiles_result.scalars().all()
            )
            for user in client_users:
                if user.id not in client_profile_user_ids:
                    findings.append(
                        AccessAuditFinding(
                            audit_id=audit.id,
                            user_id=user.id,
                            finding_type="role_mismatch",
                            severity="high",
                            description=(
                                f"User {user.email} has role 'client' but no "
                                "associated ClientProfile record."
                            ),
                            recommendation=(
                                "Create a ClientProfile or correct the user role."
                            ),
                            status="open",
                        )
                    )

        # --- 3. Orphaned accounts ---
        # PartnerProfiles linked to deactivated users
        orphaned_result = await db.execute(
            select(PartnerProfile, User).join(
                User, PartnerProfile.user_id == User.id
            ).where(
                PartnerProfile.user_id.isnot(None),
                User.status != "active",
            )
        )
        orphaned_rows = orphaned_result.all()
        for partner_profile, user in orphaned_rows:
            findings.append(
                AccessAuditFinding(
                    audit_id=audit.id,
                    user_id=user.id,
                    finding_type="orphaned_account",
                    severity="medium",
                    description=(
                        f"PartnerProfile '{partner_profile.firm_name}' "
                        f"(id: {partner_profile.id}) is linked to deactivated user "
                        f"{user.email} (status: {user.status})."
                    ),
                    recommendation=(
                        "Unlink the partner profile from the deactivated user "
                        "or reactivate the user account."
                    ),
                    status="open",
                )
            )

        # Persist all findings
        for finding in findings:
            db.add(finding)

        # Count total users reviewed
        total_users_result = await db.execute(
            select(func.count()).select_from(User)
        )
        total_users = total_users_result.scalar_one()

        audit.users_reviewed = total_users
        audit.anomalies_found = len(findings)

        await db.commit()
        await db.refresh(audit)

        logger.info(
            "Quarterly access audit Q%d %d created — %d users reviewed, %d findings",
            quarter,
            year,
            total_users,
            len(findings),
        )
        return audit


access_audit_service = AccessAuditService(AccessAudit)
