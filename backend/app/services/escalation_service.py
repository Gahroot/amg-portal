"""Backwards-compatible re-export shim for the ``escalation`` package.

The implementation has been split into ``app.services.escalation`` submodules
(``_constants``, ``_owner``, ``_helpers``, ``_workflow``, ``_risk``,
``_auto_triggers``, ``_queries``). This module preserves the historical import
path used by ``app.services.scheduler_service`` and ``app.api.v1.escalations``.
"""

from __future__ import annotations

from app.services.escalation import (  # noqa: F401
    ESCALATION_PROGRESSION,
    LEVEL_PROGRESSION,
    RESPONSE_DEADLINES_HOURS,
    auto_progress_escalation,
    calculate_response_deadline,
    check_and_escalate_milestone_risk,
    create_escalation,
    create_escalation_from_sla_breach,
    determine_escalation_owner,
    evaluate_auto_triggers,
    get_active_escalations,
    get_escalation_chain,
    get_escalations_with_owner_info,
    get_overdue_escalations,
    get_simple_escalation_metrics,
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
