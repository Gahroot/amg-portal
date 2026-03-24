# Recurring Task Templates — Implementation Plan

## Overview
Add recurring task template model that auto-creates tasks on schedule (e.g., "Quarterly compliance review"). Uses iCal RRULE format via `python-dateutil` for schedule parsing.

---

## Files To Create / Modify (in order)

### 1. `backend/app/models/recurring_task.py` — New model
```python
class RecurringTaskTemplate(Base, TimestampMixin):
    __tablename__ = "recurring_task_templates"
    id: UUID (pk)
    name: str(255) - template name ("Quarterly compliance review")
    description: str | None - text, nullable
    rrule: str(500) - iCal RRULE string e.g. "FREQ=QUARTERLY;BYDAY=MO;BYSETPOS=1"
    milestone_id: UUID FK → milestones.id (nullable, SET NULL on delete)
    assignee_id: UUID FK → users.id (nullable, SET NULL on delete)
    priority: str(20) default "medium"
    task_title_template: str(255) - e.g. "Q{quarter} Compliance Review {year}"
    task_description: str | None
    next_due_date: Date nullable
    last_triggered_at: DateTime(tz) nullable
    is_active: bool default True
    created_by: UUID FK → users.id
    
    # Relationships:
    milestone = relationship("Milestone")
    assignee = relationship("User", fk=[assignee_id])
    creator = relationship("User", fk=[created_by])
```

### 2. `backend/app/models/task.py` — Add recurring template FK
Add: `recurring_template_id: Mapped[uuid.UUID | None]` FK to `recurring_task_templates.id` (nullable, SET NULL on delete).
Add relationship: `recurring_template = relationship("RecurringTaskTemplate")`.

### 3. `backend/alembic/versions/add_recurring_tasks.py` — Migration
- down_revision = "add_client_dates"
- Create table `recurring_task_templates` with all columns
- Add column `recurring_template_id` (UUID, nullable) to `tasks`
- FK constraint from tasks.recurring_template_id → recurring_task_templates.id ON DELETE SET NULL
- Index on `recurring_task_templates.next_due_date` and `is_active`

### 4. `backend/app/schemas/recurring_task.py` — Pydantic schemas
```python
class RecurringTaskTemplateCreate(BaseModel):
    name: str
    description: str | None = None
    rrule: str  # validated as valid RRULE string
    milestone_id: UUID | None = None
    assignee_id: UUID | None = None
    priority: TaskPriority = TaskPriority.medium
    task_title_template: str
    task_description: str | None = None

class RecurringTaskTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    rrule: str | None = None
    milestone_id: UUID | None = None
    assignee_id: UUID | None = None
    priority: TaskPriority | None = None
    task_title_template: str | None = None
    task_description: str | None = None
    is_active: bool | None = None

class RecurringTaskTemplateResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    rrule: str
    milestone_id: UUID | None
    assignee_id: UUID | None
    priority: str
    task_title_template: str
    task_description: str | None
    next_due_date: date | None
    last_triggered_at: datetime | None
    is_active: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    # optional nested:
    milestone_title: str | None = None
    assignee_name: str | None = None

class RecurringTaskTemplateListResponse(BaseModel):
    templates: list[RecurringTaskTemplateResponse]
    total: int
```

