"""Escalation playbook business logic — matching, execution, and step tracking."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.escalation import Escalation
from app.models.escalation_playbook import EscalationPlaybook, PlaybookExecution
from app.models.user import User
from app.schemas.escalation_playbook import (
    ExecutionResponse,
    PlaybookResponse,
    PlaybookWithExecutionResponse,
    ProgressSummary,
    StepStateUpdate,
)

logger = logging.getLogger(__name__)


def _build_execution_response(execution: PlaybookExecution) -> ExecutionResponse:
    progress_data = execution.compute_progress()
    return ExecutionResponse(
        id=execution.id,
        playbook_id=execution.playbook_id,
        escalation_id=execution.escalation_id,
        status=execution.status,
        step_states=execution.step_states,
        started_by=execution.started_by,
        completed_steps=execution.completed_steps,
        total_steps=execution.total_steps,
        completed_at=execution.completed_at,
        progress=ProgressSummary(**progress_data),  # type: ignore[arg-type]
        created_at=execution.created_at,
        updated_at=execution.updated_at,
    )


def _build_suggested_actions(
    escalation: Escalation,
    playbook: EscalationPlaybook,
    execution: PlaybookExecution | None,
) -> list[dict[str, object]]:
    """Generate context-aware suggested actions based on escalation state."""
    actions: list[dict[str, object]] = []

    level = escalation.level
    status = escalation.status
    risk_factors = escalation.risk_factors or {}

    # Status-based suggestions
    if status == "open":
        actions.append(
            {
                "type": "status",
                "label": "Acknowledge this escalation",
                "description": "Signal that you are aware and taking ownership.",
                "action": "acknowledge",
            }
        )
    if status in ("acknowledged", "open"):
        actions.append(
            {
                "type": "status",
                "label": "Begin investigation",
                "description": "Move to investigating to indicate active work.",
                "action": "set_investigating",
            }
        )

    # Risk-factor-based suggestions
    if risk_factors.get("overdue"):
        days = risk_factors.get("days_until_due", 0)
        actions.append(
            {
                "type": "risk",
                "label": "Review overdue milestone",
                "description": f"Milestone is {abs(int(str(days)))} day(s) overdue. "
                "Contact the RM for a revised timeline.",
                "action": "contact_rm",
            }
        )

    if risk_factors.get("blocked_tasks"):
        actions.append(
            {
                "type": "risk",
                "label": f"Unblock {risk_factors['blocked_tasks']} task(s)",
                "description": "Identify blockers and coordinate with the relevant coordinator.",
                "action": "unblock_tasks",
            }
        )

    # Level-based contact suggestions
    level_contacts: dict[str, dict[str, str]] = {
        "task": {"role": "coordinator", "label": "Contact the task coordinator"},
        "milestone": {"role": "relationship_manager", "label": "Contact the Relationship Manager"},
        "program": {"role": "managing_director", "label": "Escalate to Managing Director"},
        "client_impact": {
            "role": "managing_director",
            "label": "Immediate MD involvement required",
        },
    }
    if level in level_contacts:
        contact = level_contacts[level]
        actions.append(
            {
                "type": "contact",
                "label": contact["label"],
                "description": f"Engage the {contact['role'].replace('_', ' ')} for resolution.",
                "role": contact["role"],
            }
        )

    # Playbook progress hint
    if execution and execution.status == "in_progress":
        progress = execution.compute_progress()
        remaining = (
            int(str(progress["total"]))
            - int(str(progress["completed"]))
            - int(str(progress["skipped"]))
        )
        if remaining > 0:
            actions.append(
                {
                    "type": "playbook",
                    "label": f"Complete {remaining} remaining playbook step(s)",
                    "description": "Follow the guided resolution steps to resolve this escalation.",
                    "action": "follow_playbook",
                }
            )

    return actions


async def get_playbook_for_escalation(
    db: AsyncSession,
    escalation: Escalation,
) -> EscalationPlaybook | None:
    """Find the best-matching active playbook for an escalation.

    Match priority:
    1. Exact match on entity_type (e.g. 'milestone')
    2. Match on escalation level (e.g. 'program')
    """
    # Try entity_type first
    result = await db.execute(
        select(EscalationPlaybook)
        .where(
            EscalationPlaybook.escalation_type == escalation.entity_type,
            EscalationPlaybook.is_active.is_(True),
        )
        .limit(1)
    )
    playbook = result.scalar_one_or_none()

    if playbook is None:
        # Fall back to level
        result = await db.execute(
            select(EscalationPlaybook)
            .where(
                EscalationPlaybook.escalation_type == escalation.level,
                EscalationPlaybook.is_active.is_(True),
            )
            .limit(1)
        )
        playbook = result.scalar_one_or_none()

    return playbook


async def get_or_create_execution(
    db: AsyncSession,
    escalation: Escalation,
    playbook: EscalationPlaybook,
    user: User,
) -> PlaybookExecution:
    """Return existing execution for the escalation or create a new one."""
    result = await db.execute(
        select(PlaybookExecution).where(PlaybookExecution.escalation_id == escalation.id)
    )
    execution = result.scalar_one_or_none()
    if execution:
        return execution

    # Initialise step_states from playbook steps
    step_states = [
        {
            "step_order": step["order"],
            "completed": False,
            "skipped": False,
            "skip_reason": None,
            "notes": None,
            "completed_at": None,
            "completed_by": None,
        }
        for step in playbook.steps
    ]

    execution = PlaybookExecution(
        playbook_id=playbook.id,
        escalation_id=escalation.id,
        status="in_progress",
        step_states=step_states,
        started_by=user.id,
        completed_steps=0,
        total_steps=len(playbook.steps),
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)
    logger.info("PlaybookExecution created: %s for escalation %s", execution.id, escalation.id)
    return execution


async def get_playbook_view(
    db: AsyncSession,
    escalation_id: UUID,
    user: User,
) -> PlaybookWithExecutionResponse | None:
    """Return playbook + execution for the given escalation, or None if no playbook applies."""
    esc_result = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    escalation = esc_result.scalar_one_or_none()
    if not escalation:
        raise ValueError(f"Escalation {escalation_id} not found")

    playbook = await get_playbook_for_escalation(db, escalation)
    if not playbook:
        return None

    execution = await get_or_create_execution(db, escalation, playbook, user)
    suggested = _build_suggested_actions(escalation, playbook, execution)

    return PlaybookWithExecutionResponse(
        playbook=PlaybookResponse.model_validate(playbook),
        execution=_build_execution_response(execution),
        suggested_actions=suggested,
    )


async def update_step_state(
    db: AsyncSession,
    escalation_id: UUID,
    update: StepStateUpdate,
    user: User,
) -> PlaybookExecution:
    """Apply a step state update (complete or skip) to the execution."""
    result = await db.execute(
        select(PlaybookExecution).where(PlaybookExecution.escalation_id == escalation_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise ValueError("No active playbook execution for this escalation")

    now_iso = datetime.now(UTC).isoformat()
    step_states: list[dict[str, object]] = list(execution.step_states)

    # Find the step
    step_idx = next(
        (i for i, s in enumerate(step_states) if s["step_order"] == update.step_order),
        None,
    )
    if step_idx is None:
        raise ValueError(f"Step {update.step_order} not found in playbook")

    step = dict(step_states[step_idx])

    if update.completed is not None:
        step["completed"] = update.completed
        if update.completed:
            step["completed_at"] = now_iso
            step["completed_by"] = user.email
            step["skipped"] = False
            step["skip_reason"] = None
        else:
            step["completed_at"] = None
            step["completed_by"] = None

    if update.skipped is not None:
        step["skipped"] = update.skipped
        if update.skipped:
            step["skip_reason"] = update.skip_reason
            step["completed"] = False
            step["completed_at"] = None
            step["completed_by"] = None

    if update.notes is not None:
        step["notes"] = update.notes

    step_states[step_idx] = step

    # Rebuild the list to ensure SQLAlchemy detects the mutation
    execution.step_states = step_states

    # Recount
    execution.completed_steps = sum(1 for s in step_states if s.get("completed"))

    # Mark execution complete when all steps are completed or skipped
    acted = sum(1 for s in step_states if s.get("completed") or s.get("skipped"))
    if acted == execution.total_steps and execution.total_steps > 0:
        execution.status = "completed"
        execution.completed_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(execution)
    return execution


# ── Seed helpers ───────────────────────────────────────────────────────

DEFAULT_PLAYBOOKS: list[dict[str, object]] = [
    {
        "escalation_type": "milestone",
        "name": "Milestone Delay Resolution",
        "description": (
            "Structured process for resolving overdue or at-risk milestones "
            "to protect program delivery timelines."
        ),
        "steps": [
            {
                "order": 1,
                "title": "Acknowledge and assess severity",
                "description": (
                    "Review the milestone details, completion percentage, and risk factors. "
                    "Determine if this is approaching-due or already overdue."
                ),
                "time_estimate_minutes": 10,
                "resources": [],
            },
            {
                "order": 2,
                "title": "Contact the Relationship Manager",
                "description": (
                    "Notify the RM assigned to this client. Confirm they are aware and "
                    "obtain an updated status from the programme team."
                ),
                "time_estimate_minutes": 15,
                "resources": [],
            },
            {
                "order": 3,
                "title": "Identify and document root cause",
                "description": (
                    "Establish why the milestone is delayed — blocked tasks, resource gaps, "
                    "client dependencies, or external factors. Record in resolution notes."
                ),
                "time_estimate_minutes": 20,
                "resources": [],
            },
            {
                "order": 4,
                "title": "Agree a revised timeline",
                "description": (
                    "Work with the programme team and RM to set a realistic revised due date. "
                    "Update the milestone record accordingly."
                ),
                "time_estimate_minutes": 30,
                "resources": [],
            },
            {
                "order": 5,
                "title": "Unblock any blocked tasks",
                "description": (
                    "For each blocked task, identify the blocker and take action to clear it. "
                    "Reassign tasks if needed."
                ),
                "time_estimate_minutes": 45,
                "resources": [],
            },
            {
                "order": 6,
                "title": "Communicate to client if needed",
                "description": (
                    "If the delay is client-impacting, draft a communication to the client "
                    "via the approved channel. Obtain RM sign-off before sending."
                ),
                "time_estimate_minutes": 20,
                "resources": [],
            },
            {
                "order": 7,
                "title": "Confirm resolution and close escalation",
                "description": (
                    "Once the milestone is back on track, update the escalation status to "
                    "Resolved and add summary notes."
                ),
                "time_estimate_minutes": 10,
                "resources": [],
            },
        ],
        "success_criteria": [
            "Milestone has an updated, achievable due date",
            "All blocked tasks are unblocked or reassigned",
            "Client has been informed if required",
            "Escalation resolved within SLA",
        ],
        "escalation_paths": [
            {
                "condition": "Milestone overdue by more than 7 days",
                "action": "Escalate to Managing Director",
                "contact_role": "managing_director",
            },
            {
                "condition": "Client directly impacted",
                "action": "Raise a client_impact escalation",
                "contact_role": "managing_director",
            },
        ],
        "is_active": True,
    },
    {
        "escalation_type": "task",
        "name": "Blocked Task Resolution",
        "description": "Quick-resolution process for blocked or overdue tasks within a milestone.",
        "steps": [
            {
                "order": 1,
                "title": "Identify the blocker",
                "description": (
                    "Review the task and determine what is blocking progress — "
                    "missing information, dependency, or resource issue."
                ),
                "time_estimate_minutes": 10,
                "resources": [],
            },
            {
                "order": 2,
                "title": "Contact the task assignee",
                "description": (
                    "Reach out to the coordinator or partner assigned to the task. "
                    "Get their assessment and estimated unblock time."
                ),
                "time_estimate_minutes": 15,
                "resources": [],
            },
            {
                "order": 3,
                "title": "Resolve or escalate the blocker",
                "description": (
                    "Either directly resolve the blocker (provide missing information, "
                    "reassign the task) or escalate to the RM if outside your scope."
                ),
                "time_estimate_minutes": 30,
                "resources": [],
            },
            {
                "order": 4,
                "title": "Verify task is unblocked",
                "description": (
                    "Confirm with the assignee that the task is in progress again. "
                    "Update the task status to reflect current state."
                ),
                "time_estimate_minutes": 5,
                "resources": [],
            },
        ],
        "success_criteria": [
            "Task status changed from blocked to in_progress",
            "Root cause documented",
            "Assignee confirmed task is proceeding",
        ],
        "escalation_paths": [
            {
                "condition": "Task unblockable without client input",
                "action": "Raise a client decision request",
                "contact_role": "relationship_manager",
            },
        ],
        "is_active": True,
    },
    {
        "escalation_type": "program",
        "name": "Programme-Level Escalation Resolution",
        "description": (
            "MD-level process for resolving escalations that threaten programme delivery "
            "or client satisfaction."
        ),
        "steps": [
            {
                "order": 1,
                "title": "Convene crisis review",
                "description": (
                    "Call an urgent review with the RM, Coordinator, and MD. "
                    "Establish full situational awareness."
                ),
                "time_estimate_minutes": 30,
                "resources": [],
            },
            {
                "order": 2,
                "title": "Assess client impact",
                "description": (
                    "Determine whether the client has been or will be affected. "
                    "Document impact severity and any SLA breaches."
                ),
                "time_estimate_minutes": 20,
                "resources": [],
            },
            {
                "order": 3,
                "title": "Define recovery plan",
                "description": (
                    "Agree specific actions, owners, and deadlines to get the programme "
                    "back on track. Document in resolution notes."
                ),
                "time_estimate_minutes": 45,
                "resources": [],
            },
            {
                "order": 4,
                "title": "Execute recovery actions",
                "description": (
                    "Implement the recovery plan. Reassign resources, revise milestones, "
                    "or engage partner network as required."
                ),
                "time_estimate_minutes": 120,
                "resources": [],
            },
            {
                "order": 5,
                "title": "Client communication",
                "description": (
                    "MD to prepare and deliver a client update. "
                    "Be transparent about delays and outline the recovery plan."
                ),
                "time_estimate_minutes": 30,
                "resources": [],
            },
            {
                "order": 6,
                "title": "Post-incident review",
                "description": (
                    "After resolution, conduct a lessons-learned review. "
                    "Update escalation rules or SLAs to prevent recurrence."
                ),
                "time_estimate_minutes": 60,
                "resources": [],
            },
        ],
        "success_criteria": [
            "Programme back on schedule or revised timeline agreed",
            "Client informed and satisfied with response",
            "All sub-escalations resolved",
            "Lessons learned documented",
        ],
        "escalation_paths": [
            {
                "condition": "Client threatens to terminate",
                "action": "Emergency MD and legal review",
                "contact_role": "managing_director",
            },
        ],
        "is_active": True,
    },
    {
        "escalation_type": "client_impact",
        "name": "Client Impact Crisis Resolution",
        "description": (
            "Highest-priority process for escalations with direct negative impact "
            "on the client relationship or deliverables."
        ),
        "steps": [
            {
                "order": 1,
                "title": "Immediate MD notification",
                "description": (
                    "Notify the Managing Director immediately. "
                    "Do not delay — client-impact escalations require same-day MD involvement."
                ),
                "time_estimate_minutes": 5,
                "resources": [],
            },
            {
                "order": 2,
                "title": "Client acknowledgement call",
                "description": (
                    "RM to call the client within 2 hours to acknowledge the issue "
                    "and confirm we are actively resolving it."
                ),
                "time_estimate_minutes": 30,
                "resources": [],
            },
            {
                "order": 3,
                "title": "Assemble response team",
                "description": (
                    "Identify all stakeholders needed to resolve the issue: "
                    "RM, Coordinator, relevant Partners, MD."
                ),
                "time_estimate_minutes": 15,
                "resources": [],
            },
            {
                "order": 4,
                "title": "Define immediate mitigation",
                "description": (
                    "What can be done right now to reduce client impact? "
                    "Document and assign immediate actions."
                ),
                "time_estimate_minutes": 30,
                "resources": [],
            },
            {
                "order": 5,
                "title": "Deliver resolution to client",
                "description": (
                    "Implement the resolution and confirm with the client that "
                    "the issue has been addressed to their satisfaction."
                ),
                "time_estimate_minutes": 60,
                "resources": [],
            },
            {
                "order": 6,
                "title": "Relationship repair actions",
                "description": (
                    "Determine if any goodwill gestures or formal apologies are appropriate. "
                    "MD to sign off on any compensatory measures."
                ),
                "time_estimate_minutes": 30,
                "resources": [],
            },
            {
                "order": 7,
                "title": "Root cause analysis and prevention",
                "description": (
                    "Conduct thorough root cause analysis. Update processes, escalation rules, "
                    "and training as needed."
                ),
                "time_estimate_minutes": 90,
                "resources": [],
            },
        ],
        "success_criteria": [
            "Client explicitly satisfied with resolution",
            "Issue fully resolved with no recurrence risk",
            "Internal process improvements identified",
            "Full audit trail documented",
        ],
        "escalation_paths": [],
        "is_active": True,
    },
]


async def seed_default_playbooks(db: AsyncSession) -> None:
    """Insert default playbooks if none exist for each escalation_type."""
    for data in DEFAULT_PLAYBOOKS:
        etype = str(data["escalation_type"])
        existing = await db.execute(
            select(EscalationPlaybook).where(EscalationPlaybook.escalation_type == etype).limit(1)
        )
        if existing.scalar_one_or_none() is None:
            playbook = EscalationPlaybook(**data)
            db.add(playbook)
    await db.commit()
