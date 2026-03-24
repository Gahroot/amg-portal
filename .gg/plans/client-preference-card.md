# Client Preference Quick-View Card — Implementation Plan

## Overview
Implement a compact `ClientPreferenceCard` component that surfaces client communication preferences (timezone with live clock, preferred contact channels, contact hours with "bad time" highlight, language, and do-not-contact warning). The card is shown on the client detail page, inside the message compose area when a client is in context, and as a hover popover on the clients list.

---

## Existing State (what's already there)

| Layer | What exists |
|---|---|
| ORM Model | `client_profile.py` already has `preferred_channels`, `contact_hours_start`, `contact_hours_end`, `contact_timezone`, `language_preference`, `do_not_contact`, `opt_out_marketing` |
| Backend API | `/api/v1/clients/{clientId}/communication-preferences` — GET and PUT already work |
| Frontend types | `CommunicationPreferences` interface in `src/types/communication-audit.ts` |
| Frontend hook | `useClientCommunicationPreferences(clientId)` in `src/hooks/use-communication-audit.ts` |
| Preferences form | Full edit form at `src/components/communications/client-preferences-form.tsx` |
| Client detail page | `src/app/(dashboard)/clients/[id]/page.tsx` — has "Preferences" tab |

---

## What Needs to Change

### 1. Backend Schema — `backend/app/schemas/client_profile.py`

Add communication preference fields to `ClientProfileResponse` so they're included in the standard profile response (alongside the existing dedicated endpoint):

```python
# Add to ClientProfileResponse
preferred_channels: list[str] | None = None
contact_hours_start: str | None = None
contact_hours_end: str | None = None
contact_timezone: str | None = None
language_preference: str | None = None
do_not_contact: bool = False
opt_out_marketing: bool = False
```

---

### 2. New Component — `frontend/src/components/clients/client-preference-card.tsx`

**Props interface:**
```typescript
interface ClientPreferenceCardProps {
  clientId: string;
  compact?: boolean;          // true = inline pills, false = full card
  onEditClick?: () => void;   // called when Edit button clicked
  className?: string;
}
```

**Features:**
- Uses `useClientCommunicationPreferences(clientId)` hook (existing)
- Live clock in client's timezone — `useState` + `useEffect` with 1-minute interval using `Intl.DateTimeFormat`
- **Bad time detection**: parse `contact_hours_start` / `contact_hours_end` (HH:mm), get current hour+minute in client's timezone via `Intl.DateTimeFormat` parts, compare — amber warning banner if outside
- **Do Not Contact**: red alert banner at top when `do_not_contact === true`
- **Preferred channels** with icons: `Mail` (email), `Phone` (phone), `Globe` (portal), `MessageSquare` (sms)
- **Timezone row**: `Clock` icon + timezone name + live local time
- **Language row**: `Languages` icon + language code
- **Collapsible detail** (compact mode): Accordion shows channels + special instructions
- **Edit button**: calls `onEditClick` if provided, otherwise links to `/clients/${clientId}?tab=preferences`
- Loading skeleton using `Skeleton` component from `ui/skeleton`

**Component structure (full mode):**
```
<Card>
  <CardHeader>
    <CardTitle> Communication Preferences  <Button size="sm" onClick={onEditClick}>Edit</Button> </CardTitle>
  </CardHeader>
  <CardContent>
    {do_not_contact && <Alert variant="destructive">Do Not Contact</Alert>}
    {outsideHours && <Alert>Outside preferred contact hours — client timezone is HH:MM</Alert>}
    
    <div class="space-y-3">
      Row: Clock + timezone + "Current: HH:MM"
      Row: channels badges with icons
      Row: Languages + language code
      Row: Clock (contact hours) + "09:00 – 18:00 (client TZ)"
      {special_instructions && Row: Info + instructions}
    </div>
  </CardContent>
</Card>
```

**Compact mode** (for message compose sidebar):
```
<div class="rounded-lg border p-3 space-y-2">
  {do_not_contact && <Badge variant="destructive">⛔ Do Not Contact</Badge>}
  {outsideHours && <Badge variant="warning">⚠ Outside Hours</Badge>}
  Pills: Clock timezone • channels • language
  <Button variant="link" size="sm">Edit preferences →</Button>
</div>
```

---

### 3. Client Detail Page — `frontend/src/app/(dashboard)/clients/[id]/page.tsx`

**Changes:**
- Import `ClientPreferenceCard`
- In `OverviewTab`, add `ClientPreferenceCard` below the Profile Details card, passing `onEditClick` as a prop from parent
- Add `onEditClick` prop to `OverviewTab` component type
- In `ClientDetailPage`, pass `() => setActiveTab("preferences")` as `onEditClick` to `OverviewTab`