### 5. `backend/app/services/recurring_task_service.py` — New service
```python
from dateutil.rrule import rrulestr
from datetime import date, datetime, UTC

def compute_next_due(rrule_str: str, after: date) -> date | None:
    """Parse RRULE and compute next occurrence after `after`."""
    rule = rrulestr(rrule_str, dtstart=datetime(after.year, after.month, after.day, tzinfo=UTC))
    nxt = rule.after(datetime.combine(after, datetime.min.time(), tzinfo=UTC))
    return nxt.date() if nxt else None

async def initialize_next_due(db, template: RecurringTaskTemplate) -> None:
    """Set next_due_date on a newly created template."""
    today = datetime.now(UTC).date()
    template.next_due_date = compute_next_due(template.rrule, today)
    await db.commit()

async def generate_task_from_template(db, template: RecurringTaskTemplate) -> Task | None:
    """Create a Task from a recurring template. Returns created task or None if milestone missing."""
    if not template.milestone_id:
        return None
    
    today = datetime.now(UTC).date()
    # Expand title template: support {year}, {quarter}, {month}, {date}
    title = _expand_title(template.task_title_template, today)
    
    # Get max position in todo column
    max_pos = await db.scalar(select(func.max(Task.position)).where(Task.status == "todo")) or 0
    
    task = Task(
        milestone_id=template.milestone_id,
        title=title,
        description=template.task_description,
        status=TaskStatus.todo,
        priority=template.priority,
        due_date=template.next_due_date,
        assigned_to=template.assignee_id,
        position=max_pos + 1,
        recurring_template_id=template.id,
    )
    db.add(task)
    
    # Advance next_due_date
    template.last_triggered_at = datetime.now(UTC)
    template.next_due_date = compute_next_due(template.rrule, today)
    
    await db.commit()
    await db.refresh(task)
    return task

def _expand_title(template_str: str, today: date) -> str:
    """Replace {year}, {quarter}, {month}, {date} placeholders."""
    quarter = (today.month - 1) // 3 + 1
    return (template_str
        .replace("{year}", str(today.year))
        .replace("{quarter}", str(quarter))
        .replace("{month}", today.strftime("%B"))
        .replace("{date}", today.strftime("%Y-%m-%d")))

async def process_due_templates(db) -> int:
    """Find all active templates with next_due_date <= today and generate tasks."""
    today = datetime.now(UTC).date()
    result = await db.execute(
        select(RecurringTaskTemplate)
        .where(
            RecurringTaskTemplate.is_active == True,
            RecurringTaskTemplate.next_due_date <= today,
            RecurringTaskTemplate.next_due_date.isnot(None),
        )
    )
    templates = result.scalars().all()
    count = 0
    for template in templates:
        try:
            task = await generate_task_from_template(db, template)
            if task:
                count += 1
        except Exception:
            logger.exception("Failed to generate task for template %s", template.id)
    return count
```

### 6. `backend/app/api/v1/recurring_tasks.py` — New router
Endpoints:
- `GET /recurring-tasks/` — list all (paginated), `require_coordinator_or_above`
- `POST /recurring-tasks/` — create template, `require_coordinator_or_above`
- `GET /recurring-tasks/{id}` — get single, `require_internal`
- `PATCH /recurring-tasks/{id}` — update template, `require_coordinator_or_above`
- `DELETE /recurring-tasks/{id}` — delete, `require_coordinator_or_above`
- `POST /recurring-tasks/{id}/trigger` — manually trigger task generation, `require_coordinator_or_above`
- `GET /recurring-tasks/{id}/tasks` — get tasks generated by this template (filter Task.recurring_template_id == id)

### 7. `backend/app/api/v1/router.py` — Register router
Add import and `router.include_router(recurring_tasks_router, prefix="/recurring-tasks", tags=["recurring-tasks"])`.

### 8. `backend/app/models/__init__.py` — Register model
Add `from app.models.recurring_task import RecurringTaskTemplate  # noqa: F401`.

### 9. `backend/app/services/scheduler_service.py` — Add job
Add `_process_recurring_tasks_job()` that calls `process_due_templates(db)`. Register as daily cron at 6:00 AM UTC.
Also import `from app.models.recurring_task import RecurringTaskTemplate`.

---

### Frontend

### 10. `frontend/src/types/task.ts` — Add recurring task types
```typescript
export interface RecurringTaskTemplate {
  id: string;
  name: string;
  description: string | null;
  rrule: string;
  milestone_id: string | null;
  assignee_id: string | null;
  priority: TaskPriority;
  task_title_template: string;
  task_description: string | null;
  next_due_date: string | null;
  last_triggered_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  milestone_title: string | null;
  assignee_name: string | null;
}

export interface RecurringTaskTemplateListResponse {
  templates: RecurringTaskTemplate[];
  total: number;
}

export interface RecurringTaskTemplateCreate {
  name: string;
  description?: string;
  rrule: string;
  milestone_id?: string;
  assignee_id?: string;
  priority?: TaskPriority;
  task_title_template: string;
  task_description?: string;
}

export interface RecurringTaskTemplateUpdate {
  name?: string;
  description?: string;
  rrule?: string;
  milestone_id?: string;
  assignee_id?: string;
  priority?: TaskPriority;
  task_title_template?: string;
  task_description?: string;
  is_active?: boolean;
}

// Add to TaskBoard interface: recurring_template_id: string | null
```

