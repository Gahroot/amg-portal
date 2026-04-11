"""Report service package — generates client-, internal-, and partner-facing reports.

The original ``app.services.report_service`` module grew to ~1.3k LOC mixing
several unrelated reporting domains. It is now decomposed into private
submodules, each owning a single responsibility. The public API
(``compute_rag_status``, ``ReportService``, ``report_service``,
``PartnerReportService``, ``partner_report_service``) is preserved and
re-exported here so existing callers (``app.services.report_service`` shim
and direct imports of ``app.services.report``) continue to work unchanged.
"""

from __future__ import annotations

from app.utils.rag import compute_rag_status

from ._annual_review import AnnualReviewMixin
from ._compliance import ComplianceAuditMixin
from ._escalation_log import EscalationLogMixin
from ._partner import PartnerReportService, partner_report_service
from ._portfolio import PortfolioReportsMixin


class ReportService(
    PortfolioReportsMixin,
    AnnualReviewMixin,
    EscalationLogMixin,
    ComplianceAuditMixin,
):
    """Service for generating client-facing and internal reports."""


report_service = ReportService()


__all__ = [
    "compute_rag_status",
    "ReportService",
    "report_service",
    "PartnerReportService",
    "partner_report_service",
]
