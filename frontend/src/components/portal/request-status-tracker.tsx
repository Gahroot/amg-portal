"use client";

import * as React from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Loader2,
  PackageCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentRequestItem, DocumentRequestStatus } from "@/types/document";

// ── Stage definitions ─────────────────────────────────────────────────────────

interface Stage {
  key: DocumentRequestStatus;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const STAGES: Stage[] = [
  {
    key: "pending",
    label: "Requested",
    description: "Your relationship manager has requested this document.",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    key: "in_progress",
    label: "In Progress",
    description: "AMG is working on processing your request.",
    icon: <Loader2 className="h-4 w-4" />,
  },
  {
    key: "received",
    label: "Received",
    description: "Your document has been received by AMG.",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    key: "processing",
    label: "Processing",
    description: "Your document is being reviewed and processed.",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    key: "complete",
    label: "Complete",
    description: "Your document request has been completed.",
    icon: <PackageCheck className="h-4 w-4" />,
  },
];

// Map a status to its position in the flow (ignores terminal states)
const STATUS_ORDER: Record<DocumentRequestStatus, number> = {
  pending: 0,
  overdue: 0, // treated same as pending in position
  in_progress: 1,
  received: 2,
  processing: 3,
  complete: 4,
  cancelled: -1,
};

// For each stage, what timestamp field holds its completion time
const STAGE_TIMESTAMPS: Record<string, keyof DocumentRequestItem> = {
  pending: "requested_at",
  in_progress: "in_progress_at",
  received: "received_at",
  processing: "processing_at",
  complete: "completed_at",
};

function formatTimestamp(ts: string | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Stage node ────────────────────────────────────────────────────────────────

interface StageNodeProps {
  stage: Stage;
  state: "done" | "active" | "upcoming";
  timestamp: string | null;
  isLast: boolean;
}

function StageNode({ stage, state, timestamp, isLast }: StageNodeProps) {
  const isDone = state === "done";
  const isActive = state === "active";

  return (
    <div className="flex gap-3">
      {/* Icon + connector */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            isDone && "border-primary bg-primary text-primary-foreground",
            isActive && "border-primary bg-primary/10 text-primary",
            !isDone && !isActive && "border-muted bg-muted/30 text-muted-foreground",
          )}
        >
          {isDone ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isActive ? (
            <span className="animate-pulse">{stage.icon}</span>
          ) : (
            <Circle className="h-4 w-4 opacity-40" />
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "mt-1 w-0.5 flex-1 min-h-[1.5rem]",
              isDone ? "bg-primary" : "bg-muted",
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="pb-5 min-w-0">
        <p
          className={cn(
            "text-sm font-medium leading-tight",
            (isDone || isActive) ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {stage.label}
        </p>
        {(isDone || isActive) && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {stage.description}
          </p>
        )}
        {timestamp && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">{timestamp}</p>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface RequestStatusTrackerProps {
  request: DocumentRequestItem;
  className?: string;
}

export function RequestStatusTracker({ request, className }: RequestStatusTrackerProps) {
  const currentStatus = request.status as DocumentRequestStatus;
  const isCancelled = currentStatus === "cancelled";
  const currentOrder = STATUS_ORDER[currentStatus] ?? 0;

  if (isCancelled) {
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10 text-destructive">
          <XCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-destructive">Cancelled</p>
          <p className="text-xs text-muted-foreground mt-0.5">This request has been cancelled.</p>
          {request.cancelled_at && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">
              {formatTimestamp(request.cancelled_at)}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", className)}>
      {STAGES.map((stage, idx) => {
        const stageOrder = STATUS_ORDER[stage.key] ?? 0;
        let state: "done" | "active" | "upcoming";

        if (stageOrder < currentOrder) {
          state = "done";
        } else if (
          stageOrder === currentOrder ||
          (currentStatus === "overdue" && stage.key === "pending")
        ) {
          state = "active";
        } else {
          state = "upcoming";
        }

        const tsKey = STAGE_TIMESTAMPS[stage.key];
        const tsValue = tsKey ? (request[tsKey] as string | null) : null;
        const timestamp = formatTimestamp(tsValue);

        return (
          <StageNode
            key={stage.key}
            stage={stage}
            state={state}
            timestamp={timestamp}
            isLast={idx === STAGES.length - 1}
          />
        );
      })}
    </div>
  );
}
