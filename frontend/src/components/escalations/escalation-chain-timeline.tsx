"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, User, ArrowUpRight, RotateCcw } from "lucide-react";

export interface TimelineItem {
  action: string;
  at: string;
  by?: string;
  notes?: string;
  to?: string;
  to_level?: string;
  from_level?: string;
  risk_factors?: Record<string, unknown>;
  parent_id?: string;
  child_id?: string;
  new_owner_id?: string;
  from_owner_id?: string;
  to_owner_id?: string;
}

interface EscalationChainTimelineProps {
  chain: TimelineItem[];
}

function getTimelineIcon(action: string) {
  switch (action) {
    case "triggered":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "status_change":
      return <Clock className="h-4 w-4 text-blue-500" />;
    case "risk_updated":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "assigned":
    case "reassigned":
      return <User className="h-4 w-4 text-purple-500" />;
    case "chain_progression":
    case "auto_progressed":
    case "level_upgraded":
      return <ArrowUpRight className="h-4 w-4 text-orange-500" />;
    case "risk_check":
      return <RotateCcw className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    triggered: "Triggered",
    status_change: "Status Changed",
    risk_updated: "Risk Updated",
    assigned: "Assigned",
    reassigned: "Reassigned",
    chain_progression: "Level Progressed",
    auto_progressed: "Auto-Progressed",
    level_upgraded: "Level Upgraded",
    risk_check: "Risk Check",
  };
  return labels[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EscalationChainTimeline({ chain }: EscalationChainTimelineProps) {
  if (!chain || chain.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No timeline entries yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {chain.map((item, index) => (
        <div key={index} className="flex items-start gap-3 text-sm">
          <div className="mt-0.5 shrink-0">{getTimelineIcon(item.action)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{getActionLabel(item.action)}</span>
              {(item.to_level ?? item.to) && (
                <>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.to_level ?? item.to}
                  </Badge>
                </>
              )}
              {item.from_level && item.to_level && (
                <span className="text-xs text-muted-foreground">
                  (from{" "}
                  <span className="font-medium capitalize">{item.from_level}</span>)
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(item.at)}
              {item.by && (
                <span className="ml-2">
                  by <span className="font-medium">{item.by}</span>
                </span>
              )}
            </div>
            {item.notes && (
              <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
            )}
            {item.risk_factors && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(item.risk_factors).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key.replace(/_/g, " ")}: {String(value)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
