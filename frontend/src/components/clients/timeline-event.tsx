"use client";

import { useState } from "react";
import {
  MessageSquare,
  FileText,
  Flag,
  Briefcase,
  CheckCircle,
  Shield,
  StickyNote,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TimelineEvent, TimelineEventType } from "@/types/client-timeline";

const EVENT_CONFIG: Record<
  TimelineEventType,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  communication: {
    icon: MessageSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    label: "Communication",
  },
  document: {
    icon: FileText,
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "Document",
  },
  milestone: {
    icon: Flag,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    label: "Milestone",
  },
  program_status: {
    icon: Briefcase,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    label: "Program",
  },
  approval: {
    icon: CheckCircle,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    label: "Approval",
  },
  compliance: {
    icon: Shield,
    color: "text-red-600",
    bgColor: "bg-red-100",
    label: "Compliance",
  },
  note: {
    icon: StickyNote,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    label: "Note",
  },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDetailUrl(event: TimelineEvent): string | null {
  if (!event.entity_id || !event.entity_type) return null;
  switch (event.entity_type) {
    case "communication_log":
      return null; // No standalone page for communication logs
    case "document":
      return null; // Documents viewed inline
    case "milestone":
      return event.metadata.program_id
        ? `/programs/${event.metadata.program_id}`
        : null;
    case "program":
      return `/programs/${event.entity_id}`;
    case "approval":
      return event.metadata.program_id
        ? `/programs/${event.metadata.program_id}`
        : null;
    case "client_profile":
      return `/clients/${event.entity_id}`;
    default:
      return null;
  }
}

interface TimelineEventCardProps {
  event: TimelineEvent;
  isLast?: boolean;
}

export function TimelineEventCard({ event, isLast = false }: TimelineEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = EVENT_CONFIG[event.event_type];
  const Icon = config.icon;
  const detailUrl = getDetailUrl(event);

  // Build metadata display items
  const metadataItems: { label: string; value: string }[] = [];
  if (event.metadata.channel) {
    metadataItems.push({
      label: "Channel",
      value: String(event.metadata.channel).replace(/_/g, " "),
    });
  }
  if (event.metadata.direction) {
    metadataItems.push({
      label: "Direction",
      value: String(event.metadata.direction),
    });
  }
  if (event.metadata.status) {
    metadataItems.push({
      label: "Status",
      value: String(event.metadata.status).replace(/_/g, " "),
    });
  }
  if (event.metadata.category) {
    metadataItems.push({
      label: "Category",
      value: String(event.metadata.category).replace(/_/g, " "),
    });
  }
  if (event.metadata.due_date) {
    metadataItems.push({
      label: "Due Date",
      value: new Date(event.metadata.due_date as string).toLocaleDateString(),
    });
  }
  if (event.metadata.file_name) {
    metadataItems.push({
      label: "File",
      value: String(event.metadata.file_name),
    });
  }

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-border" />
      )}

      {/* Icon circle */}
      <div
        className={cn(
          "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          config.bgColor
        )}
      >
        <Icon className={cn("h-5 w-5", config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("text-xs", config.color)}>
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(event.occurred_at)}
                </span>
              </div>
              <h4 className="mt-1 text-sm font-medium leading-tight">
                {event.title}
              </h4>
            </div>
            <div className="flex items-center gap-1">
              {detailUrl && (
                <a
                  href={detailUrl}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title="View details"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {(event.description || metadataItems.length > 0) && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {expanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Actor */}
          {event.actor_name && (
            <p className="mt-1 text-xs text-muted-foreground">
              by {event.actor_name}
            </p>
          )}

          {/* Expanded details */}
          {expanded && (
            <div className="mt-3 space-y-2 border-t pt-3">
              {event.description && (
                <p className="text-sm text-muted-foreground">{event.description}</p>
              )}
              {metadataItems.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {metadataItems.map((item) => (
                    <div key={item.label} className="flex items-baseline gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {item.label}:
                      </span>
                      <span className="text-xs capitalize">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {event.metadata.tags &&
                Array.isArray(event.metadata.tags) &&
                (event.metadata.tags as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(event.metadata.tags as string[]).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
