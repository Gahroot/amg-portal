# Saved Filter Presets Implementation Plan

## Overview
Add ability for users to save, load, and manage filter presets across all list views (programs, clients, partners, communication logs). The tasks page uses a board/kanban and doesn't have traditional list filters, so it will be skipped. Communication logs page doesn't exist as a standalone route, so integration there is also skipped.

## Backend Changes

### 1. Model: `backend/app/models/saved_filter.py` (NEW)
```python
# Fields: id (UUID PK), user_id (FK users.id CASCADE), name (String 100), 
# entity_type (String 30) — "programs"|"clients"|"partners"|"communication_logs",
# filter_config (JSON), is_default (Boolean default False)
# Inherits Base, TimestampMixin
# Unique constraint on (user_id, name, entity_type)
# Index on (user_id, entity_type)
```
Follow pattern from `bookmark.py`.

### 2. Register model: `backend/app/models/__init__.py`
Add `from app.models.saved_filter import SavedFilter  # noqa: F401`

### 3. Schema: `backend/app/schemas/saved_filter.py` (NEW)
- `SavedFilterEntityType(StrEnum)` — programs, clients, partners, communication_logs
- `SavedFilterCreate(BaseModel)` — name, entity_type, filter_config (dict[str, Any]), is_default (bool = False)
- `SavedFilterUpdate(BaseModel)` — name (optional), filter_config (optional), is_default (optional)
- `SavedFilterResponse(BaseModel)` — id, user_id, name, entity_type, filter_config, is_default, created_at, updated_at; model_config from_attributes=True
- `SavedFilterListResponse(BaseModel)` — items: list[SavedFilterResponse], total: int

### 4. API endpoints: `backend/app/api/v1/saved_filters.py` (NEW)
Create a dedicated router file (not in auth.py or users.py to keep things clean). Mount under `/saved-filters` in router.py.

Endpoints (all require CurrentUser auth):
- `GET /` — list saved filters, optional `entity_type` query param. Returns user's filters ordered by name.
- `POST /` — create saved filter. If `is_default=True`, unset any existing default for same entity_type.
- `PUT /{filter_id}` — update saved filter (must be owned by user). If `is_default=True`, unset others.
- `DELETE /{filter_id}` — delete saved filter (must be owned by user).

### 5. Register router: `backend/app/api/v1/router.py`
Add import and `router.include_router(saved_filters_router, prefix="/saved-filters", tags=["saved-filters"])`

### 6. Migration: `backend/alembic/versions/add_saved_filters.py` (NEW)
Create `saved_filters` table. Use `down_revision = "add_bookmarks"` (following the bookmark chain).

## Frontend Changes

### 7. API client: `frontend/src/lib/api/saved-filters.ts` (NEW)
Follow pattern from `bookmarks.ts`:
- `getSavedFilters(entityType?: string)` — GET `/api/v1/saved-filters?entity_type=...`
- `createSavedFilter(data)` — POST `/api/v1/saved-filters`
- `updateSavedFilter(id, data)` — PUT `/api/v1/saved-filters/{id}`
- `deleteSavedFilter(id)` — DELETE `/api/v1/saved-filters/{id}`

### 8. Hook: `frontend/src/hooks/use-saved-filters.ts` (NEW)
Follow pattern from `use-tasks.ts` / `use-bookmarks.ts`:
- `useSavedFilters(entityType: string)` — useQuery with key `["saved-filters", entityType]`
- `useCreateSavedFilter()` — useMutation, invalidates `["saved-filters"]`
- `useUpdateSavedFilter()` — useMutation, invalidates `["saved-filters"]`
- `useDeleteSavedFilter()` — useMutation, invalidates `["saved-filters"]`

### 9. Save Filter Dialog: `frontend/src/components/ui/save-filter-dialog.tsx` (NEW)
A Dialog component with:
- Text input for filter name
- Checkbox for "Set as default"
- Save/Cancel buttons
- Props: `open`, `onOpenChange`, `onSave(name, isDefault)`, `isLoading`, `initialName?`, `initialIsDefault?`

### 10. Saved Filters Dropdown: `frontend/src/components/ui/saved-filters-dropdown.tsx` (NEW)
A dropdown button component:
- Props: `entityType`, `currentFilters` (Record<string,string>), `onApplyFilter(filterConfig)`, `onFiltersChanged?`
- Shows a button with filter icon + active preset name if any
- Dropdown items: list of saved presets (with star icon for default)
- "Save current filters" option opens SaveFilterDialog
- Each preset has edit/delete actions in a submenu
- Active preset is highlighted
- Uses the `use-saved-filters` hook internally

### 11. Integrate into list pages

**`frontend/src/app/(dashboard)/programs/page.tsx`** (line ~183, in the filter row):
- Import `SavedFiltersDropdown`
- Add to the flex filter bar, after existing filters and before Reset button
- `entityType="programs"`, pass `currentFilters={{ status: statusParam, search: searchInput }}`
- `onApplyFilter` sets URL params from the filter config

**`frontend/src/app/(dashboard)/clients/page.tsx`** (line ~186, filter row):
- Same pattern with `entityType="clients"`
- `currentFilters={{ compliance_status: complianceStatus, approval_status: approvalStatus, search: searchInput }}`

**`frontend/src/app/(dashboard)/partners/page.tsx`** (line ~296, filter row):
- Same pattern with `entityType="partners"`
- `currentFilters={{ status: statusParam, availability: availabilityParam, search: searchInput }}`

**Tasks page**: Skipped — it's a Kanban board (`TaskBoard` component) without traditional list filters, and the component doesn't even exist yet.

**Communication logs**: Skipped — `CommunicationLogList` is a standalone component not mounted in any route currently.

## Implementation Order (dependency-ordered)

1. Backend model (`saved_filter.py`) + register in `__init__.py`
2. Backend schema (`saved_filter.py`)
3. Backend API (`saved_filters.py`) + register in `router.py`
4. Backend migration (`add_saved_filters.py`)
5. Frontend API client (`saved-filters.ts`)
6. Frontend hook (`use-saved-filters.ts`)
7. Frontend `SaveFilterDialog` component
8. Frontend `SavedFiltersDropdown` component
9. Integrate into Programs page
10. Integrate into Clients page
11. Integrate into Partners page
12. Run linters/typechecks on both backend and frontend

## Risks & Notes
- Migration chain: using `add_bookmarks` as down_revision. Verify no conflicts.
- The `filter_config` JSON blob is entity-type-specific. The frontend controls what gets saved; backend is agnostic.
- When setting `is_default=True`, must unset other defaults for same (user_id, entity_type) atomically.
- Default filter should auto-apply on page load if no URL params are set.

## Verification
- `cd backend && ruff check . && mypy .`
- `cd frontend && npm run lint && npm run typecheck`
- Manual test: create, list, apply, update, delete saved filters via API
