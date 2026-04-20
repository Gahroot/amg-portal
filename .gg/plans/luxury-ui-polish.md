# Luxury UI Polish — Quick Wins

## The Problem

Looking at the screenshot and the code, the UI reads as "warm beige SaaS template" rather than "UHNW concierge platform." The issues are:

1. **Flat, muddy color layering** — background `#e8e4dc`, cards `#f0ece4`, inputs `bg-transparent` on a card that's already cream-on-cream. Everything blends into one sandy block. No visual hierarchy.
2. **No depth or shadow system** — Cards use `shadow-sm` (barely visible on cream). Inputs have `shadow-xs`. There's no layered elevation to guide the eye.
3. **Inputs feel cheap** — Transparent backgrounds with thin `rgba(139,125,94,0.25)` borders on a cream card. They look like they're part of the background, not interactive fields.
4. **Tabs look like disabled buttons** — The `bg-muted` pill tab list sits flat. Active state is barely distinguishable from inactive.
5. **No whitespace breathing room** — Cards are `py-6 px-6`, content is tight. Luxury = generous whitespace.
6. **Button is just a brown pill** — No weight, no presence. The primary CTA ("Next") doesn't command attention.

## Proposed Changes (7 Component Files + 1 CSS File)

All changes are in reusable primitives — every page benefits automatically.

---

### 1. Color Palette Refinement (`globals.css` — `:root` variables)

**What changes:**
- **Background**: Lighten from `#e8e4dc` → `#f5f3ef` (soft warm white, not sandy)
- **Card**: Brighten to `#ffffff` with a hint of warmth via a very subtle warm shadow rather than a tinted background
- **Muted**: Lighten `#d9d4ca` → `#eae7e1` so it's a tint, not a competing tone
- **Secondary**: Lighten `#ddd8ce` → `#f0ede8`
- **Border**: Shift from `rgba(139,125,94,0.2)` → `rgba(139,125,94,0.12)` — more refined, less "form outline"
- **Input border**: Soften from `0.25` → `0.18` opacity, rely on background fill for definition instead

**Why:** Right now background/card/muted/secondary are 4 shades of the same oatmeal. Pushing the background lighter and cards to near-white creates actual **layers** — the eye understands what's a surface and what's a container.

---

### 2. Card Component (`components/ui/card.tsx`)

**Current:** `rounded-xl border bg-card py-6 shadow-sm`

**Proposed:**
```
rounded-xl border border-border/60 bg-card py-6 text-card-foreground
shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]
```

- Replace `shadow-sm` with a custom two-layer shadow (subtle outer glow + tight contact shadow). This is the single biggest luxury signal — Apple, Stripe, and every premium UI uses multi-layer shadows.
- Soften border to `border-border/60` so it doesn't compete with the shadow.

**Files touched:** `frontend/src/components/ui/card.tsx` (line 10-11)

---

### 3. Input & Textarea (`components/ui/input.tsx`, `components/ui/textarea.tsx`)

**Current:** `bg-transparent border-input shadow-xs`

**Proposed:**
```
bg-background/60 border-input/80 shadow-none
focus-visible:bg-background focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50
```

- Give inputs a **subtle fill** (`bg-background/60`) so they read as recessed fields, not invisible boxes
- Drop `shadow-xs` (adds noise on cream), rely on the fill + border contrast
- On focus, go to full `bg-background` for a "lit up" feel

**Files touched:** `frontend/src/components/ui/input.tsx` (line 11), `frontend/src/components/ui/textarea.tsx` (line 10)

---

### 4. Select Trigger (`components/ui/select.tsx`)

**Current:** `bg-transparent border-input shadow-xs`

**Proposed:** Same treatment as Input — add `bg-background/60`, drop `shadow-xs`, consistent with text inputs.

**Files touched:** `frontend/src/components/ui/select.tsx` (line 40)

---

### 5. Button Primary Variant (`components/ui/button.tsx`)

**Current:** `bg-primary text-primary-foreground hover:bg-primary/90`

