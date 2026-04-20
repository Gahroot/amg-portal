from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Str50, Str2000, TextStr


class EscalationTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: Str50
    severity: Str50
    description_template: Str2000 | None = None
    suggested_actions: list[str] | None = None
    notification_template: TextStr | None = None
    is_active: bool = True


class EscalationTemplateUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    category: Str50 | None = None
    severity: Str50 | None = None
    description_template: Str2000 | None = None
    suggested_actions: list[str] | None = None
    notification_template: TextStr | None = None
    is_active: bool | None = None


class EscalationTemplateResponse(BaseModel):
    id: UUID
    name: str = Field(..., max_length=255)
    category: Str50
    severity: Str50
    description_template: Str2000 | None = None
    suggested_actions: list[str] | None = None
    notification_template: TextStr | None = None
    is_system: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EscalationTemplateListResponse(BaseModel):
    templates: list[EscalationTemplateResponse]
    total: int
