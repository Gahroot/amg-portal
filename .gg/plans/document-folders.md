# Document Categories/Folders — Implementation Plan

## Overview

Implement client-owned document folders that allow portal users to organize their received documents into personal folders (nested, drag-and-drop).

---

## Architecture Decisions

1. **Folder ownership** — folders belong to `ClientProfile` via `client_profile_id` (not raw user_id), matching the portal auth pattern: portal user → ClientProfile.
2. **Document↔Folder link** — add `folder_id` nullable FK column to `documents` table, so documents can be assigned to a folder. Documents with `folder_id=NULL` are "unorganized".
3. **Drag-and-drop** — implemented via HTML5 drag API (no external libraries needed) since the project avoids new deps.
4. **Default folders** — created at the API level on first call to `GET /portal/folders` if the profile has none.
5. **Migration head** — `add_escalation_templates` is the current head; new migration down_revision points to it.

---

## Files to Create / Modify

### Backend

#### New: `backend/app/models/client_folder.py`
SQLAlchemy model with:
- `id: UUID`
- `client_profile_id: UUID` → FK `client_profiles.id` ON DELETE CASCADE
- `name: String(255)`
- `parent_folder_id: UUID | None` → self-referential FK (nullable)
- `position: Integer` default 0 (for ordering)
- `created_at`, `updated_at` via `TimestampMixin`

#### Modify: `backend/app/models/__init__.py`
Add import for `ClientFolder`.

#### New: `backend/app/schemas/client_folder.py`
Pydantic schemas:
- `ClientFolderCreate` — name, parent_folder_id
- `ClientFolderUpdate` — name (optional), position (optional)
- `ClientFolderResponse` — all fields, children list (nested)
- `ClientFolderTree` — list of root folders with nested children

#### Modify: `backend/app/models/enums.py`
No changes needed (folders don't need enum types).

#### Modify: `backend/app/api/v1/client_portal.py`
Add endpoints (before the existing `router = APIRouter()` line where documents start):

**Folder endpoints (all under `/portal/folders`):**
- `GET /portal/folders` — list folders as tree, create defaults if none
- `POST /portal/folders` — create folder
- `PATCH /portal/folders/{folder_id}` — rename/reorder
- `DELETE /portal/folders/{folder_id}` — delete (documents become unorganized)
- `PATCH /portal/folders/{folder_id}/move` — move folder to new parent

**Document folder assignment:**
- `PATCH /portal/documents/{document_id}/folder` — assign document to folder (body: `{folder_id: uuid | null}`)

#### New: `backend/alembic/versions/add_client_folders.py`
Migration:
1. Create `client_folders` table
2. Add `folder_id` column to `documents` table (nullable FK)

---

### Frontend

#### New: `frontend/src/types/folder.ts`
TypeScript interfaces:
- `ClientFolder` — id, client_profile_id, name, parent_folder_id, position, created_at, updated_at
- `ClientFolderWithChildren` — extends ClientFolder with `children: ClientFolderWithChildren[]`
- `FolderTree` — root folders array
- `FolderCreate`, `FolderUpdate`, `FolderMovePayload`

#### New: `frontend/src/lib/api/folders.ts`
API client functions:
- `getFolderTree()` → GET `/api/v1/portal/folders`
- `createFolder(data)` → POST
- `updateFolder(id, data)` → PATCH
- `deleteFolder(id)` → DELETE
- `moveFolder(id, parentId)` → PATCH .../move
- `assignDocumentFolder(docId, folderId | null)` → PATCH portal/documents/{id}/folder

#### New: `frontend/src/hooks/use-portal-folders.ts`
TanStack Query hooks:
- `useFolderTree()` — query
- `useCreateFolder()` — mutation w/ toast
- `useUpdateFolder()` — mutation w/ toast
- `useDeleteFolder()` — mutation w/ toast
- `useMoveFolder()` — mutation
- `useAssignDocumentFolder()` — mutation

#### New: `frontend/src/components/portal/document-folder-tree.tsx`
React component:
- Renders nested folder tree in a sidebar
- Active folder highlighted
- Expand/collapse folders
- Rename inline (double-click)
- Delete button (with confirmation)
- "New folder" button
- Drag-and-drop: dragging a document over a folder highlights it; drop assigns document to folder
- Drag-and-drop: dragging a folder changes its parent

#### Modify: `frontend/src/app/(portal)/portal/documents/page.tsx`
- Layout change: two-column (left = folder tree sidebar, right = document list)
- Left column: `<DocumentFolderTree>` component
- Right column: existing document table, but filtered to selected folder
- "All Documents" virtual root option
- Show folder name in header
- When a folder is selected, filter documents to that folder
- Drag-and-drop from documents to folders

---

## Implementation Order

1. `backend/app/models/client_folder.py`
2. `backend/app/models/__init__.py` — add import
3. `backend/app/schemas/client_folder.py`
4. `backend/alembic/versions/add_client_folders.py`
5. `backend/app/api/v1/client_portal.py` — add folder endpoints + document folder assignment
6. `frontend/src/types/folder.ts`
7. `frontend/src/lib/api/folders.ts`
8. `frontend/src/hooks/use-portal-folders.ts`
9. `frontend/src/components/portal/document-folder-tree.tsx`
10. `frontend/src/app/(portal)/portal/documents/page.tsx`

---

## Default Folders

Created lazily on first `GET /portal/folders` if count == 0:
- "Financial Documents" (position 0)
- "Legal Documents" (position 1)
- "Travel Documents" (position 2)
- "Correspondence" (position 3)

---

## API Schema Details

### `GET /portal/folders` response
```json
[
  {
    "id": "uuid",
    "name": "Financial Documents",
    "parent_folder_id": null,
    "position": 0,
    "created_at": "...",
    "updated_at": "...",
    "children": []
  }
]
```

### `POST /portal/folders` body
```json
{"name": "My Folder", "parent_folder_id": null}
```

### `PATCH /portal/documents/{id}/folder` body
```json
{"folder_id": "uuid-or-null"}
```

---

## Drag-and-Drop Approach

Use React state for drag source tracking:
- `draggingDocId: string | null` — set onDragStart on table rows
- Each folder node has `onDragOver` and `onDrop` handlers
- On drop: call `useAssignDocumentFolder` mutation
- Visual: folder highlights with blue border on dragOver

No external DnD library — keep the project dependency-free.

---

## Verification

**Backend:**
```bash
cd backend && ruff check . && mypy .
```

**Frontend:**
```bash
cd frontend && npm run lint && npm run typecheck
```
