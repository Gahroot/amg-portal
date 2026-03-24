"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { GitBranch, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TaskBoard } from "@/types/task";

interface TaskDependencyGraphProps {
  tasks: TaskBoard[];
  /** If set, highlight the dependency chain for this task */
  focusTaskId?: string | null;
  onTaskClick?: (task: TaskBoard) => void;
}

// Layout constants
const NODE_W = 180;
const NODE_H = 56;
const H_GAP = 60;
const V_GAP = 24;

type GraphNode = {
  task: TaskBoard;
  x: number;
  y: number;
  col: number;
  row: number;
};

/** Compute topological column assignments via Kahn's algorithm, then lay out rows. */
function layoutGraph(tasks: TaskBoard[]): GraphNode[] {
  if (tasks.length === 0) return [];

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>(); // dep → tasks that depend on it

  for (const t of tasks) {
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0);
    for (const depId of t.depends_on) {
      if (!taskMap.has(depId)) continue;
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
      if (!children.has(depId)) children.set(depId, []);
      children.get(depId)!.push(t.id);
    }
  }

  // Column = longest path from a root (BFS-based level assignment)
  const col = new Map<string, number>();
  const queue: string[] = [];
  for (const t of tasks) {
    if ((inDegree.get(t.id) ?? 0) === 0) {
      queue.push(t.id);
      col.set(t.id, 0);
    }
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const childId of children.get(id) ?? []) {
      const newCol = (col.get(id) ?? 0) + 1;
      if (newCol > (col.get(childId) ?? -1)) {
        col.set(childId, newCol);
        queue.push(childId);
      }
    }
  }

  // Group by column, assign row within column
  const colGroups = new Map<number, string[]>();
  for (const [id, c] of col.entries()) {
    if (!colGroups.has(c)) colGroups.set(c, []);
    colGroups.get(c)!.push(id);
  }

  const nodes: GraphNode[] = [];
  for (const [c, ids] of colGroups.entries()) {
    ids.forEach((id, row) => {
      const task = taskMap.get(id)!;
      nodes.push({
        task,
        col: c,
        row,
        x: c * (NODE_W + H_GAP),
        y: row * (NODE_H + V_GAP),
      });
    });
  }

  // Center columns vertically relative to the tallest
  const maxRows = Math.max(...Array.from(colGroups.values()).map((g) => g.length));
  const totalH = maxRows * (NODE_H + V_GAP) - V_GAP;
  for (const node of nodes) {
    const colH =
      (colGroups.get(node.col)?.length ?? 1) * (NODE_H + V_GAP) - V_GAP;
    node.y += (totalH - colH) / 2;
  }

  return nodes;
}

function statusColor(status: TaskBoard["status"]): string {
  switch (status) {
    case "done":
      return "stroke-green-500 fill-green-50 dark:fill-green-950";
    case "in_progress":
      return "stroke-blue-500 fill-blue-50 dark:fill-blue-950";
    case "blocked":
      return "stroke-red-500 fill-red-50 dark:fill-red-950";
    case "cancelled":
      return "stroke-gray-400 fill-gray-50 dark:fill-gray-900 opacity-50";
    default:
      return "stroke-slate-400 fill-card";
  }
}

function statusDot(status: TaskBoard["status"]): string {
  switch (status) {
    case "done":       return "fill-green-500";
    case "in_progress": return "fill-blue-500";
    case "blocked":    return "fill-red-500";
    case "cancelled":  return "fill-gray-400";
    default:           return "fill-slate-400";
  }
}

