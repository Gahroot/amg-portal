"use client";

import { format } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Hourglass,
  ChevronDown,
  ChevronUp,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DecisionHistoryItem } from "@/lib/api/client-portal";

interface DecisionHistoryListProps {
  decisions: DecisionHistoryItem[];
  isLoading?: boolean;
}

const STATUS_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  responded: { icon: CheckCircle, color: "text-green-600 dark:text-green-400", label: "Responded" },
  declined: { icon: XCircle, color: "text-red-500 dark:text-red-400", label: "Declined" },
  expired: { icon: Hourglass, color: "text-gray-500", label: "Expired" },
  cancelled: { icon: XCircle, color: "text-gray-400", label: "Cancelled" },
};

function formatResponseText(item: DecisionHistoryItem): string {
  if (!item.response) return "—";
  if (item.response.option_id) {
    const option = item.options?.find((o) => o.id === item.response?.option_id);
    return option?.label ?? item.response.option_id;
  }
  return item.response.text ?? "—";
}

function DecisionHistoryRow({ decision }: { decision: DecisionHistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[decision.status] ?? STATUS_CONFIG.expired;
  const StatusIcon = config.icon;
  const responseText = formatResponseText(decision);

  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm font-semibold">{decision.title}</CardTitle>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{decision.prompt}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className={cn("gap-1 text-xs", config.color)}>
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Summary row always visible */}
      <CardContent className="pb-3 pt-0">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {decision.responded_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Responded {format(new Date(decision.responded_at), "MMM d, yyyy")}
            </span>
          )}
          {!decision.responded_at && decision.created_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Raised {format(new Date(decision.created_at), "MMM d, yyyy")}
            </span>
          )}
          {decision.status === "responded" && (
            <span className="flex items-center gap-1 font-medium text-foreground">
              <MessageSquare className="h-3 w-3" />
              {responseText}
            </span>
          )}
        </div>
      </CardContent>

      {/* Expanded detail */}
      {expanded && (
        <>
          <Separator />
          <CardContent className="space-y-4 pt-4 text-sm">
            {/* Original prompt */}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Original Request
              </p>
              <p className="text-sm">{decision.prompt}</p>
            </div>

            {/* Options if present */}
            {decision.options && decision.options.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Options
                </p>
                <div className="space-y-1">
                  {decision.options.map((opt) => (
                    <div
                      key={opt.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                        decision.response?.option_id === opt.id
                          ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                          : "border-border bg-muted/30",
                      )}
                    >
                      {decision.response?.option_id === opt.id && (
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-600" />
                      )}
                      <span>{opt.label}</span>
                      {opt.description && (
                        <span className="text-xs text-muted-foreground"> — {opt.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Text response */}
            {decision.response?.text && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Your Response
                </p>
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  {decision.response.text}
                </p>
              </div>
            )}

            {/* Outcome / consequence */}
            {decision.consequence_text && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Outcome Note
                </p>
                <p className="text-sm text-muted-foreground">{decision.consequence_text}</p>
              </div>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
              <span>
                Type:{" "}
                <span className="font-medium text-foreground">
                  {decision.response_type.replace(/_/g, " ")}
                </span>
              </span>
              {decision.deadline_date && (
                <span>
                  Deadline:{" "}
                  <span className="font-medium text-foreground">
                    {format(new Date(decision.deadline_date), "MMM d, yyyy")}
                  </span>
                </span>
              )}
              {decision.responded_at && (
                <span>
                  Resolved:{" "}
                  <span className="font-medium text-foreground">
                    {format(new Date(decision.responded_at), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </span>
              )}
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export function DecisionHistoryList({ decisions, isLoading }: DecisionHistoryListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No decisions match your filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {decisions.map((d) => (
        <DecisionHistoryRow key={d.id} decision={d} />
      ))}
    </div>
  );
}
