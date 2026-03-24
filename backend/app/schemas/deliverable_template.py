"""Pydantic schemas for DeliverableTemplate."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

TEMPLATE_CATEGORIES = [
    "security_reports",
    "travel_assessments",
    "incident_reports",
    "financial_summaries",
    "general",
]


class DeliverableTemplateCreate(BaseModel):
    name: str
    description: str | None = None
    category: str
    deliverable_type: str | None = None


class DeliverableTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    deliverable_type: str | None = None
    is_active: bool | None = None


class DeliverableTemplateResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    category: str
    file_type: str | None
    file_name: str | None
    file_size: int | None
    deliverable_type: str | None
    is_active: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
    # Populated by the route handler — not a DB column
    download_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DeliverableTemplateListResponse(BaseModel):
    templates: list[DeliverableTemplateResponse]
    total: int


class TemplateCategoryInfo(BaseModel):
    """Metadata for a template category used in the library browser."""

    key: str
    label: str
    count: int
