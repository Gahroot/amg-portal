"""Service for access audit operations."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.access_audit import AccessAudit, AccessAuditFinding
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


access_audit_service = AccessAuditService(AccessAudit)
