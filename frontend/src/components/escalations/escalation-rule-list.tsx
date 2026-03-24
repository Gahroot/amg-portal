"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  listEscalationRules,
  deleteEscalationRule,
} from "@/lib/api/escalation-rules";
import type { EscalationRule } from "@/types/escalation-rule";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Pencil } from "lucide-react";

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  sla_breach: "SLA Breach",
  milestone_overdue: "Milestone Overdue",
  budget_exceeded: "Budget Exceeded",
  task_overdue: "Task Overdue",
  manual: "Manual",
};

const LEVEL_LABELS: Record<string, string> = {
  task: "Task",
  milestone: "Milestone",
  program: "Program",
  client_impact: "Client Impact",
};

interface EscalationRuleListProps {
  onEdit: (rule: EscalationRule) => void;
  onCreate: () => void;
}

export function EscalationRuleList({ onEdit, onCreate }: EscalationRuleListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "managing_director";

  const { data, isLoading } = useQuery({
    queryKey: ["escalation-rules"],
    queryFn: () => listEscalationRules(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEscalationRule(id),
    onSuccess: () => {
      toast.success("Rule deleted");
      queryClient.invalidateQueries({ queryKey: ["escalation-rules"] });
    },
    onError: () => toast.error("Failed to delete rule"),
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete rule "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading rules...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold">Auto-Trigger Rules</h2>
        {isAdmin && (
          <Button onClick={onCreate} size="sm">
            Add Rule
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Trigger Type</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Conditions</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">
                  <div>
                    <p>{rule.name}</p>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground">
                        {rule.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {TRIGGER_TYPE_LABELS[rule.trigger_type] || rule.trigger_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  {LEVEL_LABELS[rule.escalation_level] || rule.escalation_level}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {JSON.stringify(rule.trigger_conditions)}
                </TableCell>
                <TableCell>
                  <Badge variant={rule.is_active ? "default" : "secondary"}>
                    {rule.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onEdit(rule)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(rule.id, rule.name)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {data?.rules.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 5}
                  className="text-center text-muted-foreground"
                >
                  No escalation rules configured.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
