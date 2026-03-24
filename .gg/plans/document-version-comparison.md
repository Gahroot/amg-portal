# Document Version Comparison — Implementation Plan

## Overview

Add diff-based version comparison to the document system. Versions are already stored as separate `Document` rows sharing `entity_type + entity_id + file_name` with incrementing `version` numbers. We need a diff endpoint and a comparison UI.

---

## Backend

### 1. `backend/app/schemas/document.py` — Add new schemas

Append after existing `DocumentVersionListResponse`:

```python
from typing import Literal

class DiffLine(BaseModel):
    line_number_a: int | None = None   # line number in version A (None for added lines)
    line_number_b: int | None = None   # line number in version B (None for deleted lines)
    content: str
    change_type: Literal["added", "deleted", "context"]

class DocumentDiffHunk(BaseModel):
    a_start: int
    a_count: int
    b_start: int
    b_count: int
    lines: list[DiffLine]

class DocumentCompareResponse(BaseModel):
    version_a: DocumentVersionResponse
    version_b: DocumentVersionResponse
    is_text: bool
    diff_available: bool
    hunks: list[DocumentDiffHunk]
    total_additions: int
    total_deletions: int
    # For binary/PDF: metadata summary
    metadata: dict[str, object] | None = None
```

### 2. `backend/app/services/document_diff_service.py` — New service (create)

**Functions:**

```python
TEXT_TYPES = {"text/plain", "text/csv", "text/html", "application/json", "application/xml"}

def _is_text(content_type: str | None) -> bool: ...

def _fetch_content(file_path: str) -> bytes:
    """Download object bytes from MinIO using storage_service.client.get_object()"""
    response = storage_service.client.get_object(storage_service.bucket, file_path)
    return response.read()

def _compute_text_diff(content_a: bytes, content_b: bytes) -> tuple[list[DocumentDiffHunk], int, int]:
    """Decode to text, run difflib.SequenceMatcher, build hunks with line numbers.
    Returns (hunks, total_additions, total_deletions)"""
    lines_a = content_a.decode("utf-8", errors="replace").splitlines()
    lines_b = content_b.decode("utf-8", errors="replace").splitlines()
    # Use difflib.SequenceMatcher for opcodes
    # Build DocumentDiffHunk list from "replace", "insert", "delete", "equal" opcodes
    # Context lines: include 3 lines of context around changes (like unified diff)

async def compare_document_versions(
    db: AsyncSession,
    version_a_id: UUID,
    version_b_id: UUID,
) -> DocumentCompareResponse:
    """Main entry: fetch both docs, validate same file, compute diff."""
    # 1. Load both documents from DB
    # 2. Validate they share entity_type, entity_id, file_name
    # 3. If is_text: try to fetch content and compute diff (wrap in try/except)
    # 4. If binary: return metadata-only comparison
    # 5. Return DocumentCompareResponse
```

**Diff algorithm detail:**
- Use `difflib.SequenceMatcher(None, lines_a, lines_b).get_opcodes()`
- Opcodes: `"equal"`, `"replace"`, `"insert"`, `"delete"`
- Context: include up to 3 context lines before/after changed blocks
- Group into hunks (continuous blocks of changes + context)

### 3. `backend/app/api/v1/documents.py` — Add compare endpoint

Add **before** `/{document_id}` routes (to avoid path collision):

```python
@router.get("/compare", response_model=DocumentCompareResponse)
async def compare_document_versions(
    version_a_id: UUID,
    version_b_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> DocumentCompareResponse:
    """Compare two document versions and return their diff."""
    try:
        return await document_diff_service.compare_document_versions(db, version_a_id, version_b_id)
    except ValueError as e:
        raise BadRequestException(str(e)) from e
```

Also add imports: `from app.services import document_diff_service` and new schema imports.

---

## Frontend

### 4. `frontend/src/types/document.ts` — Add new types

```typescript
export type DiffChangeType = "added" | "deleted" | "context";

export interface DiffLine {
  line_number_a: number | null;
  line_number_b: number | null;
  content: string;
  change_type: DiffChangeType;
}

export interface DocumentDiffHunk {
  a_start: number;
  a_count: number;
  b_start: number;
  b_count: number;
  lines: DiffLine[];
}

export interface DocumentCompareResponse {
  version_a: DocumentVersionItem;
  version_b: DocumentVersionItem;
  is_text: boolean;
  diff_available: boolean;
  hunks: DocumentDiffHunk[];
  total_additions: number;
  total_deletions: number;
  metadata: Record<string, unknown> | null;
}
```

### 5. `frontend/src/lib/api/documents.ts` — Add compare function

```typescript
export async function compareDocumentVersions(
  versionAId: string,
  versionBId: string,
): Promise<DocumentCompareResponse> {
  const response = await api.get<DocumentCompareResponse>("/api/v1/documents/compare", {
    params: { version_a_id: versionAId, version_b_id: versionBId },
  });
  return response.data;
}
```

