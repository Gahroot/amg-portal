"""Service for communication template operations."""

import uuid
from typing import Any

from jinja2 import Template
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.communication_template import CommunicationTemplate
from app.schemas.communication_template import TemplateCreate, TemplateUpdate
from app.services.crud_base import CRUDBase


class TemplateService(CRUDBase[CommunicationTemplate, TemplateCreate, TemplateUpdate]):
    """Service for communication template operations."""

    async def get_active_templates(
        self,
        db: AsyncSession,
        template_type: str | None = None,
        skip: int = 0,
        limit: int = 50,
        include_inactive: bool = False,
    ) -> tuple[list[CommunicationTemplate], int]:
        """Get templates, optionally filtered by type. Includes inactive if requested."""
        query = select(CommunicationTemplate)
        count_query = select(func.count()).select_from(CommunicationTemplate)

        if not include_inactive:
            query = query.where(CommunicationTemplate.is_active)
            count_query = count_query.where(CommunicationTemplate.is_active)

        if template_type:
            query = query.where(CommunicationTemplate.template_type == template_type)
            count_query = count_query.where(CommunicationTemplate.template_type == template_type)

        query = query.order_by(CommunicationTemplate.name.asc())

        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.offset(skip).limit(limit))
        templates = list(result.scalars().all())

        return templates, total

    async def delete(self, db: AsyncSession, template_id: uuid.UUID) -> bool:
        """Hard-delete a template. Returns True if deleted, False if not found."""
        template = await self.get(db, template_id)
        if not template:
            return False
        await db.delete(template)
        await db.commit()
        return True

    async def render_template(
        self,
        db: AsyncSession,
        template_id: uuid.UUID,
        variables: dict[str, Any],
    ) -> dict[str, str | None] | None:
        """Render a template with the given variables."""
        template = await self.get(db, template_id)
        if not template:
            return None

        # Validate that all required variables are provided
        if template.variable_definitions:
            for var_name, var_def in template.variable_definitions.items():
                if var_def.get("required") and var_name not in variables:
                    raise ValueError(f"Missing required variable: {var_name}")

        # Render subject and body using Jinja2
        subject: str | None = None
        if template.subject:
            subject_template = Template(template.subject)
            subject = subject_template.render(**variables)

        body_template = Template(template.body)
        body = body_template.render(**variables)

        return {"subject": subject, "body": body}

    async def validate_variables(
        self,
        db: AsyncSession,
        template_id: uuid.UUID,
        variables: dict[str, Any],
    ) -> list[str]:
        """Validate variables against template definition. Returns list of errors."""
        template = await self.get(db, template_id)
        if not template:
            return ["Template not found"]

        errors = []

        if template.variable_definitions:
            for var_name, var_def in template.variable_definitions.items():
                if var_def.get("required") and var_name not in variables:
                    errors.append(f"Missing required variable: {var_name}")

                # Type validation could be added here

        return errors


template_service = TemplateService(CommunicationTemplate)
