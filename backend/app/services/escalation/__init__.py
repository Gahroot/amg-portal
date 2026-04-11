"""Escalation business logic — risk detection, owner determination, status workflows.

This package was split from a single ``escalation_service`` module. The legacy
module path ``app.services.escalation_service`` continues to re-export the same
public surface, so existing callers (notably ``scheduler_service`` and the
``escalations`` API router) keep working unchanged.
"""

from __future__ import annotations

from ._auto_triggers import (
    _evaluate_milestone_overdue_rule,  # noqa: F401  (kept for back-compat)
    _evaluate_sla_breach_rule,  # noqa: F401
    _evaluate_task_overdue_rule,  # noqa: F401
    evaluate_auto_triggers,
)
from ._constants import (
    ESCALATION_PROGRESSION,
    LEVEL_PROGRESSION,
    RESPONSE_DEADLINES_HOURS,
    calculate_response_deadline,
)
from ._helpers import _has_open_escalation, _load_open_escalation_set  # noqa: F401
from ._owner import determine_escalation_owner
from ._queries import (
    get_active_escalations,
    get_escalation_chain,
    get_escalations_with_owner_info,
    get_overdue_escalations,
    get_simple_escalation_metrics,
)
from ._risk import (
    _compute_milestone_risk_factors,  # noqa: F401
    _notify_overdue_milestone,  # noqa: F401
    check_and_escalate_milestone_risk,
)
from ._workflow import (
    auto_progress_escalation,
    create_escalation,
    create_escalation_from_sla_breach,
    progress_escalation_chain,
    reassign_escalation,
    update_escalation_status,
)

__all__ = [
    "ESCALATION_PROGRESSION",
    "LEVEL_PROGRESSION",
    "RESPONSE_DEADLINES_HOURS",
    "auto_progress_escalation",
    "calculate_response_deadline",
    "check_and_escalate_milestone_risk",
    "create_escalation",
    "create_escalation_from_sla_breach",
    "determine_escalation_owner",
    "evaluate_auto_triggers",
    "get_active_escalations",
    "get_escalation_chain",
    "get_escalations_with_owner_info",
    "get_overdue_escalations",
    "get_simple_escalation_metrics",
    "progress_escalation_chain",
    "reassign_escalation",
    "update_escalation_status",
]
