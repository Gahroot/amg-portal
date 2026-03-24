# Dashboard Drag-and-Drop Customization Plan

## Overview

Implement a drag-and-drop dashboard customization system allowing users to add/remove/reorder widgets, with persistence via the database.

**Key observations:**
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` are **already installed** in `frontend/package.json`
- Existing widgets in `frontend/src/components/dashboard/`: `activity-feed.tsx`, `alerts-panel.tsx`, `partner-scorecard.tsx`, `program-health-table.tsx`, `quick-actions.tsx`, `stats-bar.tsx`
- Dashboard page at `frontend/src/app/(dashboard)/page.tsx` has a hard-coded layout
- Portal dashboard at `frontend/src/app/(portal)/portal/dashboard/page.tsx` has separate hard-coded layout
- Backend models use SQLAlchemy async ORM with TimestampMixin and UUID PKs
- Alembic migrations live in `backend/alembic/versions/` with `down_revision` chaining
- Last migration: `add_recent_items` (revises `add_two_person_delete`)

---

## Files to Create/Modify

### Backend (5 files)

1. **`backend/app/models/dashboard_config.py`** (new)
2. **`backend/app/schemas/dashboard_config.py`** (new)
3. **`backend/app/api/v1/dashboard_config.py`** (new — endpoints on `/users/me/dashboard-config`)
4. **`backend/app/models/__init__.py`** (modify — add import)
5. **`backend/app/api/v1/router.py`** (modify — register new router)
6. **`backend/alembic/versions/add_dashboard_config.py`** (new — migration)
7. **`backend/alembic/env.py`** (modify — add model import)

### Frontend (7 files)

8. **`frontend/src/lib/api/dashboard-config.ts`** (new — API client)
9. **`frontend/src/hooks/use-dashboard-config.ts`** (new — TanStack Query hooks)
10. **`frontend/src/components/dashboard/widget-registry.ts`** (new — widget definitions)
11. **`frontend/src/components/dashboard/dashboard-customizer.tsx`** (new — drawer/modal UI)
12. **`frontend/src/components/dashboard/draggable-widget.tsx`** (new — DnD wrapper)
13. **`frontend/src/app/(dashboard)/page.tsx`** (modify — wire in customizable layout)
14. **`frontend/src/app/(portal)/portal/dashboard/page.tsx`** (modify — wire in for client portal)

---

## Implementation Steps

### Step 1: Backend Model

**`backend/app/models/dashboard_config.py`**

```python
import uuid
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class DashboardConfig(Base, TimestampMixin):
    __tablename__ = "dashboard_configs"
    __table_args__ = (UniqueConstraint("user_id", "dashboard_key", name="uq_dashboard_config"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    dashboard_key: Mapped[str] = mapped_column(String(50), nullable=False, default="main")
    # JSON: list of {id: str, visible: bool, position: int}
    widget_config: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
```

### Step 2: Backend Schema

**`backend/app/schemas/dashboard_config.py`**

```python
from pydantic import BaseModel

class WidgetConfig(BaseModel):
    id: str
    visible: bool = True
    position: int

class DashboardConfigResponse(BaseModel):
    dashboard_key: str
    widget_config: list[WidgetConfig]
    model_config = ConfigDict(from_attributes=True)

class DashboardConfigUpdate(BaseModel):
    widget_config: list[WidgetConfig]
```

### Step 3: Backend API Endpoints

**`backend/app/api/v1/dashboard_config.py`**

Two endpoints on the `users` router prefix:
- `GET /api/v1/users/me/dashboard-config?dashboard_key=main` — Returns config or default for role
- `PUT /api/v1/users/me/dashboard-config?dashboard_key=main` — Upserts config

Logic:
- If no config exists, return the role-based default (computed in Python, not stored)
- On PUT, upsert using `select + update or insert` pattern
- Default configs per role hardcoded in the API module

### Step 4: Migration

**`backend/alembic/versions/add_dashboard_config.py`**

```python
revision = "add_dashboard_config"
down_revision = "add_recent_items"
```

Creates `dashboard_configs` table with columns: `id`, `user_id`, `dashboard_key`, `widget_config`, `created_at`, `updated_at`. Plus unique index on `(user_id, dashboard_key)`.

### Step 5: Wire backend

- Add `DashboardConfig` to `backend/app/models/__init__.py`
- Add `dashboard_config` import to `backend/alembic/env.py`
- Add new router to `backend/app/api/v1/router.py` under `/users` prefix (or separate route)
  
  Note: Since the endpoint path is `/users/me/dashboard-config`, the cleanest approach is to add the endpoints to the existing `users.py` file or create a new file and include it with the `/users` prefix.

### Step 6: Frontend API Client

**`frontend/src/lib/api/dashboard-config.ts`**

```typescript
export interface WidgetConfig { id: string; visible: boolean; position: number; }
export interface DashboardConfigResponse { dashboard_key: string; widget_config: WidgetConfig[]; }

export async function getDashboardConfig(dashboardKey = "main"): Promise<DashboardConfigResponse>
export async function updateDashboardConfig(dashboardKey: string, widgetConfig: WidgetConfig[]): Promise<DashboardConfigResponse>
```

### Step 7: Frontend Hook

**`frontend/src/hooks/use-dashboard-config.ts`**

Uses TanStack Query:
- `useDashboardConfig(dashboardKey)` — query
- `useUpdateDashboardConfig()` — mutation with optimistic update
- `useResetDashboardConfig(role, dashboardKey)` — resets to default

### Step 8: Widget Registry

**`frontend/src/components/dashboard/widget-registry.ts`**

Defines available widgets:

| ID | Label | Internal Only | Portal Only |
|----|-------|--------------|-------------|
| `stats_bar` | Real-Time Stats | ✅ | ❌ |
| `rag_breakdown` | RAG Status Breakdown | ✅ | ❌ |
| `activity_feed` | Activity Feed | ✅ | ❌ |
| `alerts_panel` | Alerts Panel | ✅ | ❌ |
| `at_risk_programs` | At-Risk Programs | ✅ | ❌ |
| `quick_actions` | Quick Actions | ✅ | ❌ |
| `partner_sla_health` | Partner SLA Health | ✅ (finance_compliance, managing_director only) | ❌ |
| `active_programs` | Active Programs | ❌ | ✅ (client) |
| `pending_decisions` | Pending Decisions | ❌ | ✅ (client) |
| `recent_messages` | Recent Messages | ❌ | ✅ (client) |
| `account_status` | Account Status | ❌ | ✅ (client) |

Each widget entry has:
- `id: string`
- `label: string`
- `description: string`
- `icon: LucideIcon`
- `allowedRoles: string[] | 'all'`
- `dashboardKey: 'main' | 'portal'`
- `defaultVisible: boolean`
- `defaultPosition: number`

### Step 9: Draggable Widget Wrapper

**`frontend/src/components/dashboard/draggable-widget.tsx`**

Uses `@dnd-kit/sortable` `useSortable` hook. When `editMode=false`, renders children normally. When `editMode=true`, adds drag handle, remove button, and sort indicator.

```tsx
interface DraggableWidgetProps {
  id: string;
  editMode: boolean;
  onRemove: (id: string) => void;
  children: React.ReactNode;
}
```

### Step 10: Dashboard Customizer UI

**`frontend/src/components/dashboard/dashboard-customizer.tsx`**

A slide-in panel (Sheet) containing:
- List of hidden widgets the user can add
- Drag-to-reorder for visible widgets
- Reset to Default button
- Save button (calls `useUpdateDashboardConfig`)

Props:
```tsx
interface DashboardCustomizerProps {
  open: boolean;
  onClose: () => void;
  dashboardKey: string;
  role: string;
}
```

### Step 11: Modify Internal Dashboard Page

**`frontend/src/app/(dashboard)/page.tsx`**

Changes:
1. Import `useDashboardConfig`, `DashboardCustomizer`, `DraggableWidget`, widget registry
2. Add `editMode` state (boolean)
3. Add "Customize" button in the header (Settings/LayoutDashboard icon, outline variant)
4. Replace hard-coded widget sections with a `DndContext + SortableContext` block
5. Map `widgetConfig` ordered list to render the right component for each widget ID
6. Pass `editMode`, `onRemove` to each `DraggableWidget`

The render function maps widget IDs to components:
```tsx
const WIDGET_COMPONENTS: Record<string, React.ComponentType<{...}>> = {
  stats_bar: () => <StatsBar ... />,
  rag_breakdown: () => <RagBreakdown ... />,
  activity_feed: () => <ActivityFeed ... />,
  alerts_panel: () => <AlertsPanel ... />,
  at_risk_programs: () => <AtRiskPrograms ... />,
  quick_actions: () => null, // inline
}
```

### Step 12: Modify Portal Dashboard Page

**`frontend/src/app/(portal)/portal/dashboard/page.tsx`**

Same pattern for portal widgets: active_programs, pending_decisions, recent_messages, account_status.

---

## Default Widget Configurations (per role)

### Internal (dashboard_key = "main")

**managing_director / relationship_manager:**
1. `stats_bar` (visible)
2. `rag_breakdown` (visible)
3. `activity_feed` (visible)
4. `alerts_panel` (visible)
5. `at_risk_programs` (visible)
6. `quick_actions` (visible)
7. `partner_sla_health` (visible for MD/FC only)

**coordinator:**
1. `stats_bar`
2. `rag_breakdown`
3. `activity_feed`
4. `alerts_panel`
5. `at_risk_programs`
6. `quick_actions`

**finance_compliance:**
1. `stats_bar`
2. `rag_breakdown`
3. `alerts_panel`
4. `partner_sla_health`
5. `at_risk_programs`

### Client Portal (dashboard_key = "portal")

**client:**
1. `account_status`
2. `active_programs`
3. `pending_decisions`
4. `recent_messages`

---

## DnD Implementation Details

Using `@dnd-kit/core` `DndContext` with `PointerSensor` + `KeyboardSensor`, and `@dnd-kit/sortable` `SortableContext` with `verticalListSortingStrategy`.

On drag end: call `arrayMove` to reorder, then call `updateDashboardConfig` mutation.

---

## Risks & Mitigations

1. **Optimistic UI**: Use TanStack Query `onMutate` for optimistic updates so UI feels instant even if API is slow.
2. **Type safety**: Widget config stored as JSON in DB — validate on read with Pydantic.
3. **Role-based defaults**: If a user has no saved config, compute defaults from the registry based on their role. Never store defaults; only store overrides.
4. **Migration chain**: `down_revision = "add_recent_items"` — this is the latest migration.
5. **Partner Scorecard widget**: The existing `partner-scorecard.tsx` requires a `partnerId` — skip this for the initial widget registry since it requires context. Include a placeholder or skip.

---

## Verification Criteria

- Backend: `ruff check . && mypy .` passes
- Frontend: `npm run lint && npm run typecheck` passes
- Users can toggle edit mode
- Widgets can be reordered via drag
- Widgets can be removed (hidden)
- Hidden widgets can be re-added via the customizer panel
- Config persists across page refreshes (stored in DB)
- "Reset to Default" restores the role-based default config
- Both internal and portal dashboards work
