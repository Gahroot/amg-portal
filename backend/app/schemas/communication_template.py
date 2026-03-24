"""Schemas for communication template operations."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class VariableDefinition(BaseModel):
    type: str  # string, number, date, boolean
    description: str
    default: str | None = None
    required: bool = True


class TemplateCreate(BaseModel):
    name: str
    template_type: str = "custom"
    subject: str | None = None
    body: str
    variable_definitions: dict[str, VariableDefinition] | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body: str | None = None
    variable_definitions: dict[str, VariableDefinition] | None = None
    is_active: bool | None = None


class TemplateStatusAction(BaseModel):
    action: Literal["submit", "approve", "reject"]
    reason: str | None = None


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    template_type: str
    subject: str | None = None
    body: str
    variable_definitions: dict[str, Any] | None = None
    is_active: bool
    is_system: bool
    status: str = "draft"
    rejection_reason: str | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TemplateListResponse(BaseModel):
    templates: list[TemplateResponse]
    total: int


class TemplateRenderRequest(BaseModel):
    template_id: UUID
    variables: dict[str, Any]  # Variable values to substitute


class TemplateRenderResponse(BaseModel):
    subject: str | None = None
    body: str
