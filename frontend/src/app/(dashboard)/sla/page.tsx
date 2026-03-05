"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listSLATrackers, getSLABreaches } from "@/lib/api/sla";
import { useRespondToSLA } from "@/hooks/use-sla";
import { SLABreachBadge } from "@/components/sla/breach-badge";
import { SLAClock } from "@/components/sla/sla-clock";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { SLATracker, SLABreachAlertResponse } from "@/types/sla";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

const BREACH_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "within_sla", label: "Within SLA" },
  { value: "approaching_breach", label: "At Risk" },
  { value: "breached", label: "Breached" },
];

const PAGE_SIZE = 50;

type TabType = "all" | "breaches";

type TrackerRow = SLATracker | SLABreachAlertResponse;

const hasRespondedAt = (tracker: TrackerRow): tracker is SLATracker & { responded_at: string | null | undefined } =>
  "responded_at" in tracker;

export default function SLATrackerPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<TabType>("all");
  const [breachFilter, setBreachFilter] = React.useState<string>("all");
  const [page, setPage] = React.useState(0);

  const queryParams = {
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
    breach_status: breachFilter === "all" ? undefined : breachFilter,
  };

  const { data: trackersData, isLoading: trackersLoading } = useQuery({
    queryKey: ["sla", queryParams],
    queryFn: () => listSLATrackers(queryParams),
    enabled: !!user && ALLOWED_ROLES.includes(user.role) && activeTab === "all",
  });

  const { data: breachesData, isLoading: breachesLoading } = useQuery({
    queryKey: ["sla", "breaches"],
    queryFn: () => getSLABreaches(true),
    enabled: !!user && ALLOWED_ROLES.includes(user.role) && activeTab === "breaches",
    refetchInterval: 60 * 1000,
  });

  const respondMutation = useRespondToSLA();

  const handleRespond = (id: string) => {
    respondMutation.mutate(id, {
      onSuccess: () => toast.success("SLA marked as responded"),
      onError: () => toast.error("Failed to mark SLA as responded"),
    });
  };

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const currentData = activeTab === "all"
    ? trackersData
    : { trackers: breachesData || [], total: breachesData?.length || 0 };
  const isLoading = activeTab === "all" ? trackersLoading : breachesLoading;

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            SLA Tracker
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border bg-white p-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "all"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              All SLAs
            </button>
            <button
              onClick={() => setActiveTab("breaches")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors relative ${
                activeTab === "breaches"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Breaches / At Risk
              {breachesData && breachesData.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {breachesData.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "all" && (
            <Select
              value={breachFilter}
              onValueChange={(value) => {
                setPage(0);
                setBreachFilter(value);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {BREACH_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading SLA trackers...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>SLA Clock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData?.trackers.map((tracker) => (
                  <TableRow key={tracker.id}>
                    <TableCell className="font-mono text-sm">
                      {tracker.entity_type}:{tracker.entity_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {tracker.communication_type.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {"assigned_to_name" in tracker
                        ? (tracker.assigned_to_name ?? tracker.assigned_to_email ?? "Unknown")
                        : tracker.assigned_to}
                    </TableCell>
                    <TableCell>
                      <SLAClock
                        startedAt={tracker.started_at}
                        slaHours={tracker.sla_hours}
                        respondedAt={hasRespondedAt(tracker) ? tracker.responded_at ?? undefined : undefined}
                      />
                    </TableCell>
                    <TableCell>
                      <SLABreachBadge breachStatus={tracker.breach_status} />
                    </TableCell>
                    <TableCell>
                      {!hasRespondedAt(tracker) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRespond(tracker.id)}
                          disabled={respondMutation.isPending}
                        >
                          Respond
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {currentData?.trackers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No SLA trackers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {activeTab === "all" && trackersData && trackersData.total > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {Math.ceil(trackersData.total / PAGE_SIZE)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(trackersData.total / PAGE_SIZE) - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
