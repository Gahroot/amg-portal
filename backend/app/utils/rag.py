"""RAG (Red / Amber / Green) status utilities."""

from datetime import UTC, datetime, timedelta

from app.models.milestone import Milestone


def compute_rag_status(milestones: list[Milestone]) -> str:
    """Compute RAG status from milestone due dates.

    Returns:
        "red"   – at least one non-completed milestone is already overdue.
        "amber" – at least one non-completed milestone is due within 7 days.
        "green" – all milestones are on track (or there are none).
    """
    today = datetime.now(UTC).date()
    for m in milestones:
        if m.status != "completed" and m.due_date and m.due_date < today:
            return "red"
    for m in milestones:
        if m.status != "completed" and m.due_date and m.due_date <= today + timedelta(days=7):
            return "amber"
    return "green"
