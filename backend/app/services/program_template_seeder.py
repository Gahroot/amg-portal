"""Seed system program templates on startup."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.program_template import ProgramTemplate

logger = logging.getLogger(__name__)

SYSTEM_TEMPLATES: list[dict[str, Any]] = [
    {
        "name": "Standard Executive Protection Program",
        "category": "executive_protection",
        "estimated_duration_days": 90,
        "description": (
            "Comprehensive executive protection program covering threat assessment, "
            "protocol development, personnel deployment, active protection, and debrief."
        ),
        "milestones_template": [
            {
                "title": "Threat Assessment & Intelligence Gathering",
                "description": "Establish threat landscape and identify key vulnerabilities.",
                "offset_days": 0,
                "duration_days": 14,
                "tasks": [
                    {
                        "title": "Conduct background threat assessment",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Review travel itineraries",
                        "description": None,
                        "priority": "medium",
                    },
                    {
                        "title": "Identify vulnerabilities",
                        "description": None,
                        "priority": "high",
                    },
                ],
            },
            {
                "title": "Security Protocol Development",
                "description": "Draft and finalise security protocols and communication channels.",
                "offset_days": 14,
                "duration_days": 14,
                "tasks": [
                    {
                        "title": "Draft security protocols",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Define communication channels",
                        "description": None,
                        "priority": "medium",
                    },
                    {
                        "title": "Establish emergency procedures",
                        "description": None,
                        "priority": "high",
                    },
                ],
            },
            {
                "title": "Personnel Deployment & Briefing",
                "description": "Deploy security team and conduct site reconnaissance.",
                "offset_days": 28,
                "duration_days": 7,
                "tasks": [
                    {
                        "title": "Brief security team",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Conduct site reconnaissance",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Test communication systems",
                        "description": None,
                        "priority": "medium",
                    },
                ],
            },
            {
                "title": "Active Protection Phase",
                "description": "Ongoing protection with daily briefings and incident monitoring.",
                "offset_days": 35,
                "duration_days": 45,
                "tasks": [
                    {
                        "title": "Daily security briefings",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Monitor threat landscape",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Document incidents",
                        "description": None,
                        "priority": "medium",
                    },
                ],
            },
            {
                "title": "Debrief & Reporting",
                "description": "Compile final report and conduct client debrief session.",
                "offset_days": 80,
                "duration_days": 10,
                "tasks": [
                    {
                        "title": "Compile incident report",
                        "description": None,
                        "priority": "medium",
                    },
                    {
                        "title": "Client debrief session",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Archive documentation",
                        "description": None,
                        "priority": "low",
                    },
                ],
            },
        ],
    },
    {
        "name": "Travel Security Assessment",
        "category": "travel_security",
        "estimated_duration_days": 21,
        "description": (
            "End-to-end travel security covering destination intelligence, logistics "
            "planning, traveler briefing, and on-ground support."
        ),
        "milestones_template": [
            {
                "title": "Destination Intelligence",
                "description": "Assess country risk and identify safe routes and facilities.",
                "offset_days": 0,
                "duration_days": 7,
                "tasks": [
                    {
                        "title": "Country risk assessment",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Identify safe routes",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Locate medical facilities",
                        "description": None,
                        "priority": "medium",
                    },
                ],
            },
            {
                "title": "Logistics Security Planning",
                "description": "Vet providers and secure transportation and accommodation.",
                "offset_days": 7,
                "duration_days": 7,
                "tasks": [
                    {
                        "title": "Vet transportation providers",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Book secure accommodations",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Coordinate airport transfers",
                        "description": None,
                        "priority": "medium",
                    },
                ],
            },
            {
                "title": "Traveler Briefing",
                "description": "Conduct security briefing and issue emergency contacts.",
                "offset_days": 14,
                "duration_days": 3,
                "tasks": [
                    {
                        "title": "Security briefing session",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Provide emergency contacts",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Issue satellite phone",
                        "description": None,
                        "priority": "medium",
                    },
                ],
            },
            {
                "title": "On-Ground Support",
                "description": "Monitor traveler check-ins and maintain stand-by readiness.",
                "offset_days": 17,
                "duration_days": 4,
                "tasks": [
                    {
                        "title": "Monitor traveler check-ins",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Stand-by response readiness",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Post-trip debrief",
                        "description": None,
                        "priority": "medium",
                    },
                ],
            },
        ],
    },
    {
        "name": "Family Office Security Review",
        "category": "family_office",
        "estimated_duration_days": 60,
        "description": (
            "Comprehensive security review for family offices, covering physical and digital "
            "audits, risk profiling, protocol implementation, and client sign-off."
        ),
        "milestones_template": [
            {
                "title": "Baseline Security Audit",
                "description": "Audit physical premises, digital security, and staff backgrounds.",
                "offset_days": 0,
                "duration_days": 14,
                "tasks": [
                    {
                        "title": "Physical premises audit",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Digital security assessment",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Staff background checks",
                        "description": None,
                        "priority": "high",
                    },
                ],
            },
            {
                "title": "Risk Profile Development",
                "description": "Profile family members and map asset exposure and threat vectors.",
                "offset_days": 14,
                "duration_days": 14,
                "tasks": [
                    {
                        "title": "Family member risk profiling",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Asset exposure mapping",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Identify threat vectors",
                        "description": None,
                        "priority": "high",
                    },
                ],
            },
            {
                "title": "Security Protocol Implementation",
                "description": "Install systems, train staff, and implement access controls.",
                "offset_days": 28,
                "duration_days": 21,
                "tasks": [
                    {
                        "title": "Install security systems",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Train household staff",
                        "description": None,
                        "priority": "medium",
                    },
                    {
                        "title": "Implement access controls",
                        "description": None,
                        "priority": "high",
                    },
                ],
            },
            {
                "title": "Review & Sign-off",
                "description": "Final walkthrough, client sign-off, and monitoring schedule.",
                "offset_days": 49,
                "duration_days": 11,
                "tasks": [
                    {
                        "title": "Final security walkthrough",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Client sign-off",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Establish ongoing monitoring schedule",
                        "description": None,
                        "priority": "medium",
                    },
                ],
            },
        ],
    },
    {
        "name": "Event Security Planning",
        "category": "event_security",
        "estimated_duration_days": 30,
        "description": (
            "Full event security lifecycle — intelligence gathering, team coordination, "
            "day-of preparation, event execution, and post-event debrief."
        ),
        "milestones_template": [
            {
                "title": "Event Intelligence Gathering",
                "description": "Conduct venue reconnaissance and review guest and VIP lists.",
                "offset_days": 0,
                "duration_days": 7,
                "tasks": [
                    {
                        "title": "Venue reconnaissance",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Guest list review",
                        "description": None,
                        "priority": "medium",
                    },
                    {
                        "title": "Identify VIP attendees",
                        "description": None,
                        "priority": "high",
                    },
                ],
            },
            {
                "title": "Security Team Coordination",
                "description": "Assign roles and plan entry/exit protocols with venue security.",
                "offset_days": 7,
                "duration_days": 10,
                "tasks": [
                    {
                        "title": "Assign security roles",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Coordinate with venue security",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Plan entry/exit protocols",
                        "description": None,
                        "priority": "high",
                    },
                ],
            },
            {
                "title": "Event Day Preparation",
                "description": "Final walkthrough, communication check, and command post setup.",
                "offset_days": 17,
                "duration_days": 3,
                "tasks": [
                    {
                        "title": "Final walkthrough",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Communication check",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Establish command post",
                        "description": None,
                        "priority": "medium",
                    },
                ],
            },
            {
                "title": "Event Execution",
                "description": "Deploy personnel, monitor perimeter, and manage VIP movements.",
                "offset_days": 20,
                "duration_days": 8,
                "tasks": [
                    {
                        "title": "Deploy security personnel",
                        "description": None,
                        "priority": "urgent",
                    },
                    {
                        "title": "Monitor perimeter",
                        "description": None,
                        "priority": "high",
                    },
                    {
                        "title": "Manage VIP movements",
                        "description": None,
                        "priority": "high",
                    },
                ],
            },
            {
                "title": "Post-Event Debrief",
                "description": "Team debrief, incident report, and client feedback.",
                "offset_days": 28,
                "duration_days": 2,
                "tasks": [
                    {
                        "title": "Team debrief",
                        "description": None,
                        "priority": "medium",
                    },
                    {
                        "title": "Incident report",
                        "description": None,
                        "priority": "medium",
                    },
                    {
                        "title": "Client feedback session",
                        "description": None,
                        "priority": "medium",
                    },
                ],
            },
        ],
    },
]


async def seed_program_templates(db: AsyncSession) -> None:
    """Idempotently seed system program templates."""
    for template_data in SYSTEM_TEMPLATES:
        result = await db.execute(
            select(ProgramTemplate).where(
                ProgramTemplate.name == template_data["name"],
                ProgramTemplate.is_system_template.is_(True),
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            continue

        template = ProgramTemplate(
            name=template_data["name"],
            description=template_data.get("description"),
            category=template_data["category"],
            milestones_template=template_data.get("milestones_template"),
            estimated_duration_days=template_data.get("estimated_duration_days"),
            is_system_template=True,
            created_by=None,
            is_active=True,
        )
        db.add(template)
        logger.info("Seeded program template: %s", template_data["name"])

    await db.commit()
    logger.info("Program template seeding complete")
