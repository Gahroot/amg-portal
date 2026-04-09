"""add_escalation_templates

Revision ID: add_escalation_templates
Revises: add_custom_reports, add_shared_reports
Create Date: 2026-03-23 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_escalation_templates"
down_revision: tuple[str, ...] = ("add_custom_reports", "add_shared_reports")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SYSTEM_TEMPLATES = [
    {
        "name": "Partner SLA Breach",
        "category": "partner_sla_breach",
        "severity": "milestone",
        "description_template": "Partner {partner_name} has breached the agreed SLA for {service_type}. The deadline was {deadline} and the current status is {current_status}.",  # noqa: E501
        "suggested_actions": [
            "Contact partner immediately to understand the cause of the breach",
            "Document the breach with timestamps and evidence",
            "Review contractual obligations and penalties",
            "Notify the client relationship manager",
            "Schedule a corrective action review meeting",
            "Update SLA tracker with breach details",
        ],
        "notification_template": "SLA Breach Alert: Partner {partner_name} has missed the agreed deadline for {service_type}. Immediate action required.",  # noqa: E501
    },
    {
        "name": "Client Dissatisfaction",
        "category": "client_dissatisfaction",
        "severity": "program",
        "description_template": "Client {client_name} has expressed dissatisfaction regarding {issue_area}. Feedback received: {feedback_summary}.",  # noqa: E501
        "suggested_actions": [
            "Schedule an urgent call with the client within 24 hours",
            "Review all recent interactions and touchpoints",
            "Identify root cause of dissatisfaction",
            "Prepare a remediation plan with clear timelines",
            "Escalate to Managing Director if required",
            "Document all actions taken for quality review",
        ],
        "notification_template": "Client Dissatisfaction: {client_name} has raised concerns about {issue_area}. Please review and respond urgently.",  # noqa: E501
    },
    {
        "name": "Resource Unavailable",
        "category": "resource_unavailable",
        "severity": "task",
        "description_template": "Critical resource {resource_name} is unavailable for {program_name}. Expected availability: {expected_date}. Impact: {impact_description}.",  # noqa: E501
        "suggested_actions": [
            "Identify alternative resources or substitutes",
            "Assess impact on program timeline and deliverables",
            "Notify all affected stakeholders",
            "Update program schedule to reflect the delay",
            "Document contingency plan",
            "Review resource allocation across all active programs",
        ],
        "notification_template": "Resource Unavailability: {resource_name} is unavailable for {program_name}. Timeline review required.",  # noqa: E501
    },
    {
        "name": "Budget Overrun",
        "category": "budget_overrun",
        "severity": "program",
        "description_template": "Program {program_name} has exceeded its approved budget by {overrun_amount} ({overrun_percentage}%). Current spend: {current_spend}. Approved budget: {approved_budget}.",  # noqa: E501
        "suggested_actions": [
            "Prepare a detailed cost breakdown report",
            "Identify the cause of the budget overrun",
            "Submit a budget revision request for approval",
            "Review remaining deliverables for cost optimisation",
            "Notify the finance compliance team",
            "Schedule a budget review meeting with client if applicable",
        ],
        "notification_template": "Budget Overrun Alert: {program_name} has exceeded its approved budget. Finance review required immediately.",  # noqa: E501
    },
    {
        "name": "Timeline Delay",
        "category": "timeline_delay",
        "severity": "milestone",
        "description_template": "Program {program_name} is behind schedule. Milestone '{milestone_name}' was due {original_date} and is now expected to complete {revised_date}. Reason: {delay_reason}.",  # noqa: E501
        "suggested_actions": [
            "Identify all affected downstream milestones and tasks",
            "Prepare a revised project timeline",
            "Communicate delay to client with updated schedule",
            "Review resource allocation to accelerate recovery",
            "Document root cause for lessons learned",
            "Establish daily check-ins until schedule is recovered",
        ],
        "notification_template": "Timeline Delay: {program_name} is behind schedule. Milestone '{milestone_name}' requires immediate attention.",  # noqa: E501
    },
    {
        "name": "Quality Issue",
        "category": "quality_issue",
        "severity": "task",
        "description_template": "Quality issue identified in {deliverable_name} for {program_name}. Issue: {quality_issue_description}. Severity: {severity_level}.",  # noqa: E501
        "suggested_actions": [
            "Halt delivery until quality issue is resolved",
            "Conduct a root cause analysis",
            "Engage the relevant partner or team for remediation",
            "Set up a quality review checkpoint",
            "Document the issue and corrective actions",
            "Review quality control processes to prevent recurrence",
        ],
        "notification_template": "Quality Issue: A quality concern has been identified in {deliverable_name}. Review and corrective action required.",  # noqa: E501
    },
]


def upgrade() -> None:
    """Create escalation_templates table and seed system templates."""
    op.create_table(
        "escalation_templates",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("description_template", sa.Text(), nullable=True),
        sa.Column("suggested_actions", postgresql.JSONB(), nullable=True),
        sa.Column("notification_template", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_index("ix_escalation_templates_category", "escalation_templates", ["category"])
    op.create_index("ix_escalation_templates_severity", "escalation_templates", ["severity"])
    op.create_index("ix_escalation_templates_is_system", "escalation_templates", ["is_system"])

    # Seed system templates
    conn = op.get_bind()
    for tpl in SYSTEM_TEMPLATES:
        conn.execute(
            sa.text(
                """
                INSERT INTO escalation_templates
                    (id, name, category, severity, description_template,
                     suggested_actions, notification_template, is_system, is_active,
                     created_at, updated_at)
                VALUES
                    (gen_random_uuid(), :name, :category, :severity, :description_template,
                     CAST(:suggested_actions AS jsonb), :notification_template, true, true,
                     now(), now())
                """
            ),
            {
                "name": tpl["name"],
                "category": tpl["category"],
                "severity": tpl["severity"],
                "description_template": tpl["description_template"],
                "suggested_actions": __import__("json").dumps(tpl["suggested_actions"]),
                "notification_template": tpl["notification_template"],
            },
        )


def downgrade() -> None:
    """Drop escalation_templates table."""
    op.drop_index("ix_escalation_templates_is_system", table_name="escalation_templates")
    op.drop_index("ix_escalation_templates_severity", table_name="escalation_templates")
    op.drop_index("ix_escalation_templates_category", table_name="escalation_templates")
    op.drop_table("escalation_templates")
