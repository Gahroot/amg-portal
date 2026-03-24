"use client";

import { useState, useCallback } from "react";
import { AlertTriangle, Bell, CheckCheck, ExternalLink, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { useEscalations } from "@/hooks/use-escalations";
import { useAcknowledgeEscalation } from "@/hooks/use-escalations";
import type { Escalation, EscalationLevel, EscalationStatus } from "@/types/escalation";

// ─── Severity config ───────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<
  EscalationLevel,
  { label: string; badgeClass: string; dotClass: string }
> = {
  task: {
    label: "Task",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    dotClass: "bg-blue-500",
  },
  milestone: {
    label: "Milestone",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
  },
  program: {
    label: "Program",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
    dotClass: "bg-orange-500",
  },
  client_impact: {
    label: "Client Impact",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    dotClass: "bg-red-500",
  },
};

const STATUS_CONFIG: Record<
  EscalationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  open: { label: "Open", variant: "destructive" },
  acknowledged: { label: "Acknowledged", variant: "default" },
  investigating: { label: "Investigating", variant: "secondary" },
  resolved: { label: "Resolved", variant: "outline" },
  closed: { label: "Closed", variant: "outline" },
};

// ─── Single escalation row ─────────────────────────────────────────────────────

interface AlertRowProps {
  escalation: Escalation;
}

function AlertRow({ escalation }: AlertRowProps) {
  const acknowledge = useAcknowledgeEscalation();
  const levelCfg = LEVEL_CONFIG[escalation.level] ?? {
    label: escalation.level,
    badgeClass: "bg-gray-100 text-gray-800 border-gray-200",
    dotClass: "bg-gray-400",
  };
  const statusCfg = STATUS_CONFIG[escalation.status] ?? {
    label: escalation.status,
    variant: "outline" as const,
  };

  const triggeredAgo = formatDistanceToNow(new Date(escalation.triggered_at), {
    addSuffix: true,
  });

  const isOpen = escalation.status === "open";
  const canAcknowledge = isOpen;

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border p-3 transition-colors",
        isOpen
          ? "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"
          : "border-border bg-muted/20",
      )}
    >
      {/* Header row: level badge + status badge */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
            levelCfg.badgeClass,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", levelCfg.dotClass)} />
          {levelCfg.label}
        </span>
        <Badge variant={statusCfg.variant} className="text-xs">
          {statusCfg.label}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">{triggeredAgo}</span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium leading-snug">{escalation.title}</p>

      {/* Footer: entity info + actions */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground capitalize">
          {escalation.entity_type.replace("_", " ")}
        </span>

        <div className="ml-auto flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="View escalation"
          >
            <Link href={`/escalations/${escalation.id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>

          {canAcknowledge && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => acknowledge.mutate(escalation.id)}
              disabled={acknowledge.isPending}
              title="Acknowledge escalation"
            >
              {acknowledge.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              <span className="ml-1">Ack</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function AlertRowSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="ml-auto h-4 w-16" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

// ─── Panel content ─────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = ["open", "acknowledged", "investigating"];

function AlertsPanelContent() {
  const [statusFilter, setStatusFilter] = useState<string>("open");

  const { data, isLoading, isError } = useEscalations({
    status: statusFilter,
    limit: 50,
  });

  const escalations = data?.escalations ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b px-4 pb-3">
        {ACTIVE_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      <ScrollArea className="flex-1 px-4 py-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <AlertRowSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Failed to load escalations.</p>
          </div>
        ) : escalations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No {statusFilter} escalations</p>
            <p className="text-xs text-muted-foreground">
              {statusFilter === "open"
                ? "All clear — no active escalations right now."
                : `No escalations with status "${statusFilter}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {escalations.map((esc) => (
              <AlertRow key={esc.id} escalation={esc} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {!isLoading && escalations.length > 0 && (
        <>
          <Separator />
          <div className="px-4 py-3">
            <Button asChild variant="outline" size="sm" className="w-full text-xs">
              <Link href="/escalations">
                View all escalations
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Public component: sidebar trigger + sheet ─────────────────────────────────

export function AlertsPanel() {
  const [open, setOpen] = useState(false);
  const { state: sidebarState } = useSidebar();

  // Fetch open escalation count for the badge
  const { data: openData } = useEscalations({ status: "open", limit: 1 });
  const openCount = openData?.total ?? 0;

  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value);
  }, []);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Active Alerts"
                onClick={() => setOpen(true)}
                className={cn(
                  openCount > 0 && "text-red-600 hover:text-red-700 dark:text-red-400",
                )}
              >
                <div className="relative">
                  <AlertTriangle className="h-4 w-4" />
                  {openCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    </span>
                  )}
                </div>
                {sidebarState === "expanded" && (
                  <>
                    <span>Active Alerts</span>
                    {openCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs"
                      >
                        {openCount > 99 ? "99+" : openCount}
                      </Badge>
                    )}
                  </>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="left" className="flex w-[380px] flex-col p-0 sm:w-[420px]">
          <SheetHeader className="border-b px-4 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <SheetTitle className="text-base">Active Alerts</SheetTitle>
              {openCount > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {openCount} open
                </Badge>
              )}
            </div>
          </SheetHeader>

          <AlertsPanelContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
