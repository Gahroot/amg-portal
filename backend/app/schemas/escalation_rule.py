from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EscalationRuleCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_type: str
    trigger_conditions: dict[str, object] = {}
    escalation_level: str
    auto_assign_to_role: str | None = None
    is_active: bool = True


class EscalationRuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_type: str | None = None
    trigger_conditions: dict[str, object] | None = None
    escalation_level: str | None = None
    auto_assign_to_role: str | None = None
    is_active: bool | None = None


class EscalationRuleResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    trigger_type: str
    trigger_conditions: dict[str, object]
    escalation_level: str
    auto_assign_to_role: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EscalationRuleListResponse(BaseModel):
    rules: list[EscalationRuleResponse]
    total: int