**Updated OverviewTab signature:**
```typescript
function OverviewTab({
  profile,
  clientId,
  onEditPreferences,
}: {
  profile: ...;
  clientId: string;
  onEditPreferences: () => void;
})
```

---

### 4. Message Compose — `frontend/src/components/communications/message-compose.tsx`

**Changes:**
- Add optional `clientId?: string` to `MessageComposeProps`
- When `clientId` is provided, render `<ClientPreferenceCard clientId={clientId} compact />` above the Tabs component
- The card shows do-not-contact warning and outside-hours alert inline with the compose area

**Updated props:**
```typescript
interface MessageComposeProps {
  onSendMessage: (body: string, attachmentIds?: string[]) => void;
  isSending?: boolean;
  onTypingChange?: (isTyping: boolean) => void;
  recipientUserIds?: string[];
  templateContext?: TemplateContext;
  clientId?: string; // NEW — enables preference card
}
```

---

### 5. Client List Hover — `frontend/src/app/(dashboard)/clients/page.tsx`

**Approach:** Wrap the client name `TableCell` in a `Popover` (Radix, lazy-mounted) so the preference data is only fetched when the popover opens.

Create a small helper component inside the file:
```typescript
function ClientPreferencePopoverCell({ clientId, name }: { clientId: string; name: string }) {
  // Uses Popover — the inner ClientPreferenceCard is only mounted when open
  // Trigger: the client name text
  // Content: <ClientPreferenceCard clientId={clientId} compact />
}
```

Replace the plain name `TableCell` with `ClientPreferencePopoverCell` for RM/MD/coordinator roles.

---

## Implementation Order

1. **`backend/app/schemas/client_profile.py`** — add communication pref fields to `ClientProfileResponse`
2. **`frontend/src/components/clients/client-preference-card.tsx`** — create new component
3. **`frontend/src/app/(dashboard)/clients/[id]/page.tsx`** — add card to OverviewTab
4. **`frontend/src/components/communications/message-compose.tsx`** — add `clientId` prop + card
5. **`frontend/src/app/(dashboard)/clients/page.tsx`** — add hover popover on client rows

---

## Key Logic: Timezone "Bad Time" Detection

```typescript
function isOutsideContactHours(
  timezone: string | null,
  hoursStart: string | null,
  hoursEnd: string | null,
): boolean {
  if (!timezone || !hoursStart || !hoursEnd) return false;
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === "hour")?.value ?? "0");
    const minute = parseInt(parts.find(p => p.type === "minute")?.value ?? "0");
    const currentMins = hour * 60 + minute;
    const [startH, startM] = hoursStart.split(":").map(Number);
    const [endH, endM] = hoursEnd.split(":").map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    return currentMins < startMins || currentMins > endMins;
  } catch {
    return false;
  }
}
```

---

## Key Logic: Live Clock

```typescript
const [clientTime, setClientTime] = useState<string>("");

useEffect(() => {
  const updateTime = () => {
    if (!preferences?.contact_timezone) return;
    try {
      setClientTime(
        new Intl.DateTimeFormat("en-US", {
          timeZone: preferences.contact_timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }).format(new Date())
      );
    } catch { /* invalid timezone */ }
  };
  updateTime();
  const interval = setInterval(updateTime, 60_000);
  return () => clearInterval(interval);
}, [preferences?.contact_timezone]);
```

---

## Channel Icon Map

```typescript
const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  phone: <Phone className="h-3.5 w-3.5" />,
  portal: <Globe className="h-3.5 w-3.5" />,
  sms: <MessageSquare className="h-3.5 w-3.5" />,
};
```

---

## Imports Needed

**New component** imports from existing UI:
- `Card, CardContent, CardHeader, CardTitle` from `@/components/ui/card`
- `Badge` from `@/components/ui/badge`
- `Alert, AlertDescription` from `@/components/ui/alert`
- `Button` from `@/components/ui/button`
- `Skeleton` from `@/components/ui/skeleton`
- `Tooltip*` from `@/components/ui/tooltip`
- lucide-react: `Clock, Mail, Phone, Globe, MessageSquare, Languages, Info, Ban, AlertTriangle, Pencil`
- `useClientCommunicationPreferences` from `@/hooks/use-communication-audit`

---

## Post-implementation checks

```bash
cd frontend && npm run lint && npm run typecheck
```

Fix all errors before done.

---

## Risk / Notes

- `Intl.DateTimeFormat` with invalid timezone strings will throw — wrap in try/catch
- The popover on the client list page fetches a new API call per hover; this is acceptable (React Query caches it)
- `MessageCompose` is currently used in `ConversationView` — the `clientId` prop is optional so all existing usages remain valid
- The `OverviewTab` component currently takes only `{ profile }` — extending it to `{ profile, clientId, onEditPreferences }` is a non-breaking change
