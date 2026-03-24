import { useMemo } from "react";
import type { ProgramDetail } from "@/types/program";

export type GanttItemType = "milestone" | "task";

export interface GanttItem {
  id: string;
  parentId: string | null;
  type: GanttItemType;
  title: string;
  start: Date;
  end: Date;
  status: string;
  priority?: string;
  position: number;
  /** IDs of items this item depends on (finish-to-start) */
  dependsOn: string[];
  /** Whether this item is on the critical path */
  isCritical: boolean;
  depth: number;
}

export interface GanttDependency {
  fromId: string;
  toId: string;
}

export interface GanttData {
  items: GanttItem[];
  dependencies: GanttDependency[];
  projectStart: Date;
  projectEnd: Date;
  criticalPathIds: Set<string>;
}

function parseDate(s: string | null | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Compute the critical path using a simple longest-path algorithm on a DAG.
 * Returns a set of item IDs on the critical path.
 */
function computeCriticalPath(
  items: Omit<GanttItem, "isCritical">[],
  deps: GanttDependency[],
): Set<string> {
  if (items.length === 0) return new Set();

  // Map from id -> item
  const byId = new Map(items.map((i) => [i.id, i]));

  // Build adjacency list (fromId -> toId[])
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  for (const item of items) {
    successors.set(item.id, []);
    predecessors.set(item.id, []);
  }
  for (const dep of deps) {
    successors.get(dep.fromId)?.push(dep.toId);
    predecessors.get(dep.toId)?.push(dep.fromId);
  }

  // Duration in days for each item
  const duration = (id: string): number => {
    const item = byId.get(id);
    if (!item) return 0;
    return Math.max(1, Math.ceil((item.end.getTime() - item.start.getTime()) / 86_400_000));
  };

  // Forward pass — earliest finish time
  const earliest = new Map<string, number>();
  // Topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  for (const item of items) {
    inDegree.set(item.id, predecessors.get(item.id)?.length ?? 0);
  }
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  const topo: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    topo.push(id);
    for (const succ of successors.get(id) ?? []) {
      const newDeg = (inDegree.get(succ) ?? 1) - 1;
      inDegree.set(succ, newDeg);
      if (newDeg === 0) queue.push(succ);
    }
  }

  // Early finish
  for (const id of topo) {
    const preds = predecessors.get(id) ?? [];
    const maxPredFinish = preds.length === 0 ? 0 : Math.max(...preds.map((p) => earliest.get(p) ?? 0));
    earliest.set(id, maxPredFinish + duration(id));
  }

  // Project end = max early finish
  const projectEndTime = Math.max(...[...earliest.values()]);

  // Backward pass — latest finish time
  const latest = new Map<string, number>();
  for (const id of [...topo].reverse()) {
    const succs = successors.get(id) ?? [];
    if (succs.length === 0) {
      latest.set(id, projectEndTime);
    } else {
      latest.set(id, Math.min(...succs.map((s) => (latest.get(s) ?? projectEndTime) - duration(s))));
    }
  }

  // Critical: items where slack == 0
  const critical = new Set<string>();
  for (const item of items) {
    const ef = earliest.get(item.id) ?? 0;
    const lf = latest.get(item.id) ?? 0;
    if (lf - ef === 0) critical.add(item.id);
  }

  return critical;
}

export function useProgramGantt(program: ProgramDetail | undefined): GanttData {
  return useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const empty: GanttData = {
      items: [],
      dependencies: [],
      projectStart: today,
      projectEnd: addDays(today, 30),
      criticalPathIds: new Set(),
    };

    if (!program) return empty;

    const projectStart = parseDate(program.start_date, addDays(today, -7));
    const projectEnd = parseDate(program.end_date, addDays(today, 30));

    projectStart.setHours(0, 0, 0, 0);
    projectEnd.setHours(23, 59, 59, 999);

    // Sort milestones by position then due_date
    const sortedMilestones = [...(program.milestones ?? [])].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      const da = parseDate(a.due_date, projectEnd);
      const db = parseDate(b.due_date, projectEnd);
      return da.getTime() - db.getTime();
    });

    const itemsRaw: Omit<GanttItem, "isCritical">[] = [];
    const dependencies: GanttDependency[] = [];

    let prevMilestoneId: string | null = null;

    sortedMilestones.forEach((milestone, mIdx) => {
      const mEnd = parseDate(milestone.due_date, addDays(projectStart, (mIdx + 1) * 14));
      mEnd.setHours(23, 59, 59, 999);

      // Milestone start: use previous milestone end, or project start
      const mStart = mIdx === 0
        ? new Date(projectStart)
        : parseDate(
            sortedMilestones[mIdx - 1].due_date,
            addDays(projectStart, mIdx * 14),
          );
      mStart.setHours(0, 0, 0, 0);

      const milestoneItem: Omit<GanttItem, "isCritical"> = {
        id: milestone.id,
        parentId: null,
        type: "milestone",
        title: milestone.title,
        start: mStart,
        end: mEnd,
        status: milestone.status,
        position: milestone.position,
        dependsOn: prevMilestoneId ? [prevMilestoneId] : [],
        depth: 0,
      };
      itemsRaw.push(milestoneItem);

      if (prevMilestoneId) {
        dependencies.push({ fromId: prevMilestoneId, toId: milestone.id });
      }

      // Tasks within this milestone
      const sortedTasks = [...(milestone.tasks ?? [])].sort((a, b) => {
        const da = parseDate(a.due_date, mEnd);
        const db = parseDate(b.due_date, mEnd);
        return da.getTime() - db.getTime();
      });

      let prevTaskId: string | null = null;
      sortedTasks.forEach((task) => {
        const tEnd = parseDate(task.due_date, mEnd);
        tEnd.setHours(23, 59, 59, 999);
        const tStart = new Date(mStart);

        const taskItem: Omit<GanttItem, "isCritical"> = {
          id: task.id,
          parentId: milestone.id,
          type: "task",
          title: task.title,
          start: tStart,
          end: tEnd,
          status: task.status,
          priority: task.priority,
          position: 0,
          dependsOn: prevTaskId ? [prevTaskId] : [milestone.id],
          depth: 1,
        };
        itemsRaw.push(taskItem);

        if (prevTaskId) {
          dependencies.push({ fromId: prevTaskId, toId: task.id });
        } else {
          dependencies.push({ fromId: milestone.id, toId: task.id });
        }

        prevTaskId = task.id;
      });

      prevMilestoneId = milestone.id;
    });

    // Compute critical path
    const criticalPathIds = computeCriticalPath(itemsRaw, dependencies);

    const items: GanttItem[] = itemsRaw.map((item) => ({
      ...item,
      isCritical: criticalPathIds.has(item.id),
    }));

    // Expand bounds a bit for visual padding
    const allDates = items.flatMap((i) => [i.start, i.end]);
    const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : projectStart;
    const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : projectEnd;

    const viewStart = addDays(minDate, -3);
    const viewEnd = addDays(maxDate, 5);

    return { items, dependencies, projectStart: viewStart, projectEnd: viewEnd, criticalPathIds };
  }, [program]);
}
