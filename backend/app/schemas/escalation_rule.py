from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str255, Str2000


class EscalationRuleCreate(BaseModel):
    name: Str255
    description: Str2000 | None = None
    trigger_type: Str50
    trigger_conditions: dict[str, object] = {}
    escalation_level: Str50
    auto_assign_to_role: Str50 | None = None
    is_active: bool = True


class EscalationRuleUpdate(BaseModel):
    name: Str255 | None = None
    description: Str2000 | None = None
    trigger_type: Str50 | None = None
    trigger_conditions: dict[str, object] | None = None
    escalation_level: Str50 | None = None
    auto_assign_to_role: Str50 | None = None
    is_active: bool | None = None


class EscalationRuleResponse(BaseModel):
    id: UUID
    name: Str255
    description: Str2000 | None = None
    trigger_type: Str50
    trigger_conditions: dict[str, object]
    escalation_level: Str50
    auto_assign_to_role: Str50 | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EscalationRuleListResponse(BaseModel):
    rules: list[EscalationRuleResponse]
    total: int
