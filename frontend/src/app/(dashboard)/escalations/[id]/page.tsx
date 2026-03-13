"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getEscalation, updateEscalation } from "@/lib/api/escalations";
import { EscalationStatusBadge } from "@/components/escalations/status-badge";
import { EscalationLevelBadge } from "@/components/escalations/level-badge";
import { ResolutionDialog } from "@/components/escalations/resolution-dialog";
import { AcknowledgeDialog } from "@/components/escalations/acknowledge-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, AlertTriangle, User } from "lucide-react";
import { useResolveEscalation, useAcknowledgeEscalation } from "@/hooks/use-escalations";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

interface TimelineItem {
  action: string;
  at: string;
  by?: string;
  notes?: string;
  to?: string;
  risk_factors?: Record<string, unknown>;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["acknowledged", "investigating"],
  acknowledged: ["investigating", "resolved"],
  investigating: ["resolved"],
  resolved: ["closed"],
  closed: [],
};

export default function EscalationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [resolveOpen, setResolveOpen] = React.useState(false);
  const [acknowledgeOpen, setAcknowledgeOpen] = React.useState(false);
  const [statusUpdate, setStatusUpdate] = React.useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["escalations", params.id],
    queryFn: () => getEscalation(params.id),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const resolveMutation = useResolveEscalation();
  const acknowledgeMutation = useAcknowledgeEscalation();

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      updateEscalation(params.id, { status: newStatus as "acknowledged" | "investigating" | "resolved" | "closed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalations", params.id] });
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
      toast.success("Status updated");
      setStatusUpdate("");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const handleResolve = (notes: string, _status: "resolved" | "closed") => {
    resolveMutation.mutate(
      { id: params.id, notes },
      {
        onSuccess: () => {
          toast.success("Escalation resolved");
          setResolveOpen(false);
        },
        onError: () => toast.error("Failed to resolve escalation"),
      },
    );
  };

  const handleAcknowledge = () => {
    acknowledgeMutation.mutate(params.id, {
      onSuccess: () => {
        toast.success("Escalation acknowledged");
        setAcknowledgeOpen(false);
      },
      onError: () => toast.error("Failed to acknowledge escalation"),
    });
  };

  const handleStatusUpdate = () => {
    if (statusUpdate) {
      statusMutation.mutate(statusUpdate);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString();
  };

  const getAgeInDays = (dateString: string) => {
    const now = new Date();
    const then = new Date(dateString);
    const diff = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "1 day";
    return `${diff} days`;
  };

  const getTimelineIcon = (action: string) => {
    switch (action) {
      case "triggered":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "status_change":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "risk_updated":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "assigned":
        return <User className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
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

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading escalation...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Escalation not found.</p>
      </div>
    );
  }

  const chain: TimelineItem[] = ((data.escalation_chain as unknown) as TimelineItem[]) || [];
  const availableTransitions = STATUS_TRANSITIONS[data.status] || [];

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            {data.title}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <EscalationLevelBadge level={data.level} />
          <EscalationStatusBadge status={data.status} />
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" />
            {getAgeInDays(data.triggered_at)} old
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entity Type</span>
                <span className="font-medium">{data.entity_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entity ID</span>
                <span className="font-mono text-xs">{data.entity_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Owner</span>
                <span className="font-medium">
                  {data.owner_name || data.owner_email || "Unknown"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Triggered By</span>
                <span className="font-medium">
                  {data.triggered_by_name || data.triggered_by_email || "Unknown"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Triggered At</span>
                <span className="font-medium">{formatDate(data.triggered_at)}</span>
              </div>
              {data.acknowledged_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Acknowledged At</span>
                  <span className="font-medium">{formatDate(data.acknowledged_at)}</span>
                </div>
              )}
              {data.resolved_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolved At</span>
                  <span className="font-medium">{formatDate(data.resolved_at)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {data.risk_factors && Object.keys(data.risk_factors).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Risk Factors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {Object.entries(data.risk_factors).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {data.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Description</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{data.description}</CardContent>
          </Card>
        )}

        {data.resolution_notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Resolution Notes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{data.resolution_notes}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {chain.map((item, index) => (
                <div key={index} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5">{getTimelineIcon(item.action)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">
                        {item.action.replace(/_/g, " ")}
                      </span>
                      {item.to && (
                        <>
                          <span className="text-muted-foreground">→</span>
                          <span className="capitalize">{item.to}</span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(item.at)}
                      {item.by && (
                        <span className="ml-2">
                          by <span className="font-medium">{item.by}</span>
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="mt-1 text-muted-foreground">{item.notes}</p>
                    )}
                    {item.risk_factors && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(item.risk_factors).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {key}: {String(value)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {data.status !== "resolved" && data.status !== "closed" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {data.status === "open" && (
                  <Button
                    variant="outline"
                    onClick={() => setAcknowledgeOpen(true)}
                    disabled={acknowledgeMutation.isPending}
                  >
                    Acknowledge
                  </Button>
                )}
                <Button
                  variant="default"
                  onClick={() => setResolveOpen(true)}
                  disabled={resolveMutation.isPending}
                >
                  Resolve
                </Button>
              </div>

              {availableTransitions.length > 0 && (
                <div className="border-t pt-4">
                  <Label className="text-sm text-muted-foreground">Quick Status Update</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Select value={statusUpdate} onValueChange={setStatusUpdate}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTransitions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleStatusUpdate}
                      disabled={!statusUpdate || statusMutation.isPending}
                    >
                      Update
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Resolution Dialog */}
        <ResolutionDialog
          open={resolveOpen}
          onOpenChange={setResolveOpen}
          onResolve={handleResolve}
          isPending={resolveMutation.isPending}
          escalationTitle={data.title}
        />

        {/* Acknowledge Dialog */}
        <AcknowledgeDialog
          open={acknowledgeOpen}
          onOpenChange={setAcknowledgeOpen}
          onAcknowledge={handleAcknowledge}
          isPending={acknowledgeMutation.isPending}
          escalationTitle={data.title}
        />
      </div>
    </div>
  );
}
