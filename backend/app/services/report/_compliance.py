"""Compliance audit report."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.user import User


class ComplianceAuditMixin:
    """Compliance / KYC / access-audit report."""

    async def get_compliance_audit_report(  # noqa: PLR0912, PLR0915
        self,
        db: AsyncSession,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        """
        Generate compliance audit report for finance/compliance and MD review.

        Covers:
        - KYC status per client: current, expiring ≤30 days, expired
        - Document completeness percentage per client
        - Open access anomalies from the latest access audit
        - User account status summary

        When ``start_date`` / ``end_date`` are supplied, all record fetches are
        filtered to rows whose ``created_at`` falls within that range, avoiding
        unbounded full-table scans.
        """
        from app.models.access_audit import AccessAudit
        from app.models.kyc_document import KYCDocument

        today = datetime.now(UTC).date()
        expiry_threshold = today + timedelta(days=30)

        ts_start = (
            datetime(start_date.year, start_date.month, start_date.day, tzinfo=UTC)
            if start_date
            else None
        )
        ts_end = (
            datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999, tzinfo=UTC)
            if end_date
            else None
        )

        # ------------------------------------------------------------------
        # 1. Clients filtered by creation date range
        # ------------------------------------------------------------------
        client_query = select(Client).order_by(Client.name)
        if ts_start is not None:
            client_query = client_query.where(Client.created_at >= ts_start)
        if ts_end is not None:
            client_query = client_query.where(Client.created_at <= ts_end)
        clients_result = await db.execute(client_query)
        clients = list(clients_result.scalars().all())

        # ------------------------------------------------------------------
        # 1b. KYC document counts aggregated in SQL — one row per client.
        # ------------------------------------------------------------------
        kyc_agg_query = select(
            KYCDocument.client_id,
            func.count().label("total"),
            func.count(
                case(
                    (
                        and_(
                            KYCDocument.status == "verified",
                            (KYCDocument.expiry_date.is_(None))
                            | (KYCDocument.expiry_date > expiry_threshold),
                        ),
                        KYCDocument.id,
                    )
                )
            ).label("current"),
            func.count(
                case(
                    (
                        and_(
                            KYCDocument.status == "verified",
                            KYCDocument.expiry_date.isnot(None),
                            KYCDocument.expiry_date > today,
                            KYCDocument.expiry_date <= expiry_threshold,
                        ),
                        KYCDocument.id,
                    )
                )
            ).label("expiring_30d"),
            func.count(
                case(
                    (
                        (KYCDocument.status == "expired")
                        | and_(
                            KYCDocument.status == "verified",
                            KYCDocument.expiry_date.isnot(None),
                            KYCDocument.expiry_date < today,
                        ),
                        KYCDocument.id,
                    )
                )
            ).label("expired"),
            func.count(
                case(
                    (
                        KYCDocument.status.in_(["pending", "uploaded"]),
                        KYCDocument.id,
                    )
                )
            ).label("pending"),
        ).group_by(KYCDocument.client_id)
        if ts_start is not None:
            kyc_agg_query = kyc_agg_query.where(KYCDocument.created_at >= ts_start)
        if ts_end is not None:
            kyc_agg_query = kyc_agg_query.where(KYCDocument.created_at <= ts_end)

        kyc_agg_result = await db.execute(kyc_agg_query)
        kyc_by_client: dict[Any, Any] = {row.client_id: row for row in kyc_agg_result}

        client_kyc_statuses: list[dict[str, Any]] = []
        total_kyc_current = 0
        total_kyc_expiring = 0
        total_kyc_expired = 0

        for client in clients:
            agg = kyc_by_client.get(client.id)
            total: int = agg.total if agg else 0
            current: int = agg.current if agg else 0
            expiring_30d: int = agg.expiring_30d if agg else 0
            expired: int = agg.expired if agg else 0
            pending: int = agg.pending if agg else 0

            completeness_pct = (
                round((current + expiring_30d) / total * 100, 1) if total > 0 else 0.0
            )

            total_kyc_current += current
            total_kyc_expiring += expiring_30d
            total_kyc_expired += expired

            if expired > 0:
                kyc_status = "expired"
            elif expiring_30d > 0:
                kyc_status = "expiring"
            elif pending > 0:
                kyc_status = "pending"
            elif current > 0:
                kyc_status = "current"
            else:
                kyc_status = "incomplete"

            client_kyc_statuses.append(
                {
                    "client_id": client.id,
                    "client_name": client.name,
                    "client_type": client.client_type,
                    "total_documents": total,
                    "current": current,
                    "expiring_30d": expiring_30d,
                    "expired": expired,
                    "pending": pending,
                    "document_completeness_pct": completeness_pct,
                    "kyc_status": kyc_status,
                }
            )

        # ------------------------------------------------------------------
        # 2. Latest access audit open findings
        # ------------------------------------------------------------------
        latest_audit_result = await db.execute(
            select(AccessAudit)
            .options(selectinload(AccessAudit.findings))
            .order_by(AccessAudit.created_at.desc())
            .limit(1)
        )
        latest_audit = latest_audit_result.scalar_one_or_none()

        access_anomalies: list[dict[str, Any]] = []
        latest_audit_period: str | None = None
        if latest_audit:
            latest_audit_period = latest_audit.audit_period
            for finding in latest_audit.findings or []:
                if finding.status not in ("remediated", "closed", "waived"):
                    access_anomalies.append(
                        {
                            "id": finding.id,
                            "audit_period": latest_audit.audit_period,
                            "finding_type": finding.finding_type,
                            "severity": finding.severity,
                            "description": finding.description,
                            "status": finding.status,
                            "user_id": finding.user_id,
                        }
                    )

        # ------------------------------------------------------------------
        # 3. User account statuses
        # ------------------------------------------------------------------
        user_counts_query = select(User.status, func.count(User.id).label("cnt")).group_by(
            User.status
        )
        if ts_start is not None:
            user_counts_query = user_counts_query.where(User.created_at >= ts_start)
        if ts_end is not None:
            user_counts_query = user_counts_query.where(User.created_at <= ts_end)
        user_counts_result = await db.execute(user_counts_query)

        active_users = 0
        inactive_users = 0
        deactivated_users = 0
        for status_row in user_counts_result:
            if status_row.status == "active":
                active_users = status_row.cnt
            elif status_row.status == "deactivated":
                deactivated_users = status_row.cnt
            else:
                inactive_users += status_row.cnt

        user_detail_query = select(
            User.id,
            User.full_name,
            User.email,
            User.role,
            User.status,
            User.created_at,
        ).order_by(User.full_name)
        if ts_start is not None:
            user_detail_query = user_detail_query.where(User.created_at >= ts_start)
        if ts_end is not None:
            user_detail_query = user_detail_query.where(User.created_at <= ts_end)
        users_result = await db.execute(user_detail_query)

        user_account_statuses: list[dict[str, Any]] = []
        total_users = 0
        for u in users_result:
            total_users += 1
            user_account_statuses.append(
                {
                    "user_id": u.id,
                    "full_name": u.full_name,
                    "email": u.email,
                    "role": u.role,
                    "status": u.status,
                    "created_at": u.created_at.isoformat(),
                }
            )

        return {
            "total_clients": len(clients),
            "kyc_current": total_kyc_current,
            "kyc_expiring_30d": total_kyc_expiring,
            "kyc_expired": total_kyc_expired,
            "client_kyc_statuses": client_kyc_statuses,
            "access_anomalies": access_anomalies,
            "latest_audit_period": latest_audit_period,
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": inactive_users,
            "deactivated_users": deactivated_users,
            "user_account_statuses": user_account_statuses,
            "generated_at": datetime.now(UTC).isoformat(),
        }
