# Program Templates Library — Implementation Plan

## Overview
Build a program templates library with pre-defined system templates containing milestones, tasks, and estimated timelines. Allow users to browse, preview, and start programs from templates.

---

## Backend

### 1. `backend/app/models/program_template.py` — New model
```python
class ProgramTemplate(Base, TimestampMixin):
    __tablename__ = "program_templates"
    id: UUID (pk)
    name: str (255)
    description: str | None (Text)
    category: str (100) — e.g. "executive_protection", "travel_security", "event_security", "family_office"
    milestones_template: list[dict] | None (JSONB)
    # Each milestone: {title, description, offset_days (from start), duration_days, tasks: [{title, description, priority}]}
    estimated_duration_days: int | None
    is_system_template: bool (default False, server_default false)
    created_by: UUID | None (FK users.id, nullable — None for system templates)
    is_active: bool (default True)
```

### 2. `backend/alembic/versions/add_program_templates.py` — Migration
- `revision = "add_program_templates"`
- `down_revision = "add_client_dates"` (current latest)
- Creates `program_templates` table

### 3. `backend/app/schemas/program_template.py` — Schemas
```python
class MilestoneTemplateTask(BaseModel):
    title: str
    description: str | None
    priority: str = "medium"  # low/medium/high/urgent

class MilestoneTemplateItem(BaseModel):
    title: str
    description: str | None
    offset_days: int = 0          # days from program start
    duration_days: int = 7        # estimated days for milestone
    tasks: list[MilestoneTemplateTask] = []

class ProgramTemplateCreate(BaseModel):
    name: str
    description: str | None
    category: str
    milestones_template: list[MilestoneTemplateItem] = []
    estimated_duration_days: int | None

class ProgramTemplateUpdate(BaseModel):
    name: str | None
    description: str | None
    category: str | None
    milestones_template: list[MilestoneTemplateItem] | None
    estimated_duration_days: int | None
    is_active: bool | None

class ProgramTemplateResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    category: str
    milestones_template: list[dict] | None
    estimated_duration_days: int | None
    is_system_template: bool
    is_active: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ProgramTemplateListResponse(BaseModel):
    templates: list[ProgramTemplateResponse]
    total: int
```

### 4. `backend/app/services/program_template_seeder.py` — New seeder
Seed 4 system templates on startup. Each template has realistic milestones for UHNW security programs:

**"Standard Executive Protection Program"** (category: executive_protection, 90 days)
- Threat Assessment & Intelligence Gathering (offset: 0, 14 days)
  - Tasks: Conduct background threat assessment, Review travel itineraries, Identify vulnerabilities
- Security Protocol Development (offset: 14, 14 days)
  - Tasks: Draft security protocols, Define communication channels, Establish emergency procedures
- Personnel Deployment & Briefing (offset: 28, 7 days)
  - Tasks: Brief security team, Conduct site reconnaissance, Test communication systems
- Active Protection Phase (offset: 35, 45 days)
  - Tasks: Daily security briefings, Monitor threat landscape, Document incidents
- Debrief & Reporting (offset: 80, 10 days)
  - Tasks: Compile incident report, Client debrief session, Archive documentation

**"Travel Security Assessment"** (category: travel_security, 21 days)
- Destination Intelligence (offset: 0, 7 days)
  - Tasks: Country risk assessment, Identify safe routes, Locate medical facilities
- Logistics Security Planning (offset: 7, 7 days)
  - Tasks: Vet transportation providers, Book secure accommodations, Coordinate airport transfers
- Traveler Briefing (offset: 14, 3 days)
  - Tasks: Security briefing session, Provide emergency contacts, Issue satellite phone
- On-Ground Support (offset: 17, 4 days)
  - Tasks: Monitor traveler check-ins, Stand-by response readiness, Post-trip debrief

**"Family Office Security Review"** (category: family_office, 60 days)
- Baseline Security Audit (offset: 0, 14 days)
  - Tasks: Physical premises audit, Digital security assessment, Staff background checks
- Risk Profile Development (offset: 14, 14 days)
  - Tasks: Family member risk profiling, Asset exposure mapping, Identify threat vectors
- Security Protocol Implementation (offset: 28, 21 days)
  - Tasks: Install security systems, Train household staff, Implement access controls
- Review & Sign-off (offset: 49, 11 days)
  - Tasks: Final security walkthrough, Client sign-off, Establish ongoing monitoring schedule

**"Event Security Planning"** (category: event_security, 30 days)
- Event Intelligence Gathering (offset: 0, 7 days)
  - Tasks: Venue reconnaissance, Guest list review, Identify VIP attendees
- Security Team Coordination (offset: 7, 10 days)
  - Tasks: Assign security roles, Coordinate with venue security, Plan entry/exit protocols
- Event Day Preparation (offset: 17, 3 days)
  - Tasks: Final walkthrough, Communication check, Establish command post
- Event Execution (offset: 20, 8 days)
  - Tasks: Deploy security personnel, Monitor perimeter, Manage VIP movements
- Post-Event Debrief (offset: 28, 2 days)
  - Tasks: Team debrief, Incident report, Client feedback session

