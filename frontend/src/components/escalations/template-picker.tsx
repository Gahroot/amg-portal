"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { listEscalationTemplates } from "@/lib/api/escalation-templates";
import type {
  EscalationTemplate,
  EscalationTemplateCategory,
} from "@/types/escalation-template";
import { CATEGORY_LABELS, SEVERITY_LABELS } from "@/types/escalation-template";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CheckCircle2, ShieldAlert } from "lucide-react";

const CATEGORY_OPTIONS: { value: EscalationTemplateCategory; label: string }[] =
  [
    { value: "partner_sla_breach", label: "Partner SLA Breach" },
    { value: "client_dissatisfaction", label: "Client Dissatisfaction" },
    { value: "resource_unavailable", label: "Resource Unavailable" },
    { value: "budget_overrun", label: "Budget Overrun" },
    { value: "timeline_delay", label: "Timeline Delay" },
    { value: "quality_issue", label: "Quality Issue" },
  ];

const SEVERITY_COLORS: Record<string, string> = {
  task: "bg-blue-100 text-blue-800",
  milestone: "bg-amber-100 text-amber-800",
  program: "bg-orange-100 text-orange-800",
  client_impact: "bg-red-100 text-red-800",
};

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: EscalationTemplate) => void;
}

export function TemplatePicker({
  open,
  onOpenChange,
  onSelect,
}: TemplatePickerProps) {
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<EscalationTemplate | null>(
    null,
  );

  const { data, isLoading } = useQuery({
    queryKey: ["escalation-templates", { is_active: true }],
    queryFn: () => listEscalationTemplates({ is_active: true, limit: 200 }),
    enabled: open,
  });

  const templates = data?.templates ?? [];
  const filtered =
    categoryFilter === "all"
      ? templates
      : templates.filter((t) => t.category === categoryFilter);

  function handleConfirm() {
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
      setSelected(null);
      setCategoryFilter("all");
    }
  }

  function handleCancel() {
    onOpenChange(false);
    setSelected(null);
    setCategoryFilter("all");
  }

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose Escalation Template</DialogTitle>
          <DialogDescription>
            Select a template to pre-fill the escalation form. You can
            customise all fields after selection.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 py-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filtered.length} template{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Loading templates…
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No templates found.
            </p>
          ) : (
            filtered.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                isSelected={selected?.id === tpl.id}
                onSelect={setSelected}
              />
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            Use Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TemplateCardProps {
  template: EscalationTemplate;
  isSelected: boolean;
  onSelect: (template: EscalationTemplate) => void;
}

function TemplateCard({ template, isSelected, onSelect }: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={cn(
        "w-full text-left rounded-lg border p-4 transition-colors hover:bg-muted/50",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{template.name}</span>
            {template.is_system && (
              <Badge variant="secondary" className="text-xs gap-1">
                <ShieldAlert className="h-3 w-3" />
                System
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {CATEGORY_LABELS[template.category]}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded font-medium",
                SEVERITY_COLORS[template.severity] ??
                  "bg-gray-100 text-gray-700",
              )}
            >
              {SEVERITY_LABELS[template.severity]}
            </span>
          </div>
          {template.description_template && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {template.description_template}
            </p>
          )}
          {template.suggested_actions && template.suggested_actions.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {template.suggested_actions.length} suggested action
              {template.suggested_actions.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {isSelected && (
          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        )}
      </div>
    </button>
  );
}
