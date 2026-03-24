# Performance Trend Alerts — Implementation Plan

## Overview
Add performance threshold alerts that notify partners (and MDs) when metrics fall below configured thresholds or show declining trends.

## What Already Exists
- `_check_partner_threshold_alerts_job()` in scheduler_service.py — simple MD-only alert when avg overall < 3.0
- `partner_trends_service.py` — weekly trend data per partner
- `partner_scoring_service.py` — composite score (rating + SLA)
- Notification service + email service
- Partner portal API `/trends` endpoint

## Files to Create/Modify

### 1. `backend/app/models/partner_threshold.py` (NEW)
Configurable thresholds model:
- Global or per-partner overrides
- Fields: partner_id (nullable FK), sla_compliance_threshold (float, 90.0), quality_score_threshold (float, 3.0), overall_score_threshold (float, 3.0), trend_window_weeks (int, 4)
- Register in `backend/app/models/__init__.py`

### 2. `backend/app/services/partner_alert_service.py` (NEW)
Core alert logic:
- `get_effective_thresholds(db, partner_id)` — partner-specific or global defaults
- `check_partner_metrics(db, partner_id)` — gets current SLA %, quality score, overall avg
- `detect_declining_trend(trend_data_points, metric, window)` — checks if last N weeks declining
- `run_partner_performance_alerts(db)` — main function:
  - Iterates all active partners
  - Computes current metrics + trend
  - Compares to thresholds
  - Sends in-app notification to partner's user_id
  - Sends email to partner's contact_email
  - Also notifies MDs if below threshold

### 3. `backend/app/api/v1/partner_portal.py` (MODIFY)
Add endpoint:
- `GET /partner-portal/performance-status` — returns current metrics vs thresholds + alert status + suggestions

### 4. `backend/app/services/scheduler_service.py` (MODIFY)
- Add `_check_partner_performance_trend_alerts_job()` importing and calling `run_partner_performance_alerts`
- Schedule at 9:00 AM daily
- Keep existing `_check_partner_threshold_alerts_job` as-is (it handles MD alerts for backward compat) — actually replace it with the new comprehensive one

### 5. `frontend/src/components/partner/performance-alerts.tsx` (NEW)
Partner-facing component:
- Shows each metric with current value vs threshold
- Green/amber/red status indicator
- Trend arrow (up/down/neutral from trend data)
- Improvement suggestions based on which metrics are failing
- Used in partner dashboard page `/partner/page.tsx`

### 6. `frontend/src/lib/api/partner-portal.ts` (MODIFY)
Add `getMyPerformanceStatus()` API call

### 7. `frontend/src/hooks/use-partner-portal.ts` (MODIFY)
Add `useMyPerformanceStatus()` hook

## Notification Content
- **In-app**: "Performance alert: [Metric] is [value], below threshold of [threshold]"
- **Email**: HTML email with metric breakdown and suggestions
- **Trend alert**: "Your [metric] has declined for [N] consecutive weeks"

## Suggestions Logic
- SLA below threshold → "Respond to assignments within SLA windows; review pending items"
- Quality below threshold → "Review deliverable quality; request feedback; attend training"
- Overall score below threshold → "Schedule a performance review with your coordinator"
- Declining trend → "Your [metric] has been declining — consider [specific action]"

## API Response Shape (performance-status)
```json
{
  "metrics": {
    "sla_compliance_pct": 85.0,
    "avg_quality": 2.8,
    "avg_overall": 3.1
  },
  "thresholds": {
    "sla_compliance_threshold": 90.0,
    "quality_score_threshold": 3.0,
    "overall_score_threshold": 3.0
  },
  "alerts": [
    { "metric": "sla_compliance_pct", "status": "warning", "trend": "declining", "suggestion": "..." }
  ],
  "overall_status": "warning"  // "good" | "warning" | "critical"
}
```

## Implementation Order
1. Create PartnerThreshold model
2. Register in __init__.py
3. Create partner_alert_service.py
4. Add API endpoint to partner_portal.py
5. Add scheduler job
6. Create frontend component
7. Add API function and hook
8. Integrate component into partner dashboard page
9. Run linters/type checks