### 11. `frontend/src/lib/api/recurring-tasks.ts` — New API file
CRUD + trigger + tasks-by-template functions calling `/api/v1/recurring-tasks/*`.

### 12. `frontend/src/hooks/use-recurring-tasks.ts` — New hooks file
```typescript
useRecurringTasks() // list
useRecurringTemplate(id) // single
useCreateRecurringTemplate() // mutation
useUpdateRecurringTemplate(id) // mutation
useDeleteRecurringTemplate(id) // mutation
useTriggerRecurringTemplate(id) // mutation
useTemplateGeneratedTasks(templateId) // query tasks by template
```

### 13. `frontend/src/components/tasks/recurring-task-form.tsx` — New component
Dialog/form for creating/editing recurring task templates.

UI sections:
- Template name, description
- Task Title Template field (with placeholder legend: `{year}`, `{quarter}`, `{month}`, `{date}`)
- Task Description (optional)
- Recurrence Schedule builder:
  - Simple select: Daily / Weekly / Monthly / Quarterly / Yearly / Custom
  - When "Custom": show RRULE textarea with helper
  - Preview: "Next occurrence: ..." computed from rrule
- Milestone selector (searchable list from API)
- Assignee selector
- Priority select
- is_active toggle (for edit mode)
- Save / Cancel buttons

### 14. `frontend/src/app/(dashboard)/tasks/recurring/page.tsx` — New page
Full management page for recurring templates.

Layout:
- Header: "Recurring Tasks" + "New Template" button
- Table of templates: name, rrule description, next_due_date, assignee, is_active toggle, actions (edit, delete, trigger now)
- Empty state when no templates
- Uses `useRecurringTasks()` hook
- Opens `RecurringTaskForm` dialog on create/edit

### 15. `frontend/src/components/tasks/task-card.tsx` — Add recurring indicator
If `task.recurring_template_id` is set, show a small 🔄 Repeat icon (RefreshCw from lucide) with tooltip "Recurring task" next to the title.

---

## Key Design Decisions

1. **RRULE parsing**: Use `python-dateutil`'s `rrulestr()` which is already available in most Python environments. Check if it's installed; if not, add to `pyproject.toml`.

2. **Task title templates**: Simple string replacement for `{year}`, `{quarter}`, `{month}`, `{date}` - keeps it simple without requiring Jinja2.

3. **Scheduler job**: Daily at 6:00 AM UTC. The job compares `next_due_date <= today` so even if it misses a day, it catches up.

4. **milestone_id optional**: Templates can be created without a milestone_id (e.g., standalone compliance templates). If milestone_id is null, the job skips task generation with a warning.

5. **Notification on auto-generation**: When scheduler creates a task, send a `system` notification to the assignee (if set) and the template creator.

6. **RRULE presets (frontend)**: Provide friendly radio buttons that generate the RRULE string:
   - Daily → `FREQ=DAILY`
   - Weekly → `FREQ=WEEKLY`  
   - Monthly → `FREQ=MONTHLY`
   - Quarterly → `FREQ=MONTHLY;INTERVAL=3`
   - Yearly → `FREQ=YEARLY`
   - Custom → free-form RRULE text entry

7. **Migration chain**: down_revision = `"add_client_dates"` (the current latest migration)

8. **Task recurring indicator**: Add `recurring_template_id: string | null` to `TaskBoard` type and display a subtle icon on the card.

---

## Acceptance Criteria

| Requirement | Implementation |
|-------------|---------------|
| Create recurring task templates | POST /recurring-tasks/ + RecurringTaskForm UI |
| Tasks auto-generate on schedule | Scheduler job at 6 AM + process_due_templates() |
| Pause/resume templates | is_active toggle in PATCH endpoint + UI toggle |
| Generated tasks linked to template | recurring_template_id FK on tasks table |
| Works with scheduler service | _process_recurring_tasks_job() registered |
| RRULE patterns supported | dateutil.rrulestr() + preset UI builder |
