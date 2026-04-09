"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEscalation } from "@/lib/api/escalations";
import type { EscalationCreate, EscalationLevel } from "@/types/escalation";
import type { EscalationTemplate } from "@/types/escalation-template";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LayoutTemplate, X } from "lucide-react";
import { TemplatePicker } from "./template-picker";
import { CATEGORY_LABELS } from "@/types/escalation-template";

const ESCALATION_LEVELS: { value: EscalationLevel; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "milestone", label: "Milestone" },
  { value: "program", label: "Program" },
  { value: "client_impact", label: "Client Impact" },
];

interface EscalationCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_FORM = {
  title: "",
  description: "",
  entity_type: "manual",
  entity_id: "manual",
  level: "milestone" as EscalationLevel,
  program_id: "",
  client_id: "",
};

export function EscalationCreateDialog({
  open,
  onOpenChange,
}: EscalationCreateDialogProps) {
  const queryClient = useQueryClient();
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [appliedTemplate, setAppliedTemplate] =
    useState<EscalationTemplate | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  // Suggested actions from template shown below textarea
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setForm(DEFAULT_FORM);
      setAppliedTemplate(null);
      setSuggestedActions([]);
    }
  }, [open]);

  function applyTemplate(tpl: EscalationTemplate) {
    setAppliedTemplate(tpl);
    setForm((f) => ({
      ...f,
      title: f.title || tpl.name,
      description: tpl.description_template ?? f.description,
      level: tpl.severity as EscalationLevel,
    }));
    setSuggestedActions(tpl.suggested_actions ?? []);
  }

  function clearTemplate() {
    setAppliedTemplate(null);
    setSuggestedActions([]);
  }

  const createMutation = useMutation({
    mutationFn: (data: EscalationCreate) => createEscalation(data),
    onSuccess: () => {
      toast.success("Escalation created");
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to create escalation"),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    createMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      entity_type: form.entity_type.trim() || "manual",
      entity_id: form.entity_id.trim() || "manual",
      level: form.level,
      program_id: form.program_id.trim() || undefined,
      client_id: form.client_id.trim() || undefined,
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Escalation</DialogTitle>
          </DialogHeader>

          {/* Template selector bar */}
          <div className="flex items-center gap-2 pb-1">
            {appliedTemplate ? (
              <div className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-1.5 text-sm flex-1">
                <LayoutTemplate className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-primary font-medium truncate">
                  {appliedTemplate.name}
                </span>
                <Badge variant="secondary" className="text-xs ml-auto flex-shrink-0">
                  {CATEGORY_LABELS[appliedTemplate.category]}
                </Badge>
                <button
                  type="button"
                  onClick={clearTemplate}
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                  title="Remove template"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setTemplatePickerOpen(true)}
              >
                <LayoutTemplate className="h-4 w-4" />
                Use Template
              </Button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="esc-title">Title *</Label>
              <Input
                id="esc-title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Brief title for this escalation"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="esc-level">Level</Label>
              <Select
                value={form.level}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, level: v as EscalationLevel }))
                }
              >
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

            <div className="space-y-1.5">
              <Label htmlFor="esc-desc">Description</Label>
              <Textarea
                id="esc-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={4}
                placeholder="Describe the escalation in detail…"
              />
            </div>

            {/* Suggested actions from template */}
            {suggestedActions.length > 0 && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                  Suggested Actions
                </p>
                <ul className="space-y-1">
                  {suggestedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-300">
                      <span className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400 font-bold">
                        {i + 1}.
                      </span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="esc-entity-type">Entity Type</Label>
                <Input
                  id="esc-entity-type"
                  value={form.entity_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, entity_type: e.target.value }))
                  }
                  placeholder="e.g. program, task"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="esc-entity-id">Entity ID</Label>
                <Input
                  id="esc-entity-id"
                  value={form.entity_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, entity_id: e.target.value }))
                  }
                  placeholder="UUID or identifier"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="esc-program">Program ID</Label>
                <Input
                  id="esc-program"
                  value={form.program_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, program_id: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="esc-client">Client ID</Label>
                <Input
                  id="esc-client"
                  value={form.client_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, client_id: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Create Escalation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={applyTemplate}
      />
    </>
  );
}
