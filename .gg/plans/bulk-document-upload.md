# Bulk Document Upload with Drag-and-Drop and Auto-Categorization

## Summary

Implement a bulk upload flow that allows dragging multiple files into a zone, auto-categorizes them by filename patterns, shows per-file progress, supports retry on failure, and provides a post-upload summary panel with per-file editing. Integrates into the existing `DocumentList` component used on clients, programs, partners, and compliance pages.

---

## Architecture Decisions

- **Upload strategy:** Upload files individually to the existing `POST /api/v1/documents/` endpoint (one request per file) using axios `onUploadProgress`. This naturally gives per-file progress tracking and retry granularity.
- **Backend bulk endpoint:** Also add `POST /api/v1/documents/bulk` for API completeness, but the frontend uses individual uploads for progress control.
- **Auto-categorization:** Pure client-side via filename regex — no AI/ML needed; matches common document naming patterns.
- **Post-upload editing:** After all uploads complete, show an inline summary panel where the user can edit category/description per file before confirming.

---

## Files to Create

### `frontend/src/components/documents/upload-zone.tsx`
Multi-file drag-and-drop zone component:
```tsx
interface UploadZoneProps {
  onFilesSelect: (files: File[]) => void;
  isUploading?: boolean;
  accept?: string;
  maxSizeMB?: number;
  maxFiles?: number;
}
```
- Renders a dashed-border drop zone
- `multiple` input, drag events for multiple files
- Validates each file for allowed MIME types and size
- Filters invalid files and shows error list
- Shows file count badge when files are queued
- Allowed MIME types: match the backend `ALLOWED_MIME_TYPES`

### `frontend/src/components/documents/bulk-upload.tsx`
Main bulk upload dialog content:
```tsx
interface BulkUploadProps {
  entityType: string;
  entityId: string;
  onComplete?: (uploaded: DocumentItem[]) => void;
}
```

**States:**
- `idle` → user hasn't dropped files yet
- `queued` → files selected, not yet uploaded
- `uploading` → uploads in progress
- `done` → all uploads finished (some may have failed)
- `editing` → post-upload summary/edit mode

**FileUploadItem type:**
```ts
type FileUploadStatus = "pending" | "uploading" | "success" | "error";
interface FileUploadItem {
  id: string;           // local uuid
  file: File;
  status: FileUploadStatus;
  progress: number;     // 0–100
  category: DocumentCategory;
  description: string;
  result?: DocumentItem;
  error?: string;
}
```

**Auto-categorization function:**
```ts
function autoCategorize(filename: string): DocumentCategory {
  const lower = filename.toLowerCase();
  if (/contract|agreement|mou|nda|terms/.test(lower)) return "contract";
  if (/report|analysis|summary|overview/.test(lower)) return "report";
  if (/compliance|kyc|aml|regulatory|audit/.test(lower)) return "compliance";
  if (/financial|invoice|budget|statement|balance|tax/.test(lower)) return "financial";
  if (/legal|court|judgment|lawsuit|regulation/.test(lower)) return "legal";
  if (/letter|correspondence|email|memo|notice/.test(lower)) return "correspondence";
  return "general";
}
```

**Upload logic:**
- Upload files sequentially (one at a time) to avoid server overload
- Use `uploadDocumentWithProgress` from `lib/api/documents.ts`
- Update per-file progress via axios `onUploadProgress`
- Set status to `success` or `error` per file
- After all done, transition to `editing` state

**UI sections:**
1. **UploadZone** (idle/queued states): show drop zone
2. **File queue** (queued state): list files with auto-detected category, option to remove
3. **Global options** (queued state): "Apply category to all" select + "Auto-categorize" toggle
4. **Upload progress** (uploading state): per-file rows with `Progress` bar, status icon
5. **Post-upload summary** (editing/done states): editable table with category select + description input per file; retry button for failed files
6. **Action buttons**: Cancel / Start Upload / Done (confirm)

---

## Files to Modify

### `frontend/src/lib/api/documents.ts`
Add `uploadDocumentWithProgress`:
```ts
export async function uploadDocumentWithProgress(
  file: File,
  entityType: string,
  entityId: string,
  category: string,
  description: string | undefined,
  onProgress: (percent: number) => void,
): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("entity_type", entityType);
  formData.append("entity_id", entityId);
  formData.append("category", category);
  if (description) formData.append("description", description);

  const response = await api.post<DocumentItem>("/api/v1/documents/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
  return response.data;
}
```

Also add `bulkUploadDocuments` as a thin wrapper:
```ts
export async function bulkUploadDocuments(
  files: Array<{ file: File; category: string; description?: string }>,
  entityType: string,
  entityId: string,
  onFileProgress: (index: number, percent: number) => void,
): Promise<Array<{ index: number; result?: DocumentItem; error?: string }>>
```
— uploads sequentially, calls `onFileProgress(i, percent)` per file.

