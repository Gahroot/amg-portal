"""Schemas for communication template operations."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


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


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    template_type: str
    subject: str | None = None
    body: str
    variable_definitions: dict[str, Any] | None = None
    is_active: bool
    is_system: bool
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateListResponse(BaseModel):
    templates: list[TemplateResponse]
    total: int


class TemplateRenderRequest(BaseModel):
    template_id: UUID
    variables: dict[str, Any]  # Variable values to substitute


class TemplateRenderResponse(BaseModel):
    subject: str | None = None
    body: str
