"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createEscalationRule,
  updateEscalationRule,
} from "@/lib/api/escalation-rules";
import type { EscalationRule, EscalationRuleCreate } from "@/types/escalation-rule";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ROLE_OPTIONS } from "@/lib/constants";

const TRIGGER_TYPES = [
  { value: "sla_breach", label: "SLA Breach" },
  { value: "milestone_overdue", label: "Milestone Overdue" },
  { value: "budget_exceeded", label: "Budget Exceeded" },
  { value: "task_overdue", label: "Task Overdue" },
  { value: "manual", label: "Manual" },
];

const ESCALATION_LEVELS = [
  { value: "task", label: "Task" },
  { value: "milestone", label: "Milestone" },
  { value: "program", label: "Program" },
  { value: "client_impact", label: "Client Impact" },
];

// Filter to internal roles only for escalation rules
const ROLES = ROLE_OPTIONS.filter((r) =>
  ["managing_director", "relationship_manager", "coordinator", "finance_compliance"].includes(r.value)
).map((r) => ({
  ...r,
  label: r.value === "finance_compliance" ? "Finance / Compliance" : r.label,
}));

interface EscalationRuleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule: EscalationRule | null;
}

export function EscalationRuleForm({
  open,
  onOpenChange,
  editingRule,
}: EscalationRuleFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("sla_breach");
  const [escalationLevel, setEscalationLevel] = useState("task");
  const [autoAssignToRole, setAutoAssignToRole] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [conditionsJson, setConditionsJson] = useState("{}");

  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name);
      setDescription(editingRule.description || "");
      setTriggerType(editingRule.trigger_type);
      setEscalationLevel(editingRule.escalation_level);
      setAutoAssignToRole(editingRule.auto_assign_to_role || "");
      setIsActive(editingRule.is_active);
      setConditionsJson(JSON.stringify(editingRule.trigger_conditions, null, 2));
    } else {
      setName("");
      setDescription("");
      setTriggerType("sla_breach");
      setEscalationLevel("task");
      setAutoAssignToRole("");
      setIsActive(true);
      setConditionsJson("{}");
    }
  }, [editingRule, open]);

  const createMutation = useMutation({
    mutationFn: (data: EscalationRuleCreate) => createEscalationRule(data),
    onSuccess: () => {
      toast.success("Rule created");
      queryClient.invalidateQueries({ queryKey: ["escalation-rules"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to create rule"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EscalationRuleCreate> }) =>
      updateEscalationRule(id, data),
    onSuccess: () => {
      toast.success("Rule updated");
      queryClient.invalidateQueries({ queryKey: ["escalation-rules"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update rule"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    let conditions: Record<string, unknown>;
    try {
      conditions = JSON.parse(conditionsJson);
    } catch {
      toast.error("Invalid JSON in trigger conditions");
      return;
    }

    const payload: EscalationRuleCreate = {
      name,
      description: description || undefined,
      trigger_type: triggerType as EscalationRuleCreate["trigger_type"],
      trigger_conditions: conditions,
      escalation_level: escalationLevel,
      auto_assign_to_role: autoAssignToRole || undefined,
      is_active: isActive,
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingRule ? "Edit Escalation Rule" : "Create Escalation Rule"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Name</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., SLA 48h breach escalation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-description">Description</Label>
            <Textarea
              id="rule-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Trigger Type</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Escalation Level</Label>
              <Select value={escalationLevel} onValueChange={setEscalationLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESCALATION_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Auto-assign to Role</Label>
            <Select
              value={autoAssignToRole || "none"}
              onValueChange={(v) => setAutoAssignToRole(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None (use default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (use default)</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-conditions">
              Trigger Conditions (JSON)
            </Label>
            <Textarea
              id="rule-conditions"
              value={conditionsJson}
              onChange={(e) => setConditionsJson(e.target.value)}
              rows={4}
              className="font-mono text-sm"
              placeholder='{"sla_hours_exceeded": 48, "breach_count": 3}'
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="rule-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="rule-active">Active</Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {editingRule ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