### `frontend/src/hooks/use-documents.ts`
No new hooks needed — `BulkUpload` manages its own async state to enable per-file progress (TanStack Query doesn't easily support per-item progress tracking). The hook file stays as-is.

### `frontend/src/components/documents/document-list.tsx`
Add a "Bulk Upload" button in the toolbar alongside the existing "Upload Document" button:
- Opens a `Dialog` with `BulkUpload` as the content
- `onComplete` callback calls `queryClient.invalidateQueries(["documents"])` to refresh the list

Import chain:
- `import { BulkUpload } from "@/components/documents/bulk-upload";`
- Add state: `const [bulkOpen, setBulkOpen] = React.useState(false);`
- Add a `<Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>` with `<Upload />` icon and "Bulk Upload" label
- Add `<Dialog open={bulkOpen} onOpenChange={setBulkOpen}>` containing `<BulkUpload entityType={entityType} entityId={entityId} onComplete={() => { queryClient.invalidateQueries(...); setBulkOpen(false); }} />`

### `backend/app/api/v1/documents.py`
Add bulk endpoint after the existing single upload endpoint:
```python
@router.post("/bulk", response_model=DocumentListResponse, status_code=201)
async def bulk_upload_documents(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    files: list[UploadFile] = File(...),
    entity_type: str = Form(...),
    entity_id: UUID = Form(...),
    category: str = Form("general"),
    description: str | None = Form(None),
) -> DocumentListResponse:
    """Upload multiple documents at once."""
    docs = await document_vault_service.bulk_upload_documents(
        db, files, entity_type, entity_id, category, description, current_user.id
    )
    return DocumentListResponse(
        documents=[build_document_response(d) for d in docs],
        total=len(docs),
    )
```
Place this BEFORE the `/{document_id}` routes to avoid routing conflicts.

### `backend/app/services/document_vault_service.py`
Add `bulk_upload_documents` function:
```python
async def bulk_upload_documents(
    db: AsyncSession,
    files: list[UploadFile],
    entity_type: str,
    entity_id: UUID,
    category: str,
    description: str | None,
    uploaded_by: UUID,
) -> list[Document]:
    """Validate and upload multiple files, returning all created Document records."""
    from sqlalchemy import func, select
    from app.models.document import Document
    from app.services.storage import storage_service
    
    docs: list[Document] = []
    for file in files:
        await storage_service.validate_file(file)
        file_name = file.filename or "untitled"
        
        existing = await db.execute(
            select(func.max(Document.version)).where(
                Document.entity_type == entity_type,
                Document.entity_id == entity_id,
                Document.file_name == file_name,
            )
        )
        next_version = (existing.scalar() or 0) + 1
        
        object_path, file_size = await storage_service.upload_file_scoped(
            file, entity_type, str(entity_id)
        )
        doc = Document(
            file_path=object_path,
            file_name=file_name,
            file_size=file_size,
            content_type=file.content_type,
            entity_type=entity_type,
            entity_id=entity_id,
            category=category,
            description=description,
            version=next_version,
            uploaded_by=uploaded_by,
        )
        db.add(doc)
        docs.append(doc)
    
    await db.commit()
    for doc in docs:
        await db.refresh(doc)
    return docs
```

---

## Implementation Order

1. **`backend/app/services/document_vault_service.py`** — add `bulk_upload_documents`
2. **`backend/app/api/v1/documents.py`** — add `POST /bulk` endpoint
3. **`frontend/src/lib/api/documents.ts`** — add `uploadDocumentWithProgress`
4. **`frontend/src/components/documents/upload-zone.tsx`** — create multi-file zone
5. **`frontend/src/components/documents/bulk-upload.tsx`** — create main component
6. **`frontend/src/components/documents/document-list.tsx`** — wire in Bulk Upload button

---

## Verification After Each Step

- Backend: `cd backend && ruff check . && mypy .`
- Frontend: `cd frontend && npm run lint && npm run typecheck`

---

## Risks

- **Axios timeout:** 30s default may be too short for large batches. Use per-file uploads so each stays under limit.
- **Backend validation:** `validate_file` reads the entire file into memory — safe for 50 MB limit, but for 20-file batches = potentially 1 GB. Acceptable given the 50MB per-file limit.
- **Routing conflict:** `/bulk` must be registered before `/{document_id}` to avoid FastAPI matching "bulk" as a UUID.

---

## Acceptance Criteria

- [ ] Can drag multiple files onto the zone
- [ ] Each file shows individual progress bar during upload
- [ ] Auto-categorization suggests a category based on filename
- [ ] Failed files show error with retry button
- [ ] Post-upload: can edit category and description per file
- [ ] Document list refreshes after bulk upload completes
- [ ] Backend passes `ruff check` and `mypy`
- [ ] Frontend passes `npm run lint` and `npm run typecheck`
