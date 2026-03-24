# Multi-Device Sync Implementation Plan

## Overview

Implement a multi-device sync system for syncing user preferences, read status, and UI state across devices in real-time. This system will leverage the existing WebSocket infrastructure and extend it for preference synchronization.

## Current State Analysis

### Existing Infrastructure
- **WebSocket**: Already implemented at `backend/app/api/websocket.py` with connection manager
- **Notification Preferences**: `backend/app/models/notification_preference.py` - stores user notification settings
- **Dashboard Config**: `backend/app/models/dashboard_config.py` - stores widget layouts
- **Offline Support**: `mobile/hooks/use-offline.ts` - provides offline queue pattern
- **Zustand Store**: `frontend/src/stores/navigation-store.ts` - client-side state management

### Gaps
- No unified user preferences model (theme, sidebar state, etc.)
- No read status tracking per entity (programs, documents, etc.)
- No device registration/tracking
- No real-time preference sync via WebSocket
- No conflict resolution mechanism

## Architecture

### Data Model

```
┌─────────────────────────────────────────────────────────────┐
│                    UserPreferences                           │
├─────────────────────────────────────────────────────────────┤
│ user_id (FK)                                                 │
│ ui_preferences: { theme, sidebar_collapsed, density, ... }  │
│ notification_preferences_id (FK → notification_preferences) │
│ dashboard_config_id (FK → dashboard_configs)                │
│ version: int (for conflict detection)                       │
│ updated_at: timestamp                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    ReadStatus                                │
├─────────────────────────────────────────────────────────────┤
│ id (PK)                                                      │
│ user_id (FK)                                                 │
│ entity_type: str (program, document, deliverable, etc.)     │
│ entity_id: UUID                                              │
│ is_read: bool                                                │
│ read_at: timestamp                                           │
│ device_id: str (which device marked it read)                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SyncQueue                                 │
├─────────────────────────────────────────────────────────────┤
│ id (PK)                                                      │
│ user_id (FK)                                                 │
│ device_id: str                                               │
│ entity_type: str                                             │
│ entity_id: UUID (nullable for preferences)                  │
│ action: str (mark_read, update_preference, etc.)            │
│ payload: JSONB                                               │
│ created_at: timestamp                                        │
│ synced_at: timestamp (nullable)                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    DeviceSession                             │
├─────────────────────────────────────────────────────────────┤
│ id (PK)                                                      │
│ user_id (FK)                                                 │
│ device_id: str                                               │
│ device_type: str (web, ios, android)                        │
│ device_name: str (optional)                                  │
│ last_seen_at: timestamp                                      │
│ is_active: bool                                              │
└─────────────────────────────────────────────────────────────┘
```

### Sync Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Device  │     │   API    │     │   WS     │
│    A     │     │  Server  │     │  Server  │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     │ 1. Update pref │                │
     │───────────────>│                │
     │                │                │
     │                │ 2. Store &     │
     │                │    increment   │
     │                │    version     │
     │                │                │
     │                │ 3. Broadcast   │
     │                │───────────────>│
     │                │                │
     │                │ 4. Push to     │
     │                │    other       │
     │                │    devices     │
     │                │<───────────────│
     │                │                │
     │ 5. Response    │                │
     │<───────────────│                │
     │                │                │
     │                │ 6. WS notify   │
     │<───────────────────────────────│
     │    (Device B)  │                │
```

### Conflict Resolution Strategy

1. **Last-Write-Wins (LWW)** for simple preferences (theme, sidebar state)
2. **Version-based optimistic locking** for complex objects (dashboard config)
3. **Merge strategy** for arrays/maps (notification preferences)
4. **Server-authoritative** for read status (server decides based on timestamp)

## Implementation Files

### Backend (New Files)

#### 1. `backend/app/models/user_preferences.py`
Unified user preferences model combining UI, notification, and dashboard preferences.

```python
class UserPreferences(Base, TimestampMixin):
    __tablename__ = "user_preferences"
    
    id: Mapped[uuid.UUID]
    user_id: Mapped[uuid.UUID]  # unique FK
    ui_preferences: Mapped[dict]  # {theme, sidebar_collapsed, density, etc.}
    version: Mapped[int]  # for optimistic locking
