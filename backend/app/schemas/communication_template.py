"""Schemas for communication template operations."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str255, Str500, Str2000, TextStr


class VariableDefinition(BaseModel):
    type: Str50  # string, number, date, boolean
    description: Str500
    default: Str2000 | None = None
    required: bool = True


class TemplateCreate(BaseModel):
    name: Str255
    template_type: Str50 = "custom"
    subject: Str500 | None = None
    body: TextStr
    variable_definitions: dict[str, VariableDefinition] | None = None


class TemplateUpdate(BaseModel):
    name: Str255 | None = None
    subject: Str500 | None = None
    body: TextStr | None = None
    variable_definitions: dict[str, VariableDefinition] | None = None
    is_active: bool | None = None


class TemplateStatusAction(BaseModel):
    action: Literal["submit", "approve", "reject"]
    reason: Str2000 | None = None


class TemplateResponse(BaseModel):
    id: UUID
    name: Str255
    template_type: Str50
    subject: Str500 | None = None
    body: TextStr
    variable_definitions: dict[str, Any] | None = None
    is_active: bool
    is_system: bool
    status: Str50 = "draft"
    rejection_reason: Str2000 | None = None
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
    subject: Str500 | None = None
    body: TextStr
