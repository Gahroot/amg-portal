"""Backwards-compatible shim for the old monolithic ``report_service`` module.

The implementation now lives in :mod:`app.services.report`. This module
re-exports the public API so existing imports such as
``from app.services.report_service import report_service`` keep working
without any caller changes.
"""

from app.services.report import (
    PartnerReportService,
    ReportService,
    compute_rag_status,
    partner_report_service,
    report_service,
)

__all__ = [
    "compute_rag_status",
    "ReportService",
    "report_service",
    "PartnerReportService",
    "partner_report_service",
]
