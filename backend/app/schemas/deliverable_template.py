"""Pydantic schemas for DeliverableTemplate."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255, Str2000

TEMPLATE_CATEGORIES = [
    "security_reports",
    "travel_assessments",
    "incident_reports",
    "financial_summaries",
    "general",
]


class DeliverableTemplateCreate(BaseModel):
    name: Str255
    description: Str2000 | None = None
    category: Str50
    deliverable_type: Str50 | None = None


class DeliverableTemplateUpdate(BaseModel):
    name: Str255 | None = None
    description: Str2000 | None = None
    category: Str50 | None = None
    deliverable_type: Str50 | None = None
    is_active: bool | None = None


class DeliverableTemplateResponse(BaseModel):
    id: UUID
    name: Str255
    description: Str2000 | None
    category: Str50
    file_type: Str100 | None
    file_name: Str255 | None
    file_size: int | None
    deliverable_type: Str50 | None
    is_active: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
    # Populated by the route handler — not a DB column
    download_url: Str2000 | None = None

    model_config = ConfigDict(from_attributes=True)


class DeliverableTemplateListResponse(BaseModel):
    templates: list[DeliverableTemplateResponse]
    total: int


class TemplateCategoryInfo(BaseModel):
    """Metadata for a template category used in the library browser."""

    key: Str50
    label: Str100
    count: int
