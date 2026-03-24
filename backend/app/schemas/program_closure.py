from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ChecklistItem(BaseModel):
    key: str
    label: str
    completed: bool = False


class ProgramClosureCreate(BaseModel):
    program_id: UUID
    notes: str | None = None


class ProgramClosureUpdate(BaseModel):
    notes: str | None = None


class ChecklistUpdate(BaseModel):
    items: list[ChecklistItem]


class DebriefNotesUpdate(BaseModel):
    notes: str


class ProgramClosureResponse(BaseModel):
    id: UUID
    program_id: UUID
    status: str
    checklist: list[ChecklistItem]
    notes: str | None
    debrief_notes: str | None
    debrief_notes_at: datetime | None
    debrief_notes_by: UUID | None
    debrief_notes_by_name: str | None
    initiated_by: UUID
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