```

#### 2. `backend/app/models/read_status.py`
Track read/unread status for various entities.

```python
class ReadStatus(Base):
    __tablename__ = "read_statuses"
    
    id: Mapped[uuid.UUID]
    user_id: Mapped[uuid.UUID]
    entity_type: Mapped[str]  # program, document, deliverable, notification
    entity_id: Mapped[uuid.UUID]
    is_read: Mapped[bool]
    read_at: Mapped[datetime]
    device_id: Mapped[str]
```

#### 3. `backend/app/models/device_session.py`
Track active device sessions.

```python
class DeviceSession(Base, TimestampMixin):
    __tablename__ = "device_sessions"
    
    id: Mapped[uuid.UUID]
    user_id: Mapped[uuid.UUID]
    device_id: Mapped[str]
    device_type: Mapped[str]  # web, ios, android
    device_name: Mapped[str | None]
    last_seen_at: Mapped[datetime]
    is_active: Mapped[bool]
```

#### 4. `backend/app/models/sync_queue.py`
Queue for offline sync operations.

```python
class SyncQueue(Base, TimestampMixin):
    __tablename__ = "sync_queue"
    
    id: Mapped[uuid.UUID]
    user_id: Mapped[uuid.UUID]
    device_id: Mapped[str]
    entity_type: Mapped[str]
    entity_id: Mapped[uuid.UUID | None]
    action: Mapped[str]
    payload: Mapped[dict]
    synced_at: Mapped[datetime | None]
```

#### 5. `backend/app/schemas/user_preferences.py`
Pydantic schemas for preferences.

```python
class UIPreferences(BaseModel):
    theme: Literal["light", "dark", "system"] = "system"
    sidebar_collapsed: bool = False
    density: Literal["comfortable", "compact"] = "comfortable"
    # ... more UI preferences

class UserPreferencesResponse(BaseModel):
    ui_preferences: UIPreferences
    notification_preferences: NotificationPreferenceResponse
    dashboard_config: DashboardConfigResponse
    version: int

class UserPreferencesUpdate(BaseModel):
    ui_preferences: UIPreferences | None = None
    version: int  # for optimistic locking
```

#### 6. `backend/app/schemas/sync.py`
Schemas for sync operations.

```python
class SyncPushRequest(BaseModel):
    device_id: str
    changes: list[SyncChange]
    client_version: int

class SyncChange(BaseModel):
    entity_type: str
    entity_id: UUID | None
    action: str
    payload: dict
    client_timestamp: datetime

class SyncPullResponse(BaseModel):
    server_version: int
    preferences: UserPreferencesResponse
    read_statuses: list[ReadStatusResponse]
    pending_changes: list[SyncChange]
```

#### 7. `backend/app/api/v1/user/preferences.py`
REST endpoints for preferences.

```python
@router.get("/preferences", response_model=UserPreferencesResponse)
async def get_preferences()

@router.patch("/preferences", response_model=UserPreferencesResponse)
async def update_preferences(data: UserPreferencesUpdate)

@router.post("/preferences/sync", response_model=SyncPullResponse)
async def sync_preferences(data: SyncPushRequest)
```

#### 8. `backend/app/services/sync_service.py`
Core sync logic.

```python
class SyncService:
    async def push_changes(user_id, device_id, changes) -> SyncResult
    async def pull_changes(user_id, device_id, since_version) -> SyncPullResponse
    async def broadcast_preference_change(user_id, change) -> None
    async def resolve_conflict(server_version, client_version, changes) -> ResolvedState
```

### Backend (Modified Files)

#### 9. `backend/app/api/websocket.py`
Add preference sync message types.

```python
# Add new message handlers:
- handle_preference_sync: Handle incoming preference changes
- handle_read_status_sync: Handle read status changes
- handle_device_register: Register device session
```

#### 10. `backend/app/api/ws_connection.py`
Add broadcast methods for sync.

```python
# Add methods:
- broadcast_preference_update(user_id, preferences)
- broadcast_read_status(user_id, entity_type, entity_id, is_read)
```

### Frontend (New Files)

#### 11. `frontend/src/types/preferences.ts`
TypeScript types for preferences.

```typescript
export interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  sidebar_collapsed: boolean;
  density: 'comfortable' | 'compact';
  // ...
}

export interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  pendingChanges: number;
  conflictDetected: boolean;
}
```

#### 12. `frontend/src/stores/preferences-store.ts`
Zustand store for preferences with sync support.

```typescript
export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      preferences: defaultPreferences,
      syncState: { isSyncing: false, ... },
      
      updatePreference: async (key, value) => { ... },
      syncWithServer: async () => { ... },
      queueOfflineChange: (change) => { ... },
    }),
    { name: 'amg-preferences' }
  )
);
```

#### 13. `frontend/src/hooks/use-preferences-sync.ts`
Hook for managing preferences sync.

```typescript
export function usePreferencesSync() {
  return {
    preferences,
    syncState,
    updatePreference,
    syncNow,
    resolveConflict,
  };
}
```

#### 14. `frontend/src/hooks/use-read-status.ts`
Hook for managing read status.

```typescript
export function useReadStatus(entityType: string, entityId: string) {
  return {
    isRead,
    markAsRead,
    markAsUnread,
  };
}
```

### Mobile (New Files)

#### 15. `mobile/hooks/usePreferencesSync.ts`
React Native hook for preferences sync.

```typescript
export function usePreferencesSync() {
  // Similar to frontend but with AsyncStorage
  // and offline-first approach
}
```

#### 16. `mobile/hooks/useReadStatus.ts`
React Native hook for read status.

```typescript
export function useReadStatus() {
  // Uses dataCache for offline support
}
```

### Database Migration

#### 17. `backend/alembic/versions/add_multi_device_sync.py`

```python
def upgrade():
    # Create user_preferences table
    # Create read_statuses table
    # Create device_sessions table
    # Create sync_queue table
    # Add indexes for efficient queries
```

## Implementation Order

### Phase 1: Core Infrastructure (Backend)
1. Create database models (`user_preferences.py`, `read_status.py`, `device_session.py`, `sync_queue.py`)
2. Create Pydantic schemas (`user_preferences.py`, `sync.py`)
3. Create sync service (`sync_service.py`)
4. Create database migration

### Phase 2: API Endpoints
5. Create preferences API (`api/v1/user/preferences.py`)
6. Register router in main router
7. Update WebSocket handlers for sync messages

### Phase 3: Frontend Integration
8. Create TypeScript types (`types/preferences.ts`)
9. Create preferences store (`stores/preferences-store.ts`)
10. Create sync hook (`hooks/use-preferences-sync.ts`)
11. Create read status hook (`hooks/use-read-status.ts`)

### Phase 4: Mobile Integration
12. Create mobile sync hook (`mobile/hooks/usePreferencesSync.ts`)
13. Create mobile read status hook (`mobile/hooks/useReadStatus.ts`)

### Phase 5: Testing & Polish
14. Add unit tests for sync service
15. Add integration tests for API endpoints
16. Add E2E tests for cross-device sync

## Key Decisions

### 1. Real-time vs Polling
**Decision**: Hybrid approach
- Real-time via WebSocket for active devices
- Polling fallback when WebSocket disconnected
- Pull-to-sync on app focus/refresh

### 2. Offline Handling
**Decision**: Optimistic updates with queue
- Apply changes locally immediately
- Queue changes for sync when online
- Process queue on reconnection
- Handle conflicts gracefully

### 3. Conflict Resolution
**Decision**: Version-based with server authority
- Each preference object has a version number
- Client sends version with updates
- Server rejects stale updates (version mismatch)
- Client pulls latest and merges/retries

### 4. Storage Strategy
**Decision**: 
- Server: PostgreSQL with JSONB for flexible schema
- Web: Zustand with localStorage persistence
- Mobile: AsyncStorage with dataCache

## Acceptance Criteria

- [ ] Preferences sync across devices in real-time
- [ ] Read status syncs across devices
- [ ] Changes reflected within 2 seconds on active devices
- [ ] Conflicts handled gracefully with user notification
- [ ] Works offline with automatic sync when online
- [ ] Theme preference persists and syncs
- [ ] Sidebar state syncs
- [ ] Draft messages sync (future enhancement)
- [ ] Device management UI (future enhancement)

## Testing Strategy

### Unit Tests
- Sync service conflict resolution
- Version increment logic
- Queue processing

### Integration Tests
- API endpoints
- WebSocket message handling
- Database operations

### E2E Tests
- Multi-device sync simulation
- Offline/online transitions
- Conflict scenarios

## Future Enhancements

1. **Device Management UI**: View and manage connected devices
2. **Draft Sync**: Sync draft messages across devices
3. **Selective Sync**: Choose what to sync per device
4. **Sync History**: View sync activity log
5. **Encryption**: End-to-end encryption for sensitive preferences