### 5. `backend/app/api/v1/program_templates.py` — New router
```
GET  /program-templates/           → list (query: category, is_system, skip, limit)
GET  /program-templates/{id}       → get single
POST /program-templates/           → create custom (require_rm_or_above)
PATCH /program-templates/{id}      → update (own templates or admin)
DELETE /program-templates/{id}     → delete (own custom only, system = 403)
```

### 6. `backend/app/api/v1/router.py` — Register router
Add: `from app.api.v1.program_templates import router as program_templates_router`
Include with prefix `/program-templates`.

### 7. `backend/app/models/__init__.py` — Register model
Add: `from app.models.program_template import ProgramTemplate`

### 8. `backend/app/main.py` — Seed on startup
Add `seed_program_templates(db)` call in lifespan alongside `seed_default_templates`.

---

## Frontend

### 9. `frontend/src/types/program-template.ts` — New types file
```typescript
export interface MilestoneTemplateTask {
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
}

export interface MilestoneTemplateItem {
  title: string;
  description: string | null;
  offset_days: number;
  duration_days: number;
  tasks: MilestoneTemplateTask[];
}

export interface ProgramTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  milestones_template: MilestoneTemplateItem[] | null;
  estimated_duration_days: number | null;
  is_system_template: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramTemplateCreate {
  name: string;
  description?: string;
  category: string;
  milestones_template?: MilestoneTemplateItem[];
  estimated_duration_days?: number;
}

export interface ProgramTemplateUpdate {
  name?: string;
  description?: string;
  category?: string;
  milestones_template?: MilestoneTemplateItem[];
  estimated_duration_days?: number;
  is_active?: boolean;
}

export interface ProgramTemplateListResponse {
  templates: ProgramTemplate[];
  total: number;
}

export const TEMPLATE_CATEGORIES: Record<string, string> = {
  executive_protection: "Executive Protection",
  travel_security: "Travel Security",
  family_office: "Family Office",
  event_security: "Event Security",
  custom: "Custom",
};
```

### 10. `frontend/src/lib/api/program-templates.ts` — New API file
Functions:
- `listProgramTemplates(params?: { category?: string; is_system?: boolean; skip?: number; limit?: number })`
- `getProgramTemplate(id: string)`
- `createProgramTemplate(data: ProgramTemplateCreate)`
- `updateProgramTemplate(id: string, data: ProgramTemplateUpdate)`
- `deleteProgramTemplate(id: string)`

### 11. `frontend/src/hooks/use-program-templates.ts` — New hooks file
```typescript
export function useProgramTemplates(params?)
export function useProgramTemplate(id: string)
export function useCreateProgramTemplate()  // mutation
export function useUpdateProgramTemplate()  // mutation
export function useDeleteProgramTemplate()  // mutation
```

### 12. `frontend/src/components/programs/template-picker.tsx` — New component
Modal/sheet that lets users pick a template before creating a program.

Props: `onSelect: (template: ProgramTemplate) => void`, `onSkip: () => void`

UI:
- Dialog with "Choose a Template" header
- Search/filter by category
- Grid of template cards: name, category badge, description, milestone count, estimated duration
- Click to expand preview: shows milestone list with task counts
- "Use Template" button + "Start Blank" option
- Loading skeleton

### 13. `frontend/src/app/(dashboard)/programs/templates/page.tsx` — New page
Browse & manage templates library.

Sections:
- Header: "Program Templates" + "New Template" button (internal users only)
- Filter tabs by category (All, Executive Protection, Travel Security, etc.)
- Grid of template cards (system + custom)
  - System templates: shield icon, "System" badge
  - Custom templates: edit/delete buttons (own templates)
- Each card: name, category badge, description excerpt, milestone count, duration estimate
- Click card → slide-over panel showing full template preview with milestone/task tree
- Empty state: "No templates found"

### 14. `frontend/src/app/(dashboard)/programs/new/page.tsx` — Modify existing
Add a step 0 before "details" — template selection.

Changes:
- Add `STEPS = ["template", "details", "milestones", "review"]`
- Step 0 (`template`): Show `<TemplatePicker>` inline (not modal), "Skip Template" button
- When template selected: pre-populate form fields and milestones from template data
  - Title: template name (user can change)
  - Objectives/scope from template description
  - Milestones pre-filled from template's `milestones_template`
- Show selected template badge in header once chosen
- Keep all existing form logic unchanged

---

## Implementation Order

1. Backend model
2. Backend migration
3. Backend schemas
4. Backend seeder (new file)
5. Register seeder in main.py
6. Backend API router
7. Register router in router.py
8. Register model in __init__.py
9. Frontend types
10. Frontend API file
11. Frontend hooks
12. Frontend template-picker component
13. Frontend templates page
14. Frontend new/page.tsx integration

---

## Key Design Decisions

- **milestones_template as JSONB**: Avoids a complex normalized template sub-table. Each milestone entry has `{title, description, offset_days, duration_days, tasks: [{title, description, priority}]}`.
- **offset_days**: Relative to program start_date. When applying template, if start_date is given, compute actual due_date = start_date + offset_days + duration_days.
- **System templates immutable**: DELETE returns 403 for `is_system_template = True`.
- **Seeder idempotent**: Check by name + is_system_template before inserting.
- **Template picker step**: Step 0 in new program flow. Selecting a template pre-fills milestones. User can still edit milestones freely before submitting.
- **File naming**: API file is `program_templates.py` (underscore, per Python convention) not `program-templates.py` as stated in task brief.
