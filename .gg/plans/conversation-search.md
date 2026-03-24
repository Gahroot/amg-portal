# Conversation Search Implementation Plan

## Overview
Add full-text search across conversation messages with date/participant/program filters. 
Results include highlighted matches and allow navigation to the originating conversation.

---

## Architecture

### API endpoint
`GET /api/v1/conversations/search` (added to the existing conversations router)

Query params:
- `q` – keyword (required, min 1 char)
- `date_from` / `date_to` – ISO date strings (optional)
- `participant_id` – UUID (optional)
- `program_id` – UUID (optional)
- `skip` / `limit` – pagination

Returns: `ConversationSearchResponse` containing a list of `MessageSearchResult` objects.

---

## Files to Create / Modify

### 1. `backend/app/schemas/conversation.py` — add search schemas
Add at the bottom:
```python
class MessageSearchResult(BaseModel):
    message_id: UUID
    conversation_id: UUID
    conversation_title: str | None
    conversation_type: str
    sender_id: UUID | None
    sender_name: str | None
    body: str          # full body (frontend handles highlighting)
    body_snippet: str  # ~200-char excerpt around match
    program_id: UUID | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=False)

class ConversationSearchResponse(BaseModel):
    query: str
    results: list[MessageSearchResult]
    total: int
```

### 2. `backend/app/services/conversation_search_service.py` — NEW
```python
"""Service for searching conversation messages."""
class ConversationSearchService:
    async def search_messages(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        q: str,
        date_from: date | None,
        date_to: date | None,
        participant_id: uuid.UUID | None,
        program_id: uuid.UUID | None,
        skip: int,
        limit: int,
    ) -> tuple[list[dict], int]:
```

Implementation:
- Join `Communication` + `Conversation` 
- Scope: `Conversation.participant_ids.contains([user_id])` (only conversations user is in)
- Filter: `func.lower(Communication.body).contains(q.lower())` (ILIKE pattern)
- Optional filters: date range on `Communication.created_at`, `Communication.program_id`, participant via sub-query
- For each hit: extract ~200-char snippet around the keyword position using Python string slicing
- Return list of dicts matching `MessageSearchResult` schema, plus total count

### 3. `backend/app/api/v1/conversations.py` — add search endpoint
Add before the `/{conversation_id}` route (to avoid route conflict):
```python
@router.get("/search", response_model=ConversationSearchResponse)
async def search_conversations(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    q: str = Query(..., min_length=1, max_length=200),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    participant_id: uuid.UUID | None = Query(None),
    program_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
```

Import `ConversationSearchResponse` from schemas and `conversation_search_service` from services.

### 4. `frontend/src/types/communication.ts` — add search types
```typescript
export interface MessageSearchResult {
  message_id: string;
  conversation_id: string;
  conversation_title?: string;
  conversation_type: ConversationType;
  sender_id?: string;
  sender_name?: string;
  body: string;
  body_snippet: string;
  program_id?: string;
  created_at: string;
}

export interface ConversationSearchResponse {
  query: string;
  results: MessageSearchResult[];
  total: number;
}

export interface ConversationSearchParams {
  q: string;
  date_from?: string;
  date_to?: string;
  participant_id?: string;
  program_id?: string;
  skip?: number;
  limit?: number;
}
```

### 5. `frontend/src/lib/api/conversations.ts` — add `searchConversations` function
```typescript
export async function searchConversations(
  params: ConversationSearchParams
): Promise<ConversationSearchResponse> {
  const response = await api.get<ConversationSearchResponse>(
    "/api/v1/conversations/search",
    { params }
  );
  return response.data;
}
```

### 6. `frontend/src/hooks/use-conversations.ts` — add `useConversationSearch` hook
```typescript
export function useConversationSearch(params: ConversationSearchParams | null) {
  return useQuery({
    queryKey: ["conversation-search", params],
    queryFn: () => searchConversations(params!),
    enabled: !!params && params.q.trim().length > 0,
    staleTime: 30_000,
  });
}
```

### 7. `frontend/src/components/portal/conversation-search.tsx` — NEW component
Full component with:
- Search input (debounced 300ms with `useEffect` + `useState`)
- Collapsible filter panel: date range pickers (HTML `<input type="date">` wrapped in shadcn Label), program filter
- Results list: each result shows conversation title, sender, date, and `body_snippet` with the query term **bolded** (simple `split` / `dangerouslySetInnerHTML`-free approach using array split + `<mark>`)
- Empty state, loading skeleton, error state
- `onSelectConversation(conversationId: string)` callback prop
- `onClose()` callback prop

Highlight helper:
```tsx
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}
```

### 8. `frontend/src/app/(portal)/portal/messages/page.tsx` — integrate search
- Add a "Search" toggle button next to the page title
- Track `isSearchOpen: boolean` state
- When search is open: render `<ConversationSearch>` in place of or alongside the conversation list
- `onSelectConversation` sets `selectedConversationId` and closes search panel

---

## Implementation Order

1. Backend schemas (step 1)
2. Backend service (step 2)
3. Backend API endpoint (step 3)  — run `ruff check . && mypy .`
4. Frontend types (step 4)
5. Frontend API function (step 5)
6. Frontend hook (step 6)
7. Frontend search component (step 7)
8. Messages page integration (step 8) — run `npm run lint && npm run typecheck`

---

## Route Order Note
`/search` must be registered **before** `/{conversation_id}` in the FastAPI router, otherwise FastAPI will try to parse "search" as a UUID and return 422. In the existing `conversations.py`, all specific routes (`POST /`, `GET /`, `GET /search`) should appear before `GET /{conversation_id}`.

---

## Risk Notes
- ILIKE with `%term%` on large `body` text column won't use a B-tree index. Acceptable for this portal's scale. A GIN `tsvector` index can be added later via migration.
- Snippet extraction uses Python string search (case-insensitive), finds first occurrence and takes ±100 chars around it.
- No new dependencies required.
