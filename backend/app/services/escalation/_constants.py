"""Escalation constants and time-deadline helpers."""

from __future__ import annotations

from datetime import datetime, timedelta

from app.models.enums import EscalationLevel

# Hours within which the assigned owner must respond after the escalation is triggered
RESPONSE_DEADLINES_HOURS: dict[str, int] = {
    "task": 1,
    "milestone": 1,
    "program": 2,
    "client_impact": 0,  # Immediate — no grace period
}

# Auto-progression: level → (next_level, hours_before_auto_progress)
ESCALATION_PROGRESSION: dict[str, tuple[str, int]] = {
    "task": ("milestone", 4),
    "milestone": ("program", 4),
    "program": ("client_impact", 8),
}

LEVEL_PROGRESSION = [
    EscalationLevel.task,
    EscalationLevel.milestone,
    EscalationLevel.program,
    EscalationLevel.client_impact,
]


def calculate_response_deadline(level: str, triggered_at: datetime) -> datetime:
    """Return the datetime by which the owner must respond."""
    hours = RESPONSE_DEADLINES_HOURS.get(level, 1)
    return triggered_at + timedelta(hours=hours)
