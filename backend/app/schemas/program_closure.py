from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str50, Str100, Str255, Str2000, TextStr


class ChecklistItem(BaseModel):
    key: Str100
    label: Str255
    completed: bool = False


class ProgramClosureCreate(BaseModel):
    program_id: UUID
    notes: Str2000 | None = None


class ProgramClosureUpdate(BaseModel):
    notes: Str2000 | None = None


class ChecklistUpdate(BaseModel):
    items: list[ChecklistItem]


class DebriefNotesUpdate(BaseModel):
    notes: TextStr


class ProgramClosureResponse(BaseModel):
    id: UUID
    program_id: UUID
    status: Str50
    checklist: list[ChecklistItem]
    notes: Str2000 | None
    debrief_notes: TextStr | None
    debrief_notes_at: datetime | None
    debrief_notes_by: UUID | None
    debrief_notes_by_name: Str255 | None
    initiated_by: UUID
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
