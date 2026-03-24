# Program Timeline Page — Implementation Plan

## Goal
Create `frontend/src/app/(dashboard)/programs/[id]/timeline/page.tsx` — a visual timeline of program milestones using **recharts ScatterChart** with a time-scaled X-axis, custom milestone dots colored by status, and a click-to-reveal detail panel (Sheet).

---

## Dependencies

Recharts is **not** in `package.json` — install it:
```bash
cd frontend && npm install recharts
```
(date-fns is already installed for formatting)

---

## File to create

**`frontend/src/app/(dashboard)/programs/[id]/timeline/page.tsx`**

---

## Data Model

Use existing `Milestone` type from `@/types/program`:
```ts
interface Milestone {
  id, program_id, title, description, due_date,
  status: "pending" | "in_progress" | "completed" | "cancelled",
  position, tasks, created_at, updated_at
}
```

API call: `getProgram(id)` → `ProgramDetail.milestones[]`

---

## Timeline data shape (for recharts)

Convert milestones to scatter points:
```ts
interface TimelinePoint {
  x: number;        // due_date as Unix timestamp (ms)
  y: number;        // staggered: 0.1, -0.1, 0.2, -0.2, ... to prevent overlap
  milestone: Milestone;
}
```

Milestones **without** `due_date` are shown in a separate "Undated Milestones" card below the chart.

---

## Status colors

```ts
const MILESTONE_COLORS: Record<MilestoneStatus, string> = {
  pending:     "#9CA3AF",  // gray-400
  in_progress: "#3B82F6",  // blue-500
  completed:   "#22C55E",  // green-500
  cancelled:   "#EF4444",  // red-500
};
```

---

## Chart structure (recharts)

```tsx
<ResponsiveContainer width="100%" height={220}>
  <ScatterChart margin={{ top: 40, right: 60, left: 60, bottom: 20 }}>
    <XAxis
      dataKey="x"
      type="number"
      scale="time"
      domain={[startTs - padding, endTs + padding]}
      tickFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
      tickCount={6}
    />
    <YAxis
      dataKey="y"
      type="number"
      domain={[-0.5, 0.5]}
      hide
    />
    {/* Horizontal track line */}
    <ReferenceLine y={0} stroke="#E2E8F0" strokeWidth={2} />
    {/* Today marker */}
    <ReferenceLine
      x={Date.now()}
      stroke="#F59E0B"
      strokeDasharray="4 4"
      label={{ value: "Today", position: "top", fill: "#F59E0B", fontSize: 11 }}
    />
    {/* Program start/end markers */}
    {startTs && <ReferenceLine x={startTs} stroke="#94A3B8" strokeDasharray="2 2" label={{ value: "Start", position: "top", fontSize: 10 }} />}
    {endTs && <ReferenceLine x={endTs} stroke="#94A3B8" strokeDasharray="2 2" label={{ value: "End", position: "top", fontSize: 10 }} />}
    {/* Custom tooltip */}
    <Tooltip content={<TimelineTooltip />} cursor={false} />
    {/* Milestone dots */}
    <Scatter data={milestoneData} shape={renderMilestoneDot} />
  </ScatterChart>
</ResponsiveContainer>
```

---

## Custom milestone dot (renderMilestoneDot)

```tsx
const renderMilestoneDot = (props: any) => {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: TimelinePoint };
  const color = MILESTONE_COLORS[payload.milestone.status];
  const isSelected = selectedMilestone?.id === payload.milestone.id;

  return (
    <g
      key={payload.milestone.id}
      style={{ cursor: "pointer" }}
      onClick={() => setSelectedMilestone(payload.milestone)}
    >
      {/* Diamond shape: rotated square */}
      <rect
        x={cx - 9}
        y={cy - 9}
        width={18}
        height={18}
        rx={2}
        fill={color}
        stroke={isSelected ? "#1E293B" : "white"}
        strokeWidth={isSelected ? 3 : 2}
        transform={`rotate(45, ${cx}, ${cy})`}
        style={{ filter: isSelected ? "drop-shadow(0 0 4px rgba(0,0,0,0.3))" : "none" }}
      />
      {/* Milestone label above dot */}
      <text
        x={cx}
        y={cy - 18}
        textAnchor="middle"
        fontSize={10}
        fill="#64748B"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {payload.milestone.title.length > 14
          ? payload.milestone.title.slice(0, 13) + "…"
          : payload.milestone.title}
      </text>
    </g>
  );
};
```

---

## Custom tooltip (TimelineTooltip)

```tsx
function TimelineTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload as TimelinePoint;
  const m = point.milestone;
  return (
    <div className="rounded-lg border bg-white p-3 shadow-lg text-sm">
      <p className="font-semibold">{m.title}</p>
      <p className="text-muted-foreground mt-1">
        Due: {m.due_date ? format(new Date(m.due_date), "PPP") : "—"}
      </p>
      <StatusBadge status={m.status} />
    </div>
  );
}
```

---

## Detail Panel (Sheet)

Click on a milestone diamond → opens a right-side Sheet with:
- Title (h2)
- Status badge + due date
- Description (if any)
- Task list: each task with title, status badge, priority, assigned_to_name
- Task count summary (X of Y done)

Uses existing `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` from `@/components/ui/sheet`.

---

## Page layout

```
[Back arrow] Program: {program.title}                    [Timeline]

┌────────────────────────────────────────────────────────┐
│  Legend: ● Pending ● In Progress ● Completed ● Cancelled │
│                                                          │
│     ◆          ◆          ◆         ◆                    │
│  ───●──────────●──────────●─────────●─────── track       │
│  Jan 1       Mar 1       May 1     Jul 1                 │
└────────────────────────────────────────────────────────┘

[Undated Milestones card — if any]
```

---

## Stagger logic for Y values

To prevent overlapping labels/diamonds when milestones have close or equal dates:
```ts
const STAGGER = [0, 0.12, -0.12, 0.24, -0.24, 0.36, -0.36];
// assign stagger[i % STAGGER.length] to each milestone
```

---

## Domain calculation

```ts
const datedMilestones = milestones.filter((m) => m.due_date);
const timestamps = datedMilestones.map((m) => new Date(m.due_date!).getTime());
const programStart = program.start_date ? new Date(program.start_date).getTime() : null;
const programEnd = program.end_date ? new Date(program.end_date).getTime() : null;

const allTs = [...timestamps, programStart, programEnd, Date.now()].filter(Boolean) as number[];
const minTs = Math.min(...allTs);
const maxTs = Math.max(...allTs);
const padding = (maxTs - minTs) * 0.1 || 7 * 24 * 60 * 60 * 1000; // 10% or 7 days
```

---

## Files to touch

1. **Install recharts**: `cd frontend && npm install recharts`
2. **Create**: `frontend/src/app/(dashboard)/programs/[id]/timeline/page.tsx`

---

## Post-implementation checks

```bash
cd frontend && npm run lint && npm run typecheck
```

Fix all errors before marking done.
