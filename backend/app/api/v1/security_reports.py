"""Browser-issued security reports: CSP violations + Reporting-API reports.

Receives ``Content-Security-Policy: report-uri`` POSTs (CSP Level 2 — content
type ``application/csp-report``) and the newer Reporting-API endpoint format
(``Content-Security-Policy: report-to`` — content type
``application/reports+json``).

We log structured violation events through the JSON-formatter pipeline so
they land in Railway logs as ``event=csp.violation``.  No DB persistence
(the volume can be unbounded if a misconfigured page chatters); aggregation
is left to the log SIEM.

References (real-world patterns):
- ``zulip/zulip`` ``zerver/views/report.py`` — field extraction order.
- ``rennf93/fastapi-guard`` ``examples/.../models.py`` — Pydantic alias map
  for the kebab-cased CSP fields.
- ``mozilla/normandy`` ``normandy/health/api/views.py`` — 204 reply on
  successful intake; tolerate malformed payloads.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field

from app.core.ip_utils import get_client_ip
from app.core.rate_limit import RateLimiter

logger = logging.getLogger("app.security.reports")

router = APIRouter(prefix="/security", tags=["security-reports"])

# 120/min per caller bucket — high enough that a single misconfigured
# page can still report each violation, low enough to cap log-flood abuse.
_csp_report_limiter = RateLimiter("csp_report", max_requests=120, window_seconds=60)
_reports_api_limiter = RateLimiter("reports_api", max_requests=120, window_seconds=60)


# ---------------------------------------------------------------------------
# CSP Level 2 payload (application/csp-report)
# ---------------------------------------------------------------------------


class CSPReportBody(BaseModel):
    """Inner ``csp-report`` object.  All fields optional — browsers vary."""

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    document_uri: str | None = Field(default=None, alias="document-uri")
    referrer: str | None = None
    blocked_uri: str | None = Field(default=None, alias="blocked-uri")
    violated_directive: str | None = Field(default=None, alias="violated-directive")
    effective_directive: str | None = Field(default=None, alias="effective-directive")
    original_policy: str | None = Field(default=None, alias="original-policy")
    disposition: str | None = None
    source_file: str | None = Field(default=None, alias="source-file")
    line_number: int | None = Field(default=None, alias="line-number")
    column_number: int | None = Field(default=None, alias="column-number")
    status_code: int | None = Field(default=None, alias="status-code")
    script_sample: str | None = Field(default=None, alias="script-sample")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _truncate(value: str | None, limit: int = 512) -> str | None:
    if value is None:
        return None
    return value if len(value) <= limit else value[: limit - 1] + "…"


def _log_violation(
    *,
    request: Request,
    payload_kind: str,
    body: dict[str, Any],
) -> None:
    extras = {
        "event": "csp.violation",
        "kind": payload_kind,
        "client_ip": get_client_ip(request),
        "user_agent": _truncate(request.headers.get("user-agent")),
    }
    for key in (
        "document-uri",
        "blocked-uri",
        "violated-directive",
        "effective-directive",
        "source-file",
        "line-number",
        "column-number",
        "disposition",
        "script-sample",
    ):
        if key in body and body[key] is not None:
            extras[key.replace("-", "_")] = _truncate(str(body[key]))
    logger.warning("csp violation: %s", extras.get("violated_directive"), extra=extras)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

# Browsers POST without our CSRF cookie (it's a side-channel report, not a
# user action), so the endpoint is exempted in ``app/middleware/csrf.py``.
# Per-IP rate-limit caps abuse — a hostile client can otherwise flood logs.


@router.post(
    "/csp-report",
    status_code=status.HTTP_204_NO_CONTENT,
    include_in_schema=False,
    dependencies=[Depends(_csp_report_limiter)],
)
async def csp_report(request: Request) -> Response:
    """CSP Level 2 endpoint (``application/csp-report``)."""
    try:
        raw = await request.json()
    except ValueError:
        logger.info(
            "csp.violation.unparsable",
            extra={"event": "csp.violation.unparsable", "client_ip": get_client_ip(request)},
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    body = raw.get("csp-report") if isinstance(raw, dict) else None
    if isinstance(body, dict):
        _log_violation(request=request, payload_kind="csp-report", body=body)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/reports",
    status_code=status.HTTP_204_NO_CONTENT,
    include_in_schema=False,
    dependencies=[Depends(_reports_api_limiter)],
)
async def reporting_api(request: Request) -> Response:
    """Reporting-API endpoint (``application/reports+json``).

    Newer browsers batch reports into an array of ``{type, url, body, age, ...}``
    envelopes.  We unwrap each ``csp-violation`` body and log it.
    """
    try:
        raw = await request.json()
    except ValueError:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    if not isinstance(raw, list):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    for envelope in raw:
        if not isinstance(envelope, dict):
            continue
        report_type = envelope.get("type")
        body = envelope.get("body")
        if report_type != "csp-violation" or not isinstance(body, dict):
            continue
        _log_violation(request=request, payload_kind="reporting-api", body=body)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
