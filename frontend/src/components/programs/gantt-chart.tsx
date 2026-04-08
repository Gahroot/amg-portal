"use client";

import * as React from "react";
import type { GanttItem, GanttDependency } from "@/hooks/use-program-gantt";
import type { ZoomLevel, GanttFilters } from "./gantt-toolbar";

// ─── Layout constants ─────────────────────────────────────────────────────────
const LABEL_WIDTH = 220;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 56;
const BAR_HEIGHT = 20;
const BAR_RADIUS = 4;
const BAR_VERTICAL_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const ARROW_COLOR = "var(--color-muted-foreground)";
const ARROW_HEAD_SIZE = 6;
const TODAY_COLOR = "#ef4444"; // red-500

// ─── Pixels per day by zoom level ────────────────────────────────────────────
const PX_PER_DAY: Record<ZoomLevel, number> = {
  day: 44,
  week: 14,
  month: 5,
};

// ─── Status → bar color ──────────────────────────────────────────────────────
function barColor(status: string, isCritical: boolean, priority?: string): string {
  if (isCritical) return "#ef4444"; // red-500

  switch (status) {
    case "completed":
    case "done":
      return "#10b981"; // emerald-500
    case "in_progress":
      return "#3b82f6"; // blue-500
    case "blocked":
      return "#f59e0b"; // amber-500
    case "cancelled":
      return "#94a3b8"; // slate-400
    default:
      if (priority === "urgent") return "#f97316"; // orange-500
      if (priority === "high") return "#6366f1"; // indigo-500
      return "#64748b"; // slate-500
  }
}