**Proposed:**
```
bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.1),0_1px_1px_rgba(0,0,0,0.06)]
hover:bg-primary/90 hover:shadow-[0_2px_4px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]
active:shadow-none active:translate-y-px
```

- Multi-layer shadow gives the button physical weight
- Hover lifts it slightly (shadow grows)
- Active press pushes it down (`translate-y-px` + shadow collapse)
- This is the standard premium button pattern

Also add a `cursor-pointer` to the base styles (currently missing).

**Files touched:** `frontend/src/components/ui/button.tsx` (lines 8, 12)

---

### 6. Tabs List (`components/ui/tabs.tsx`)

**Current:** `bg-muted` pill with barely-distinguished triggers

**Proposed for TabsList:**
```
bg-muted/50 border border-border/40
```

**Proposed for TabsTrigger active state:**
```
data-[state=active]:bg-card data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.06)]
```

- Lighter muted bg so the active tab (now white/card) pops
- Subtle shadow on the active pill = instant depth hierarchy

**Files touched:** `frontend/src/components/ui/tabs.tsx` (lines 29-33, 67-69)

---

### 7. Table Rows (`components/ui/table.tsx`)

**Current:** `hover:bg-muted/50` — on cream, the hover is invisible.

**Proposed:**
- `TableRow`: `hover:bg-muted/40` (won't change much until muted is lighter from Step 1, but then it'll be a proper subtle highlight)
- `TableHead`: Add `text-muted-foreground text-xs uppercase tracking-wider` — standard luxury table header pattern (small caps, spaced)

**Files touched:** `frontend/src/components/ui/table.tsx` (lines 60, 73)

---

### 8. Skeleton pulse color (`components/ui/skeleton.tsx`)

**Current:** `bg-accent` — which is `#c4a060` (gold). Skeletons pulse gold, which is jarring.

**Proposed:** `bg-muted` — neutral shimmer that doesn't look like a gold loading bar.

**Files touched:** `frontend/src/components/ui/skeleton.tsx` (line 7)

---

## Summary of Files Changed

| # | File | Lines | Change |
|---|------|-------|--------|
| 1 | `frontend/src/app/globals.css` | 58-108 | Lighten background, card, muted, secondary, soften borders |
| 2 | `frontend/src/components/ui/card.tsx` | 10-11 | Multi-layer shadow, softer border |
| 3 | `frontend/src/components/ui/input.tsx` | 11 | Add bg fill, remove shadow-xs |
| 4 | `frontend/src/components/ui/textarea.tsx` | 10 | Same as input |
| 5 | `frontend/src/components/ui/select.tsx` | 40 | Same as input |
| 6 | `frontend/src/components/ui/button.tsx` | 8, 12 | Multi-layer shadow, active press, cursor-pointer |
| 7 | `frontend/src/components/ui/tabs.tsx` | 29-33, 67-69 | Lighter list bg, shadow on active tab |
| 8 | `frontend/src/components/ui/table.tsx` | 60, 73 | Table header styling |
| 9 | `frontend/src/components/ui/skeleton.tsx` | 7 | Change pulse color from gold to muted |

**Total: 9 files, all reusable primitives.** Every page in the app inherits the upgrade immediately.

## What This Does NOT Touch (Future Work)

- **Typography scale** — Playfair is loaded but underused. Could add more serif headings.
- **Animations/transitions** — Motion for card mounts, page transitions.
- **Dark mode** — The dark palette would need equivalent tuning.
- **Specific page layouts** — e.g. the New Program page hardcodes `bg-[#FDFBF7]` (line 122 of `programs/new/page.tsx`). We should remove that one-off and let the global background handle it, but that's per-page cleanup.
- **Sidebar refinement** — The sidebar is its own theming system via `--sidebar-*` vars.

## Verification

After changes:
```bash
cd frontend && npm run lint && npm run typecheck
cd frontend && npm run build
```

Visual check: Load any dashboard page — cards should float above the background, inputs should feel like interactive fields, tabs should clearly indicate the active step, and the overall feel should shift from "beige template" to "warm, layered, premium."
