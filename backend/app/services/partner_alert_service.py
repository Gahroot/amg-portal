"""Partner alert service — check performance thresholds and send trend alerts."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner import PartnerProfile
from app.models.partner_threshold import PartnerThreshold
from app.models.sla_tracker import SLATracker
from app.models.user import User
from app.schemas.notification import CreateNotificationRequest
from app.services.email_service import send_email
from app.services.notification_service import notification_service
from app.services.partner_scoring_service import calculate_partner_score
from app.services.partner_trends_service import TrendDataPoint, get_partner_trends

logger = logging.getLogger(__name__)

# ── Default threshold values (used when no DB record exists) ───────────────────

DEFAULT_SLA_COMPLIANCE_THRESHOLD: float = 90.0  # percent
DEFAULT_QUALITY_SCORE_THRESHOLD: float = 3.0  # 1–5 scale
DEFAULT_OVERALL_SCORE_THRESHOLD: float = 3.0  # 1–5 scale
DEFAULT_TREND_WINDOW_WEEKS: int = 3  # consecutive declining weeks before trend alert


# ── Data classes ──────────────────────────────────────────────────────────────


@dataclass
class ThresholdConfig:
    """Resolved threshold configuration for a partner."""

    sla_compliance_threshold: float = DEFAULT_SLA_COMPLIANCE_THRESHOLD
    quality_score_threshold: float = DEFAULT_QUALITY_SCORE_THRESHOLD
    overall_score_threshold: float = DEFAULT_OVERALL_SCORE_THRESHOLD
    trend_window_weeks: int = DEFAULT_TREND_WINDOW_WEEKS


@dataclass
class MetricAlert:
    """A single metric alert."""

    metric: str  # "sla_compliance_pct" | "avg_quality" | "avg_overall"
    label: str
    current_value: float | None
    threshold: float
    status: str  # "good" | "warning" | "critical"
    trend: str  # "improving" | "declining" | "stable" | "insufficient_data"
    suggestion: str


@dataclass
class PerformanceStatus:
    """Full performance status for a partner."""

    partner_id: str
    firm_name: str
    metrics: dict[str, float | None]
    thresholds: dict[str, float]
    alerts: list[MetricAlert] = field(default_factory=list)
    overall_status: str = "good"  # "good" | "warning" | "critical"


# ── Helpers ───────────────────────────────────────────────────────────────────


def _suggestion_for(metric: str, trend: str) -> str:
    """Return a human-readable improvement suggestion for a metric."""
    base: dict[str, str] = {
        "sla_compliance_pct": (
            "Respond to assignments within SLA windows. Review any pending assignments "
            "and ensure timely communication with your coordinator."
        ),
        "avg_quality": (
            "Review deliverable feedback carefully and address recurring issues. "
            "Consider requesting a quality briefing from your coordinator."
        ),
        "avg_overall": (
            "Schedule a performance review with your coordinator to identify "
            "improvement areas across all dimensions."
        ),
    }
    trend_suffix: dict[str, str] = {
        "declining": (" Your score has been declining — prioritise this metric immediately."),
        "improving": " You are trending in the right direction — keep it up.",
    }
    msg = base.get(metric, "Review your performance metrics and take corrective action.")
    if trend in trend_suffix:
        msg += trend_suffix[trend]
    return msg


def _detect_trend(
    data_points: list[TrendDataPoint],
    metric_attr: str,
    window: int,
) -> str:
    """Detect trend direction for a metric over the last *window* non-null data points.

    Returns "improving" | "declining" | "stable" | "insufficient_data".
    """
    values = [
        getattr(dp, metric_attr) for dp in data_points if getattr(dp, metric_attr) is not None
    ]

    if len(values) < 2:
        return "insufficient_data"

    recent = values[-min(window, len(values)) :]
    if len(recent) < 2:
        return "insufficient_data"

    # Count consecutive direction changes
    declines = sum(1 for a, b in zip(recent, recent[1:], strict=False) if b < a)
    improvements = sum(1 for a, b in zip(recent, recent[1:], strict=False) if b > a)
    pairs = len(recent) - 1

    # Majority direction determines the trend
    if declines > pairs / 2:
        return "declining"
    if improvements > pairs / 2:
        return "improving"
    return "stable"


def _classify_status(value: float | None, threshold: float) -> str:
    """Classify status as good / warning / critical based on proximity to threshold."""
    if value is None:
        return "good"  # no data → no alert
    if value >= threshold:
        return "good"
    # Warn from 10% above threshold down to threshold; critical below
    warn_floor = threshold * 0.9
    if value >= warn_floor:
        return "warning"
    return "critical"


# ── Public API ────────────────────────────────────────────────────────────────


async def get_effective_thresholds(
    db: AsyncSession,
    partner_id: uuid.UUID,
) -> ThresholdConfig:
    """Return thresholds for a partner (partner-specific override or global default)."""
    # Partner-specific
    result = await db.execute(
        select(PartnerThreshold).where(PartnerThreshold.partner_id == partner_id)
    )
    record = result.scalar_one_or_none()

    if record is None:
        # Global default (partner_id IS NULL)
        result = await db.execute(
            select(PartnerThreshold).where(PartnerThreshold.partner_id.is_(None))
        )
        record = result.scalar_one_or_none()

    if record is None:
        return ThresholdConfig()

    return ThresholdConfig(
        sla_compliance_threshold=float(record.sla_compliance_threshold),
        quality_score_threshold=float(record.quality_score_threshold),
        overall_score_threshold=float(record.overall_score_threshold),
        trend_window_weeks=int(record.trend_window_weeks),
    )


async def get_partner_performance_status(
    db: AsyncSession,
    partner_id: uuid.UUID,
) -> PerformanceStatus | None:
    """Compute current metrics vs thresholds for a partner.

    Returns None if partner does not exist.
    """
    # Fetch partner
    partner_result = await db.execute(select(PartnerProfile).where(PartnerProfile.id == partner_id))
    partner = partner_result.scalar_one_or_none()
    if not partner:
        return None

    # Thresholds
    thresholds = await get_effective_thresholds(db, partner_id)

    # Current ratings
    scores = await calculate_partner_score(db, partner_id)
    avg_quality: float | None = scores["avg_quality"]
    avg_overall: float | None = scores["avg_overall"]

    # SLA compliance (all-time)
    sla_compliance: float | None = None
    if partner.user_id:
        sla_result = await db.execute(
            select(
                func.count(SLATracker.id).label("total"),
                func.count(func.nullif(SLATracker.breach_status != "breached", False)).label(
                    "breached"
                ),
            ).where(SLATracker.assigned_to == partner.user_id)
        )
        row = sla_result.one()
        total_sla = row.total or 0
        if total_sla > 0:
            breached_result = await db.execute(
                select(func.count(SLATracker.id)).where(
                    SLATracker.assigned_to == partner.user_id,
                    SLATracker.breach_status == "breached",
                )
            )
            breached = breached_result.scalar_one() or 0
            sla_compliance = round((1 - breached / total_sla) * 100, 2)
        else:
            sla_compliance = 100.0

    # Trend data (90-day window)
    trend_data = await get_partner_trends(db, partner_id, days=90)
    data_points = trend_data.data_points if trend_data else []
    window = thresholds.trend_window_weeks

    # Build alerts
    alerts: list[MetricAlert] = []

    # SLA compliance alert
    sla_trend = _detect_trend(data_points, "sla_compliance_pct", window)
    sla_status = _classify_status(sla_compliance, thresholds.sla_compliance_threshold)
    if sla_status != "good" or sla_trend == "declining":
        effective_status = sla_status if sla_status != "good" else "warning"
        alerts.append(
            MetricAlert(
                metric="sla_compliance_pct",
                label="SLA Compliance",
                current_value=sla_compliance,
                threshold=thresholds.sla_compliance_threshold,
                status=effective_status,
                trend=sla_trend,
                suggestion=_suggestion_for("sla_compliance_pct", sla_trend),
            )
        )

    # Quality score alert
    quality_trend = _detect_trend(data_points, "avg_quality", window)
    quality_status = _classify_status(avg_quality, thresholds.quality_score_threshold)
    if quality_status != "good" or quality_trend == "declining":
        effective_status = quality_status if quality_status != "good" else "warning"
        alerts.append(
            MetricAlert(
                metric="avg_quality",
                label="Quality Score",
                current_value=avg_quality,
                threshold=thresholds.quality_score_threshold,
                status=effective_status,
                trend=quality_trend,
                suggestion=_suggestion_for("avg_quality", quality_trend),
            )
        )

    # Overall score alert
    overall_trend = _detect_trend(data_points, "avg_overall", window)
    overall_status = _classify_status(avg_overall, thresholds.overall_score_threshold)
    if overall_status != "good" or overall_trend == "declining":
        effective_status = overall_status if overall_status != "good" else "warning"
        alerts.append(
            MetricAlert(
                metric="avg_overall",
                label="Overall Score",
                current_value=avg_overall,
                threshold=thresholds.overall_score_threshold,
                status=effective_status,
                trend=overall_trend,
                suggestion=_suggestion_for("avg_overall", overall_trend),
            )
        )

    # Derive overall status
    statuses = [a.status for a in alerts]
    if "critical" in statuses:
        overall_status_str = "critical"
    elif "warning" in statuses:
        overall_status_str = "warning"
    else:
        overall_status_str = "good"

    return PerformanceStatus(
        partner_id=str(partner.id),
        firm_name=str(partner.firm_name),
        metrics={
            "sla_compliance_pct": sla_compliance,
            "avg_quality": avg_quality,
            "avg_overall": avg_overall,
        },
        thresholds={
            "sla_compliance_threshold": thresholds.sla_compliance_threshold,
            "quality_score_threshold": thresholds.quality_score_threshold,
            "overall_score_threshold": thresholds.overall_score_threshold,
        },
        alerts=alerts,
        overall_status=overall_status_str,
    )


def _build_alert_email(
    firm_name: str,
    alerts: list[MetricAlert],
) -> str:
    """Build HTML email body for a performance alert."""
    rows = ""
    for a in alerts:
        value_str = f"{a.current_value:.1f}" if a.current_value is not None else "N/A"
        threshold_str = f"{a.threshold:.1f}"
        status_color = {"good": "#16a34a", "warning": "#d97706", "critical": "#dc2626"}.get(
            a.status, "#6b7280"
        )
        trend_icon = {"improving": "↑", "declining": "↓", "stable": "→"}.get(a.trend, "–")
        rows += (
            f"<tr>"
            f"<td style='padding:8px;border-bottom:1px solid #e5e7eb'>{a.label}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e5e7eb;text-align:center'>"
            f"<span style='color:{status_color};font-weight:600'>{value_str}</span></td>"
            f"<td style='padding:8px;border-bottom:1px solid #e5e7eb;text-align:center'>"
            f"{threshold_str}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e5e7eb;text-align:center'>"
            f"{trend_icon}</td>"
            f"</tr>"
            f"<tr><td colspan='4' style='padding:4px 8px 12px;font-size:13px;"
            f"color:#6b7280;border-bottom:1px solid #e5e7eb'>{a.suggestion}</td></tr>"
        )

    return (
        "<html><body style='font-family:sans-serif;color:#111827;max-width:600px;margin:0 auto'>"
        f"<h2 style='font-size:20px;font-weight:700;margin-bottom:4px'>"
        f"Performance Alert — {firm_name}</h2>"
        "<p style='color:#6b7280;margin-bottom:24px'>One or more of your performance "
        "metrics requires attention. Please review the details below.</p>"
        "<table style='width:100%;border-collapse:collapse;font-size:14px'>"
        "<thead><tr style='background:#f9fafb'>"
        "<th style='padding:8px;text-align:left;border-bottom:2px solid #e5e7eb'>Metric</th>"
        "<th style='padding:8px;text-align:center;border-bottom:2px solid #e5e7eb'>Current</th>"
        "<th style='padding:8px;text-align:center;border-bottom:2px solid #e5e7eb'>Threshold</th>"
        "<th style='padding:8px;text-align:center;border-bottom:2px solid #e5e7eb'>Trend</th>"
        "</tr></thead>"
        f"<tbody>{rows}</tbody>"
        "</table>"
        "<p style='margin-top:24px;font-size:13px;color:#6b7280'>"
        "Log in to the partner portal to view full details and track your progress.</p>"
        "<p style='font-size:13px;color:#6b7280'>— AMG Portal</p>"
        "</body></html>"
    )


async def run_partner_performance_alerts(db: AsyncSession) -> dict[str, Any]:
    """Run performance alerts for all active partners.

    For each active partner:
    - Compute current metrics vs thresholds
    - Detect declining trends
    - Send in-app notification to partner's user account
    - Send email to partner's contact address
    - Notify MDs if metrics are below threshold (not just trending)

    Returns summary statistics.
    """
    # Fetch all active partners with a linked user account
    partner_result = await db.execute(
        select(PartnerProfile).where(
            PartnerProfile.status == "active",
        )
    )
    partners = partner_result.scalars().all()

    # Fetch managing directors
    md_result = await db.execute(
        select(User).where(
            User.role == "managing_director",
            User.status == "active",
        )
    )
    md_users = md_result.scalars().all()

    notified_partners = 0
    notified_mds = 0
    emails_sent = 0
    errors = 0

    for partner in partners:
        try:
            pid = uuid.UUID(str(partner.id))
            status = await get_partner_performance_status(db, pid)
            if status is None or not status.alerts:
                continue

            notified_partners += 1

            # ── In-app notification for the partner ───────────────────────────
            if partner.user_id:
                worst_status = status.overall_status
                priority = "urgent" if worst_status == "critical" else "high"

                alert_names = ", ".join(a.label for a in status.alerts[:3])
                body_lines = [
                    f"• {a.label}: {a.current_value:.1f} (threshold {a.threshold:.1f})"
                    for a in status.alerts
                    if a.current_value is not None
                ]
                body = f"The following metrics require your attention: {alert_names}. " + " ".join(
                    body_lines
                )

                await notification_service.create_notification(
                    db,
                    CreateNotificationRequest(
                        user_id=uuid.UUID(str(partner.user_id)),
                        notification_type="system",
                        title=f"Performance alert: {status.overall_status.title()} status",
                        body=body,
                        priority=priority,
                        action_url="/partner",
                        action_label="View Dashboard",
                        entity_type="partner_profile",
                        entity_id=pid,
                    ),
                )

            # ── Email to partner ──────────────────────────────────────────────
            if partner.contact_email:
                html = _build_alert_email(status.firm_name, status.alerts)
                try:
                    await send_email(
                        to=str(partner.contact_email),
                        subject=f"AMG Portal — Performance Alert: {status.overall_status.title()}",
                        body_html=html,
                    )
                    emails_sent += 1
                except Exception:
                    logger.exception(
                        "Failed to send alert email to partner %s (%s)",
                        partner.id,
                        partner.contact_email,
                    )

            # ── Notify MDs for below-threshold metrics (not just trend alerts) ─
            below_threshold_alerts = [
                a for a in status.alerts if a.status in ("warning", "critical")
            ]
            if below_threshold_alerts and md_users:
                summary_lines = [
                    f"• {a.label}: {a.current_value:.1f} "
                    f"(threshold {a.threshold:.1f}, status: {a.status})"
                    for a in below_threshold_alerts
                    if a.current_value is not None
                ]
                md_body = f"Partner {status.firm_name} has metrics below threshold:\n" + "\n".join(
                    summary_lines
                )
                for md in md_users:
                    await notification_service.create_notification(
                        db,
                        CreateNotificationRequest(
                            user_id=md.id,
                            notification_type="system",
                            title=f"Partner performance alert: {status.firm_name}",
                            body=md_body,
                            priority="high",
                            action_url="/analytics/partner-performance",
                            action_label="View Performance",
                            entity_type="partner_profile",
                            entity_id=pid,
                        ),
                    )
                notified_mds += len(md_users)

        except Exception:
            logger.exception("Error processing performance alert for partner %s", partner.id)
            errors += 1

    return {
        "partners_checked": len(partners),
        "partners_with_alerts": notified_partners,
        "md_notifications_sent": notified_mds,
        "emails_sent": emails_sent,
        "errors": errors,
    }