function barOpacity(status: string): number {
  if (status === "completed" || status === "done") return 0.75;
  if (status === "cancelled") return 0.45;
  return 1;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function diffDays(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Build header tick marks based on zoom
interface Tick {
  label: string;
  x: number;
  isMajor: boolean;
}

function buildTicks(start: Date, end: Date, pxPerDay: number, zoom: ZoomLevel): Tick[] {
  const ticks: Tick[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);

  while (cur <= end) {
    const x = diffDays(start, cur) * pxPerDay;

    if (zoom === "day") {
      ticks.push({
        label: cur.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        x,
        isMajor: cur.getDate() === 1,
      });
      cur.setDate(cur.getDate() + 1);
    } else if (zoom === "week") {
      if (cur.getDay() === 1 || isSameDay(cur, start)) {
        // Monday = start of week
        ticks.push({
          label: cur.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          x,
          isMajor: cur.getDate() <= 7,
        });
      }
      cur.setDate(cur.getDate() + 1);
    } else {
      // month: tick on 1st of each month
      if (cur.getDate() === 1 || isSameDay(cur, start)) {
        ticks.push({
          label: cur.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
          x,
          isMajor: cur.getMonth() === 0,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return ticks;
}

// ─── Arrow path between two bars ─────────────────────────────────────────────
function buildArrowPath(
  fromRow: number,
  fromX2: number, // right edge of source bar
  toRow: number,
  toX1: number,  // left edge of target bar
): string {
  const y1 = HEADER_HEIGHT + fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
  const y2 = HEADER_HEIGHT + toRow * ROW_HEIGHT + ROW_HEIGHT / 2;
  const midX = fromX2 + (toX1 - fromX2) / 2;

  if (fromRow === toRow) {
    return `M ${fromX2} ${y1} L ${toX1} ${y2}`;
  }

  return [
    `M ${fromX2} ${y1}`,
    `L ${midX} ${y1}`,
    `L ${midX} ${y2}`,
    `L ${toX1} ${y2}`,
  ].join(" ");
}

// ─── Component props ──────────────────────────────────────────────────────────
interface GanttChartProps {
  items: GanttItem[];
  dependencies: GanttDependency[];
  projectStart: Date;
  projectEnd: Date;
  zoom: ZoomLevel;
  filters: GanttFilters;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function GanttChart({
  items,
  dependencies,
  projectStart,
  projectEnd,
  zoom,
  filters,
  svgRef,
}: GanttChartProps) {
  const [tooltip, setTooltip] = React.useState<{
    x: number;
    y: number;
    item: GanttItem;
  } | null>(null);

  const pxPerDay = PX_PER_DAY[zoom];

  // Apply filters
  const visibleItems = React.useMemo(() => {
    return items.filter((item) => {
      if (filters.hideTasks && item.type === "task") return false;
      if (filters.hideCompleted && (item.status === "completed" || item.status === "done")) return false;
      if (filters.showOnlyCritical && !item.isCritical) return false;
      return true;
    });
  }, [items, filters]);

  // Build a map: id -> row index (within visible items)
  const rowByItemId = React.useMemo(() => {
    const map = new Map<string, number>();
    visibleItems.forEach((item, i) => map.set(item.id, i));
    return map;
  }, [visibleItems]);

  const totalDays = Math.ceil(diffDays(projectStart, projectEnd)) + 1;
  const svgWidth = LABEL_WIDTH + totalDays * pxPerDay;
  const svgHeight = HEADER_HEIGHT + visibleItems.length * ROW_HEIGHT + 20;

  const ticks = buildTicks(projectStart, projectEnd, pxPerDay, zoom);

  // Today marker
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayX = LABEL_WIDTH + diffDays(projectStart, today) * pxPerDay;
  const showTodayMarker = today >= projectStart && today <= projectEnd;

  // Convert date to X coordinate in the chart area
  function dateToX(date: Date): number {
    return LABEL_WIDTH + diffDays(projectStart, date) * pxPerDay;
  }

  // Visible dependencies (both endpoints must be visible)
  const visibleDeps = dependencies.filter(
    (dep) => rowByItemId.has(dep.fromId) && rowByItemId.has(dep.toId),
  );

  const handleMouseEnter = (
    e: React.MouseEvent<SVGRectElement>,
    item: GanttItem,
  ) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top, item });
  };

  const handleMouseLeave = () => setTooltip(null);

  if (visibleItems.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No items to display. Adjust your filters or add milestones to this program.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Scrollable container */}
      <div className="overflow-auto rounded-lg border bg-card">
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          className="block select-none"
          style={{ minWidth: "100%" }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth={ARROW_HEAD_SIZE}
              markerHeight={ARROW_HEAD_SIZE}
              refX={ARROW_HEAD_SIZE - 1}
              refY={ARROW_HEAD_SIZE / 2}
              orient="auto"
            >
              <polygon
                points={`0 0, ${ARROW_HEAD_SIZE} ${ARROW_HEAD_SIZE / 2}, 0 ${ARROW_HEAD_SIZE}`}
                fill={ARROW_COLOR}
              />
            </marker>
            <marker
              id="arrowhead-critical"
              markerWidth={ARROW_HEAD_SIZE}
              markerHeight={ARROW_HEAD_SIZE}
              refX={ARROW_HEAD_SIZE - 1}
              refY={ARROW_HEAD_SIZE / 2}
              orient="auto"
            >
              <polygon
                points={`0 0, ${ARROW_HEAD_SIZE} ${ARROW_HEAD_SIZE / 2}, 0 ${ARROW_HEAD_SIZE}`}
                fill="#ef4444"
              />
            </marker>
          </defs>

          {/* ── Background stripes ── */}
          {visibleItems.map((_, i) => (
            <rect
              key={`stripe-${i}`}
              x={0}
              y={HEADER_HEIGHT + i * ROW_HEIGHT}
              width={svgWidth}
              height={ROW_HEIGHT}
              fill={i % 2 === 0 ? "transparent" : "var(--color-muted)"}
              fillOpacity={i % 2 === 0 ? 0 : 0.5}
            />
          ))}

          {/* ── Vertical grid lines ── */}
          {ticks.map((tick, i) => (
            <line
              key={`grid-${i}`}
              x1={LABEL_WIDTH + tick.x}
              y1={HEADER_HEIGHT}
              x2={LABEL_WIDTH + tick.x}
              y2={svgHeight}
              stroke="var(--color-border)"
              strokeWidth={tick.isMajor ? 1 : 0.5}
              strokeOpacity={tick.isMajor ? 1 : 0.6}
            />
          ))}

          {/* ── Header background ── */}
          <rect x={0} y={0} width={svgWidth} height={HEADER_HEIGHT} fill="hsl(var(--muted))" />
          <line x1={0} y1={HEADER_HEIGHT} x2={svgWidth} y2={HEADER_HEIGHT} stroke="var(--color-border)" strokeWidth={1} />

          {/* ── Label panel background ── */}
          <rect x={0} y={0} width={LABEL_WIDTH} height={svgHeight} fill="hsl(var(--card))" />
          <line x1={LABEL_WIDTH} y1={0} x2={LABEL_WIDTH} y2={svgHeight} stroke="var(--color-border)" strokeWidth={1} />

          {/* ── Header: time labels ── */}
          <text x={8} y={HEADER_HEIGHT / 2 + 5} fontSize={11} fill="hsl(var(--muted-foreground))" fontWeight={600}>
            Item
          </text>
          {ticks.map((tick, i) => (
            <text
              key={`tick-${i}`}
              x={LABEL_WIDTH + tick.x + 4}
              y={tick.isMajor ? HEADER_HEIGHT / 2 : HEADER_HEIGHT - 10}
              fontSize={tick.isMajor ? 11 : 10}
              fontWeight={tick.isMajor ? 700 : 400}
              fill={tick.isMajor ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}
            >
              {tick.label}
            </text>
          ))}

          {/* ── Today marker ── */}
          {showTodayMarker && (
            <>
              <line
                x1={todayX}
                y1={HEADER_HEIGHT - 4}
                x2={todayX}
                y2={svgHeight}
                stroke={TODAY_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4,3"
              />
              <rect
                x={todayX - 16}
                y={4}
                width={32}
                height={16}
                rx={3}
                fill={TODAY_COLOR}
              />
              <text
                x={todayX}
                y={16}
                fontSize={9}
                fontWeight={700}
                fill="white"
                textAnchor="middle"
              >
                TODAY
              </text>
            </>
          )}

          {/* ── Dependency arrows ── */}
          {visibleDeps.map((dep, i) => {
            const fromRow = rowByItemId.get(dep.fromId) ?? 0;
            const toRow = rowByItemId.get(dep.toId) ?? 0;
            const fromItem = items.find((it) => it.id === dep.fromId);
            const toItem = items.find((it) => it.id === dep.toId);
            if (!fromItem || !toItem) return null;

            const fromX2 = dateToX(fromItem.end);
            const toX1 = dateToX(toItem.start);
            const isCritical = fromItem.isCritical && toItem.isCritical;

            return (
              <path
                key={`dep-${i}`}
                d={buildArrowPath(fromRow, fromX2, toRow, toX1)}
                fill="none"
                stroke={isCritical ? "#ef4444" : ARROW_COLOR}
                strokeWidth={isCritical ? 1.5 : 1}
                markerEnd={isCritical ? "url(#arrowhead-critical)" : "url(#arrowhead)"}
                opacity={0.7}
              />
            );
          })}

          {/* ── Bars ── */}
          {visibleItems.map((item, rowIdx) => {
            const x1 = dateToX(item.start);
            const x2 = dateToX(item.end);
            const barW = Math.max(4, x2 - x1);
            const barX = x1;
            const barY = HEADER_HEIGHT + rowIdx * ROW_HEIGHT + BAR_VERTICAL_OFFSET;
            const color = barColor(item.status, item.isCritical, item.priority);
            const opacity = barOpacity(item.status);
            const isTask = item.type === "task";
            const indent = item.depth * 14;

            return (
              <g key={item.id}>
                {/* Row label */}
                <text
                  x={8 + indent}
                  y={HEADER_HEIGHT + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2 + 4}
                  fontSize={isTask ? 11 : 12}
                  fontWeight={isTask ? 400 : 600}
                  fill="hsl(var(--foreground))"
                  clipPath={`url(#label-clip-${rowIdx})`}
                >
                  {isTask ? `↳ ${item.title}` : item.title}
                </text>
                <clipPath id={`label-clip-${rowIdx}`}>
                  <rect x={0} y={HEADER_HEIGHT + rowIdx * ROW_HEIGHT} width={LABEL_WIDTH - 8} height={ROW_HEIGHT} />
                </clipPath>

                {/* Bar */}
                <rect
                  x={barX}
                  y={barY}
                  width={barW}
                  height={BAR_HEIGHT}
                  rx={BAR_RADIUS}
                  fill={color}
                  opacity={opacity}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                  onMouseEnter={(e) => handleMouseEnter(e, item)}
                  onMouseLeave={handleMouseLeave}
                />

                {/* Critical path glow outline */}
                {item.isCritical && (
                  <rect
                    x={barX - 1}
                    y={barY - 1}
                    width={barW + 2}
                    height={BAR_HEIGHT + 2}
                    rx={BAR_RADIUS + 1}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    opacity={0.5}
                  />
                )}

                {/* Progress fill for in_progress milestones */}
                {item.type === "milestone" && item.status === "in_progress" && (
                  <rect
                    x={barX}
                    y={barY}
                    width={barW * 0.5}
                    height={BAR_HEIGHT}
                    rx={BAR_RADIUS}
                    fill="white"
                    opacity={0.15}
                  />
                )}

                {/* Bar label (inline, if bar is wide enough) */}
                {barW > 60 && (
                  <text
                    x={barX + 6}
                    y={barY + BAR_HEIGHT / 2 + 4}
                    fontSize={10}
                    fill="white"
                    fontWeight={500}
                    pointerEvents="none"
                  >
                    {item.title.length > 20 ? item.title.slice(0, 18) + "…" : item.title}
                  </text>
                )}
              </g>
            );
          })}

          {/* ── Row separator lines ── */}
          {visibleItems.map((_, i) => (
            <line
              key={`sep-${i}`}
              x1={0}
              y1={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
              x2={svgWidth}
              y2={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
              stroke="var(--color-border)"
              strokeWidth={0.5}
            />
          ))}
        </svg>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border bg-popover px-3 py-2 shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold text-sm">{tooltip.item.title}</p>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <p>
              <span className="font-medium">Type:</span>{" "}
              {tooltip.item.type === "milestone" ? "Milestone" : "Task"}
            </p>
            <p>
              <span className="font-medium">Status:</span>{" "}
              {tooltip.item.status.replace(/_/g, " ")}
            </p>
            <p>
              <span className="font-medium">Start:</span>{" "}
              {tooltip.item.start.toLocaleDateString()}
            </p>
            <p>
              <span className="font-medium">End:</span>{" "}
              {tooltip.item.end.toLocaleDateString()}
            </p>
            {tooltip.item.priority && (
              <p>
                <span className="font-medium">Priority:</span>{" "}
                {tooltip.item.priority}
              </p>
            )}
            {tooltip.item.isCritical && (
              <p className="font-semibold text-red-500">⚡ Critical Path</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
