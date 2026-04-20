"""Service for access audit operations."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.access_audit import AccessAudit, AccessAuditFinding, FindingStatus
from app.models.user import User
from app.schemas.access_audit import (
    CreateAccessAuditFindingRequest,
    CreateAccessAuditRequest,
    UpdateAccessAuditFindingRequest,
    UpdateAccessAuditRequest,
)
from app.services.crud_base import CRUDBase


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

    async def detect_dormant_accounts(
        self,
        db: AsyncSession,
        days_threshold: int = 90,
    ) -> list[User]:
        """Return active users who are considered dormant.

        A user is dormant if:
        - They have logged in before but not within *days_threshold* days, OR
        - They have never logged in and their account is older than *days_threshold* days.
        """
        cutoff = datetime.now(UTC) - timedelta(days=days_threshold)
        result = await db.execute(
            select(User).where(
                User.status == "active",
                or_(
                    # Has logged in, but not recently
                    User.last_login_at < cutoff,
                    # Has never logged in and account is old enough
                    (User.last_login_at.is_(None)) & (User.created_at < cutoff),
                ),
            )
        )
        return list(result.scalars().all())

    async def generate_dormant_findings(
        self,
        db: AsyncSession,
        audit_id: uuid.UUID,
        days_threshold: int = 90,
    ) -> list[AccessAuditFinding]:
        """Auto-detect dormant accounts and create inactive_user findings on an audit.

        Skips users that already have an open inactive_user finding for this audit
        so re-running the scan is safe.
        """
        dormant_users = await self.detect_dormant_accounts(db, days_threshold)
        if not dormant_users:
            return []

        # Fetch existing open inactive_user findings for this audit to avoid duplicates
        existing_result = await db.execute(
            select(AccessAuditFinding.user_id).where(
                AccessAuditFinding.audit_id == audit_id,
                AccessAuditFinding.finding_type == "inactive_user",
                AccessAuditFinding.status.in_(["open", "acknowledged", "in_progress"]),
            )
        )
        already_flagged: set[uuid.UUID | None] = set(existing_result.scalars().all())

        findings: list[AccessAuditFinding] = []
        audit_result = await db.execute(select(AccessAudit).where(AccessAudit.id == audit_id))
        audit = audit_result.scalar_one()

        for user in dormant_users:
            if user.id in already_flagged:
                continue

            if user.last_login_at is None:
                days_since = (datetime.now(UTC) - user.created_at).days
                description = (
                    f"User {user.full_name} ({user.email}) has never logged in "
                    f"and the account is {days_since} days old."
                )
            else:
                days_since = (datetime.now(UTC) - user.last_login_at).days
                description = (
                    f"User {user.full_name} ({user.email}) has not logged in "
                    f"for {days_since} days (last login: {user.last_login_at.date()})."
                )

            finding = AccessAuditFinding(
                audit_id=audit_id,
                user_id=user.id,
                finding_type="inactive_user",
                severity="medium",
                description=description,
                recommendation=(
                    "Deactivate this account immediately. If still required, "
                    "confirm access need with the user and document the justification."
                ),
                status="open",
            )
            db.add(finding)
            findings.append(finding)
            audit.anomalies_found = (audit.anomalies_found or 0) + 1

        if findings:
            await db.commit()
            for f in findings:
                await db.refresh(f)

        return findings

    async def create_quarterly_audit(
        self,
        db: AsyncSession,
        quarter: int,
        year: int,
        auditor_id: uuid.UUID | None = None,
        auto_detect_dormant: bool = True,
        dormant_days_threshold: int = 90,
    ) -> AccessAudit:
        """Create a new quarterly access audit.

        When *auto_detect_dormant* is True (default), dormant account findings
        are automatically generated immediately after the audit is created.
        """
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

        if auto_detect_dormant:
            await self.generate_dormant_findings(db, audit.id, dormant_days_threshold)
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
        result = await db.execute(select(AccessAudit).where(AccessAudit.id == audit_id))
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

        finding.status = FindingStatus.remediated
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

        finding.status = FindingStatus.acknowledged
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

        finding.status = FindingStatus.waived
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
        result = await db.execute(select(AccessAudit).where(AccessAudit.id == audit_id))
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
            select(AccessAuditFinding.severity, func.count().label("count")).group_by(
                AccessAuditFinding.severity
            )
        )
        by_severity = {row.severity: row.count for row in severity_result.all()}

        # By quarter
        quarter_result = await db.execute(
            select(AccessAudit.audit_period, func.count().label("count"))
            .group_by(AccessAudit.audit_period, AccessAudit.year, AccessAudit.quarter)
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


access_audit_service = AccessAuditService(AccessAudit)