/** Compute a cubic bezier path from right-center of source to left-center of target. */
function edgePath(
  src: GraphNode,
  tgt: GraphNode,
): string {
  const x1 = src.x + NODE_W;
  const y1 = src.y + NODE_H / 2;
  const x2 = tgt.x;
  const y2 = tgt.y + NODE_H / 2;
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

export function TaskDependencyGraph({
  tasks,
  focusTaskId,
  onTaskClick,
}: TaskDependencyGraphProps) {
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  const nodes = useMemo(() => layoutGraph(tasks), [tasks]);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.task.id, n])), [nodes]);

  // Edges: for each task A that depends_on B, draw B → A
  const edges = useMemo(() => {
    const result: { src: GraphNode; tgt: GraphNode; isCritical: boolean }[] = [];
    for (const node of nodes) {
      for (const depId of node.task.depends_on) {
        const srcNode = nodeMap.get(depId);
        if (!srcNode) continue;
        const isCritical =
          (focusTaskId !== null && focusTaskId !== undefined) &&
          (node.task.id === focusTaskId || srcNode.task.id === focusTaskId);
        result.push({ src: srcNode, tgt: node, isCritical });
      }
    }
    return result;
  }, [nodes, nodeMap, focusTaskId]);

  // Compute SVG viewport
  const { width, height } = useMemo(() => {
    if (nodes.length === 0) return { width: 400, height: 200 };
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_W)) + H_GAP;
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_H)) + V_GAP;
    return { width: maxX, height: maxY };
  }, [nodes]);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.2, 2.5)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.2, 0.3)), []);
  const handleFit = useCallback(() => setZoom(1), []);

  if (nodes.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
        <GitBranch className="size-8 opacity-30" />
        <p className="text-sm">No tasks to display</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-2">
      {/* Controls */}
      <div className="flex items-center gap-1 self-end">
        <Button variant="outline" size="icon-xs" onClick={handleZoomOut} title="Zoom out">
          <ZoomOut className="size-3.5" />
        </Button>
        <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="outline" size="icon-xs" onClick={handleZoomIn} title="Zoom in">
          <ZoomIn className="size-3.5" />
        </Button>
        <Button variant="outline" size="icon-xs" onClick={handleFit} title="Reset zoom">
          <Maximize2 className="size-3.5" />
        </Button>
      </div>

      {/* SVG canvas */}
      <div className="overflow-auto rounded-lg border bg-muted/20">
        <div
          style={{
            width: width * zoom,
            height: height * zoom,
            minWidth: "100%",
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            width={width * zoom}
            height={height * zoom}
            className="select-none"
          >
            <defs>
              {/* Arrow marker */}
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L8,3 z" className="fill-muted-foreground" />
              </marker>
              <marker
                id="arrowhead-critical"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L8,3 z" className="fill-orange-500" />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map(({ src, tgt, isCritical }, i) => (
              <path
                key={i}
                d={edgePath(src, tgt)}
                fill="none"
                strokeWidth={isCritical ? 2 : 1.5}
                markerEnd={
                  isCritical ? "url(#arrowhead-critical)" : "url(#arrowhead)"
                }
                className={
                  isCritical
                    ? "stroke-orange-500"
                    : "stroke-muted-foreground/40"
                }
              />
            ))}

            {/* Nodes */}
            {nodes.map((node) => {
              const isFocused = focusTaskId === node.task.id;
              const isRelated =
                focusTaskId !== null &&
                focusTaskId !== undefined &&
                !isFocused &&
                (node.task.depends_on.includes(focusTaskId) ||
                  node.task.blocked_by.includes(focusTaskId));
              const isBlocked =
                node.task.depends_on.length > 0 &&
                node.task.depends_on.some((depId) => {
                  const depTask = tasks.find((t) => t.id === depId);
                  return depTask && depTask.status !== "done" && depTask.status !== "cancelled";
                });

              return (
                <g
                  key={node.task.id}
                  transform={`translate(${node.x},${node.y})`}
                  onClick={() => onTaskClick?.(node.task)}
                  className={cn(
                    "cursor-pointer",
                    onTaskClick && "hover:opacity-80",
                  )}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    strokeWidth={isFocused ? 2.5 : 1.5}
                    className={cn(
                      statusColor(node.task.status),
                      isFocused && "stroke-orange-500 ring-0",
                      isRelated && "stroke-orange-300",
                      !isFocused && !isRelated && "opacity-90",
                    )}
                  />

                  {/* Status dot */}
                  <circle
                    cx={14}
                    cy={NODE_H / 2}
                    r={4}
                    className={statusDot(node.task.status)}
                  />

                  {/* Task title */}
                  <foreignObject x={24} y={8} width={NODE_W - 32} height={NODE_H - 16}>
                    <div
                      // @ts-expect-error xmlns required for foreignObject
                      xmlns="http://www.w3.org/1999/xhtml"
                      style={{
                        fontSize: 11,
                        lineHeight: 1.35,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        wordBreak: "break-word",
                      }}
                    >
                      {node.task.title}
                    </div>
                  </foreignObject>

                  {/* "Blocked" warning icon */}
                  {isBlocked && node.task.status !== "done" && (
                    <text
                      x={NODE_W - 12}
                      y={14}
                      textAnchor="middle"
                      fontSize={12}
                    >
                      ⚠
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {[
          { color: "bg-slate-400", label: "To Do" },
          { color: "bg-blue-500", label: "In Progress" },
          { color: "bg-red-500", label: "Blocked" },
          { color: "bg-green-500", label: "Done" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", color)} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="text-orange-500">⚠</span>
          Blocked by incomplete dep.
        </span>
      </div>
    </div>
  );
}
