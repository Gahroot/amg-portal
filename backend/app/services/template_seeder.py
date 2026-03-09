"""Seed default system communication templates."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.communication_template import CommunicationTemplate

logger = logging.getLogger(__name__)

DEFAULT_TEMPLATES: list[dict[str, Any]] = [
    {
        "template_type": "welcome",
        "name": "Welcome to AMG Portal",
        "subject": "Welcome to AMG Portal, {{ client_name }}",
        "body": (
            "Dear {{ client_name }},\n\n"
            "Welcome to the AMG Portal. We are delighted "
            "to have you on board.\n\n"
            "You can access your personalized dashboard "
            "and track your programs at:\n"
            "{{ portal_url }}\n\n"
            "Best regards,\nAMG Team"
        ),
        "variable_definitions": {
            "client_name": {
                "type": "string",
                "description": "Client's name",
                "required": True,
            },
            "portal_url": {
                "type": "string",
                "description": "URL to the portal",
                "required": True,
            },
        },
    },
    {
        "template_type": "program_kickoff",
        "name": "Program Kickoff",
        "subject": "Program Kickoff: {{ program_title }}",
        "body": (
            "Hello,\n\n"
            'The program "{{ program_title }}" has been '
            "started for client {{ client_name }}.\n\n"
            "Start date: {{ start_date }}\n\n"
            "Please review the program details in the "
            "portal and begin coordination.\n\n"
            "Best regards,\nAMG Team"
        ),
        "variable_definitions": {
            "program_title": {
                "type": "string",
                "description": "Program title",
                "required": True,
            },
            "client_name": {
                "type": "string",
                "description": "Client name",
                "required": True,
            },
            "start_date": {
                "type": "string",
                "description": "Program start date",
                "required": True,
            },
        },
    },
    {
        "template_type": "weekly_status",
        "name": "Weekly Status Update",
        "subject": "Weekly Status: {{ program_title }}",
        "body": (
            "Weekly Status Report\n\n"
            "Program: {{ program_title }}\n"
            "RAG Status: {{ rag_status }}\n"
            "Milestone Progress: {{ milestone_progress }}\n\n"
            "Active Milestones:\n"
            "{{ active_milestones }}\n\n"
            "Please review the full details in the portal."
        ),
        "variable_definitions": {
            "program_title": {
                "type": "string",
                "description": "Program title",
                "required": True,
            },
            "rag_status": {
                "type": "string",
                "description": "RAG status (red/amber/green)",
                "required": True,
            },
            "milestone_progress": {
                "type": "string",
                "description": "Milestone progress summary",
                "required": True,
            },
            "active_milestones": {
                "type": "string",
                "description": "List of active milestones",
                "required": True,
            },
        },
    },
    {
        "template_type": "decision_request",
        "name": "Decision Required",
        "subject": "Decision Required: {{ decision_title }}",
        "body": (
            "A decision is required from you.\n\n"
            "Title: {{ decision_title }}\n"
            "Description: {{ description }}\n"
            "Deadline: {{ deadline }}\n\n"
            "Please respond at: {{ portal_url }}\n\n"
            "Best regards,\nAMG Team"
        ),
        "variable_definitions": {
            "decision_title": {
                "type": "string",
                "description": "Decision title",
                "required": True,
            },
            "description": {
                "type": "string",
                "description": "Decision description",
                "required": True,
            },
            "deadline": {
                "type": "string",
                "description": "Response deadline",
                "required": True,
            },
            "portal_url": {
                "type": "string",
                "description": "URL to respond",
                "required": True,
            },
        },
    },
    {
        "template_type": "milestone_alert",
        "name": "Milestone Alert",
        "subject": "Milestone Alert: {{ milestone_title }}",
        "body": (
            "A milestone requires your attention.\n\n"
            "Milestone: {{ milestone_title }}\n"
            "Program: {{ program_title }}\n"
            "Due Date: {{ due_date }}\n\n"
            "Risk Factors:\n{{ risk_factors }}\n\n"
            "Please review and take action in the portal."
        ),
        "variable_definitions": {
            "milestone_title": {
                "type": "string",
                "description": "Milestone title",
                "required": True,
            },
            "program_title": {
                "type": "string",
                "description": "Program title",
                "required": True,
            },
            "risk_factors": {
                "type": "string",
                "description": "Risk factor details",
                "required": True,
            },
            "due_date": {
                "type": "string",
                "description": "Milestone due date",
                "required": True,
            },
        },
    },
    {
        "template_type": "completion_note",
        "name": "Program Completed",
        "subject": "Program Completed: {{ program_title }}",
        "body": (
            "Congratulations!\n\n"
            'The program "{{ program_title }}" for '
            "{{ client_name }} has been completed "
            "successfully.\n\n"
            "Please review the final details and "
            "deliverables in the portal.\n\n"
            "Best regards,\nAMG Team"
        ),
        "variable_definitions": {
            "program_title": {
                "type": "string",
                "description": "Program title",
                "required": True,
            },
            "client_name": {
                "type": "string",
                "description": "Client name",
                "required": True,
            },
        },
    },
    {
        "template_type": "partner_dispatch",
        "name": "New Assignment",
        "subject": "New Assignment: {{ assignment_title }}",
        "body": (
            "You have been assigned a new task.\n\n"
            "Assignment: {{ assignment_title }}\n"
            "Program: {{ program_title }}\n"
            "Due Date: {{ due_date }}\n\n"
            "Brief:\n{{ brief }}\n\n"
            "Please review and accept the assignment "
            "in the portal."
        ),
        "variable_definitions": {
            "assignment_title": {
                "type": "string",
                "description": "Assignment title",
                "required": True,
            },
            "program_title": {
                "type": "string",
                "description": "Program title",
                "required": True,
            },
            "brief": {
                "type": "string",
                "description": "Assignment brief",
                "required": True,
            },
            "due_date": {
                "type": "string",
                "description": "Assignment due date",
                "required": True,
            },
        },
    },
    {
        "template_type": "deliverable_submission",
        "name": "Deliverable Submitted",
        "subject": ("Deliverable Submitted: {{ deliverable_title }}"),
        "body": (
            "A deliverable has been submitted for "
            "your review.\n\n"
            "Deliverable: {{ deliverable_title }}\n"
            "Submitted by: {{ partner_name }}\n"
            "Program: {{ program_title }}\n\n"
            "Please review the submission in the portal."
        ),
        "variable_definitions": {
            "deliverable_title": {
                "type": "string",
                "description": "Deliverable title",
                "required": True,
            },
            "partner_name": {
                "type": "string",
                "description": "Partner name",
                "required": True,
            },
            "program_title": {
                "type": "string",
                "description": "Program title",
                "required": True,
            },
        },
    },
]


async def seed_default_templates(
    db: AsyncSession,
) -> None:
    """Seed default system templates idempotently.

    Only creates templates that don't already exist
    (matched by template_type + is_system).
    """
    for tpl_data in DEFAULT_TEMPLATES:
        result = await db.execute(
            select(CommunicationTemplate).where(
                CommunicationTemplate.template_type == tpl_data["template_type"],
                CommunicationTemplate.is_system.is_(True),
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            logger.debug(
                "System template '%s' already exists, skipping",
                tpl_data["template_type"],
            )
            continue

        template = CommunicationTemplate(
            name=tpl_data["name"],
            template_type=tpl_data["template_type"],
            subject=tpl_data["subject"],
            body=tpl_data["body"],
            variable_definitions=tpl_data["variable_definitions"],
            is_active=True,
            is_system=True,
        )
        db.add(template)
        logger.info(
            "Seeded system template: %s",
            tpl_data["template_type"],
        )

    await db.commit()
    logger.info("Template seeding complete")