### 6. `frontend/src/hooks/use-documents.ts` — Add hook

```typescript
export function useDocumentCompare(
  versionAId: string | null,
  versionBId: string | null,
  enabled = false,
) {
  return useQuery({
    queryKey: ["document-compare", versionAId, versionBId],
    queryFn: () => compareDocumentVersions(versionAId!, versionBId!),
    enabled: !!versionAId && !!versionBId && enabled,
  });
}
```

### 7. `frontend/src/components/documents/version-history.tsx` — New component

**Props:** `{ documentId: string; fileName: string }`

**Features:**
- Calls `useDocumentVersions(documentId, true)`
- Table with columns: Version, Date, Size, Actions (Download + checkbox for compare)
- Max 2 checkboxes selectable at once; selecting a 3rd replaces the oldest selection
- "Compare versions" button (disabled unless exactly 2 checked) — opens `VersionCompare` dialog
- Download button per row that calls `getDocumentDownloadUrl` → `window.open`

**UI structure:**
```
[Version History: filename.pdf]
┌──────┬────────────┬────────┬──────────────────────┐
│ #    │ Date       │ Size   │ Actions               │
├──────┼────────────┼────────┼──────────────────────┤
│ v3   │ Mar 23 '26 │ 1.2 MB │ [⬇] [☑ Select]       │
│ v2   │ Mar 20 '26 │ 1.1 MB │ [⬇] [☑ Select]       │
│ v1   │ Mar 15 '26 │ 1.0 MB │ [⬇] [☐ Select]       │
└──────┴────────────┴────────┴──────────────────────┘
[Compare Selected (2)] ← button at bottom
```

### 8. `frontend/src/components/documents/version-compare.tsx` — New component

**Props:**
```typescript
interface VersionCompareProps {
  versionAId: string;
  versionBId: string;
  open: boolean;
  onClose: () => void;
}
```

**Features:**
- Dialog (full-screen on mobile, large on desktop)
- Calls `useDocumentCompare(versionAId, versionBId, open)`
- Loading skeleton while fetching
- Summary bar: `+X additions  -Y deletions` (colored badges)
- **For text diffs** (`is_text && diff_available`):
  - Toggle: "Inline" / "Side-by-side" tab
  - **Inline view**: unified diff table  
    - Line number columns (A, B), change indicator (+/-/ ), content
    - `bg-green-950/40 text-green-300` for additions
    - `bg-red-950/40 text-red-300` for deletions
    - `bg-muted/20` for context
    - Hunk headers in `bg-muted text-muted-foreground font-mono text-xs`
  - **Side-by-side view**: two columns, A on left, B on right
    - Left shows deleted/context, right shows added/context
    - Synchronized scrolling
- **For binary/PDF** (`!is_text || !diff_available`):
  - Metadata comparison table (version, date, size, uploader)
  - "Download Version A" / "Download Version B" buttons
  - Note: "Content diff not available for this file type"
- Download buttons for both versions in dialog footer

### 9. `frontend/src/components/documents/document-list.tsx` — Update

Replace the inline `VersionHistory` component with the new standalone one:
- Import `VersionHistory` from `./version-history`
- Replace existing `<VersionHistory docId={doc.id} enabled={isVersionOpen} />` with `<VersionHistory documentId={doc.id} fileName={doc.file_name} />`
- Remove the old inline `VersionHistory` function definition (lines 65–116)

---

## Implementation Order

1. `backend/app/schemas/document.py` — add schemas  
2. `backend/app/services/document_diff_service.py` — new service  
3. `backend/app/api/v1/documents.py` — add compare endpoint  
4. `frontend/src/types/document.ts` — add types  
5. `frontend/src/lib/api/documents.ts` — add API function  
6. `frontend/src/hooks/use-documents.ts` — add hook  
7. `frontend/src/components/documents/version-history.tsx` — new component  
8. `frontend/src/components/documents/version-compare.tsx` — new component  
9. `frontend/src/components/documents/document-list.tsx` — update to use new components  

---

## Risks & Notes

- **MinIO content fetch in sync context**: `storage_service.client.get_object()` is synchronous MinIO SDK call. Wrap in `asyncio.to_thread()` to avoid blocking the event loop in async FastAPI handler.
- **Large files**: Cap text diff at 500KB per file. If file exceeds cap, return `diff_available: false` with a `metadata`-only response.
- **Encoding**: Use `errors="replace"` when decoding bytes to avoid crashes on binary/corrupt text.
- **Same-file validation**: Verify `version_a.entity_type == version_b.entity_type`, `version_a.entity_id == version_b.entity_id`, `version_a.file_name == version_b.file_name` — if not, raise `ValueError`.
- **Path ordering in FastAPI**: The `/compare` route must be registered before `/{document_id}` routes to avoid being captured by the path param.

---

## Verification

- `cd backend && ruff check . && mypy .` — no errors
- `cd frontend && npm run lint && npm run typecheck` — no errors
