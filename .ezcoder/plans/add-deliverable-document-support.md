# Add Deliverable — Document Support

## Problem

The "Add Deliverable" dialog in `frontend/src/app/(dashboard)/assignments/[id]/page.tsx` only lets staff create a deliverable with metadata (title, type, description, due date). There is no way to:
1. **Select a previously uploaded/imported document** from the document library
2. **Upload a new document** inline

## Root Cause

- The `createDeliverable` backend endpoint (`POST /api/v1/deliverables/`) only accepts metadata — no file.
- The `submit_deliverable` endpoint (`POST /api/v1/deliverables/{id}/submit`) is **partner-only** (`CurrentPartner` dep) — internal staff cannot use it.
- No endpoint exists for internal staff to attach a file or existing document to a deliverable.

## Solution Overview

1. **Backend**: Add two new endpoints on the deliverables router for internal staff:
   - `POST /{id}/upload` — multipart file upload directly to a deliverable
   - `POST /{id}/attach-document` — link an existing `document_id` from the documents table

2. **Frontend API client**: Expose the two new endpoints in `deliverables.ts`

3. **Frontend UI**: Expand the Add Deliverable dialog to include a collapsible "Attach Document" section with two modes:
   - **Upload new file** — drag-and-drop using the existing `FileUploadZone` component
   - **Select from library** — searchable list of all documents (calls `listDocuments()`)

## Detailed Analysis

### Backend — `backend/app/api/v1/deliverables.py`

Add after the existing `update_deliverable` handler:

**`POST /{deliverable_id}/upload`**
- Auth: `require_coordinator_or_above` (internal staff only)
- Accepts: `UploadFile` (multipart)
- Logic: fetch deliverable → validate file → upload to storage → set `file_path`, `file_name`, `file_size`, `submitted_at`, `submitted_by`, `status = "submitted"`
- Returns: `DeliverableResponse`

**`POST /{deliverable_id}/attach-document`**
- Auth: `require_coordinator_or_above`
- Body: `{ "document_id": "<uuid>" }` — Pydantic schema `DeliverableAttachDocument`
- Logic: fetch deliverable → fetch document by document_id → copy `file_path`, `file_name`, `file_size` from document to deliverable → set `submitted_at`, `submitted_by`, `status = "submitted"`
- Returns: `DeliverableResponse`

Add `DeliverableAttachDocument` Pydantic schema to `backend/app/schemas/deliverable.py`:
```python
class DeliverableAttachDocument(BaseModel):
    document_id: UUID
```

### Frontend API — `frontend/src/lib/api/deliverables.ts`

Add two new exported functions:

```ts
export async function uploadDeliverableFile(id: string, file: File): Promise<DeliverableItem>
export async function attachDocumentToDeliverable(id: string, documentId: string): Promise<DeliverableItem>
```

Also add these types to `frontend/src/types/deliverable.ts` if needed (none needed — we reuse `DeliverableItem`).

### Frontend UI — `frontend/src/app/(dashboard)/assignments/[id]/page.tsx`

**State additions:**
```ts
const [docMode, setDocMode] = React.useState<"none" | "upload" | "library">("none");
const [uploadFile, setUploadFile] = React.useState<File | null>(null);
const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null);
const [docSearch, setDocSearch] = React.useState("");
```

**New query** (only fetches when dialog is open and mode is "library"):
```ts
const { data: allDocs } = useQuery({
  queryKey: ["documents", "all"],
  queryFn: () => listDocuments({ limit: 200 }),
  enabled: deliverableOpen && docMode === "library",
});
```

**Mutation update**: After `createDeliverableMutation` succeeds, if `docMode === "upload"` and `uploadFile` is set → call `uploadDeliverableFile(newDeliverable.id, uploadFile)`. If `docMode === "library"` and `selectedDocId` → call `attachDocumentToDeliverable(newDeliverable.id, selectedDocId)`. Then invalidate and close.

Switch the `createDeliverableMutation.onSuccess` to use a two-step pattern: create first, then attach.

**Dialog UI additions** inside the `<div className="space-y-3">`:

After the existing Due Date field, add:
- A `<Label>` "Document (optional)"
- Three `<Button variant="outline">` or radio-style toggles: None / Upload New / From Library
- When "Upload New": render `<FileUploadZone onFileSelect={setUploadFile} />`
- When "From Library": render a `<Input placeholder="Search documents..." />` + scrollable list of `allDocs.documents` filtered by `docSearch`, each row is clickable with a checkmark when selected

**Import additions**: `FileUploadZone`, `listDocuments` from their respective modules.

**Reset on close**: clear `docMode`, `uploadFile`, `selectedDocId`, `docSearch` when dialog closes.

## Risks

- The `submit` endpoint requires `CurrentPartner`; the new `upload` endpoint bypasses that intentionally for staff use — this is the correct design (staff can pre-load files on behalf of partners or for internal deliverables).
- The `attach-document` endpoint copies file metadata — the file itself stays in storage at the same path. This is intentional (no duplication of storage objects).
- `listDocuments({ limit: 200 })` is a broad query — filtered client-side by search. Acceptable for now given typical document counts.

## Steps

1. Add `DeliverableAttachDocument` Pydantic schema to `backend/app/schemas/deliverable.py`
2. Add `POST /{deliverable_id}/upload` endpoint to `backend/app/api/v1/deliverables.py` (internal staff file upload)
3. Add `POST /{deliverable_id}/attach-document` endpoint to `backend/app/api/v1/deliverables.py` (link existing document by ID)
4. Add `uploadDeliverableFile` and `attachDocumentToDeliverable` functions to `frontend/src/lib/api/deliverables.ts`
5. Expand the Add Deliverable dialog in `frontend/src/app/(dashboard)/assignments/[id]/page.tsx` to support upload-new and select-from-library modes with a two-step create-then-attach mutation flow
6. Run backend linting (`ruff check . && mypy .`) and frontend checks (`npm run lint && npm run typecheck`) and fix any errors
