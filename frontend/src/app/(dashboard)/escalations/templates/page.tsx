"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  listEscalationTemplates,
  createEscalationTemplate,
  updateEscalationTemplate,
  deleteEscalationTemplate,
} from "@/lib/api/escalation-templates";
import type {
  EscalationTemplate,
  EscalationTemplateCategory,
  EscalationTemplateSeverity,
  EscalationTemplateCreate,
} from "@/types/escalation-template";
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
} from "@/types/escalation-template";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

const CATEGORY_OPTIONS: { value: EscalationTemplateCategory; label: string }[] =
  [
    { value: "partner_sla_breach", label: "Partner SLA Breach" },
    { value: "client_dissatisfaction", label: "Client Dissatisfaction" },
    { value: "resource_unavailable", label: "Resource Unavailable" },
    { value: "budget_overrun", label: "Budget Overrun" },
    { value: "timeline_delay", label: "Timeline Delay" },
    { value: "quality_issue", label: "Quality Issue" },
  ];

const SEVERITY_OPTIONS: { value: EscalationTemplateSeverity; label: string }[] =
  [
    { value: "task", label: "Task" },
    { value: "milestone", label: "Milestone" },
    { value: "program", label: "Program" },
    { value: "client_impact", label: "Client Impact" },
  ];

const SEVERITY_COLORS: Record<string, string> = {
  task: "bg-blue-100 text-blue-800",
  milestone: "bg-amber-100 text-amber-800",
  program: "bg-orange-100 text-orange-800",
  client_impact: "bg-red-100 text-red-800",
};

const ALLOWED_ROLES = ["managing_director"];

interface TemplateFormState {
  name: string;
  category: EscalationTemplateCategory;
  severity: EscalationTemplateSeverity;
  description_template: string;
  suggested_actions_text: string;
  notification_template: string;
  is_active: boolean;
}

const DEFAULT_FORM: TemplateFormState = {
  name: "",
  category: "partner_sla_breach",
  severity: "milestone",
  description_template: "",
  suggested_actions_text: "",
  notification_template: "",
  is_active: true,
};

function formToPayload(form: TemplateFormState): EscalationTemplateCreate {
  const actions = form.suggested_actions_text
    .split("\n")
    .map((a) => a.trim())
    .filter(Boolean);
  return {
    name: form.name.trim(),
    category: form.category,
    severity: form.severity,
    description_template: form.description_template.trim() || undefined,
    suggested_actions: actions.length > 0 ? actions : undefined,
    notification_template: form.notification_template.trim() || undefined,
    is_active: form.is_active,
  };
}

function templateToForm(tpl: EscalationTemplate): TemplateFormState {
  return {
    name: tpl.name,
    category: tpl.category,
    severity: tpl.severity,
    description_template: tpl.description_template ?? "",
    suggested_actions_text: (tpl.suggested_actions ?? []).join("\n"),
    notification_template: tpl.notification_template ?? "",
    is_active: tpl.is_active,
  };
}

export default function EscalationTemplatesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role && ALLOWED_ROLES.includes(user.role);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<EscalationTemplate | null>(null);
  const [form, setForm] = React.useState<TemplateFormState>(DEFAULT_FORM);
  const [deleteTarget, setDeleteTarget] =
    React.useState<EscalationTemplate | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["escalation-templates"],
    queryFn: () => listEscalationTemplates({ limit: 200 }),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: createEscalationTemplate,
    onSuccess: () => {
      toast.success("Template created");
      queryClient.invalidateQueries({ queryKey: ["escalation-templates"] });
      setFormOpen(false);
    },
    onError: () => toast.error("Failed to create template"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateEscalationTemplate>[1] }) =>
      updateEscalationTemplate(id, data),
    onSuccess: () => {
      toast.success("Template updated");
      queryClient.invalidateQueries({ queryKey: ["escalation-templates"] });
      setFormOpen(false);
    },
    onError: () => toast.error("Failed to update template"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEscalationTemplate,
    onSuccess: () => {
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ["escalation-templates"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete template"),
  });

  function openCreate() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setFormOpen(true);
  }

  function openEdit(tpl: EscalationTemplate) {
    setEditing(tpl);
    setForm(templateToForm(tpl));
    setFormOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (editing) {
      // System templates: only is_active may change
      if (editing.is_system) {
        updateMutation.mutate({ id: editing.id, data: { is_active: form.is_active } });
      } else {
        updateMutation.mutate({ id: editing.id, data: formToPayload(form) });
      }
    } else {
      createMutation.mutate(formToPayload(form));
    }
  }

  const templates = data?.templates ?? [];
  const systemTemplates = templates.filter((t) => t.is_system);
  const customTemplates = templates.filter((t) => !t.is_system);

  if (!user) return null;

  if (!isAdmin && !["coordinator", "relationship_manager", "finance_compliance"].includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/escalations">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Escalations
              </Button>
            </Link>
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight">
                Escalation Templates
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Pre-defined templates with suggested actions for common escalation scenarios
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading templates…</p>
        ) : (
          <>
            {/* System Templates */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  System Templates
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {systemTemplates.length}
                </Badge>
              </div>
              <TemplateTable
                templates={systemTemplates}
                isAdmin={!!isAdmin}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            </section>

            {/* Custom Templates */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Custom Templates
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {customTemplates.length}
                </Badge>
              </div>
              {customTemplates.length === 0 ? (
                <div className="rounded-md border bg-white p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No custom templates yet.
                    {isAdmin && (
                      <> Click <strong>New Template</strong> to create one.</>
                    )}
                  </p>
                </div>
              ) : (
                <TemplateTable
                  templates={customTemplates}
                  isAdmin={!!isAdmin}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              )}
            </section>
          </>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? (editing.is_system ? "Edit System Template" : "Edit Template") : "New Template"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name *</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={!!editing?.is_system}
                placeholder="e.g. Partner SLA Breach – Critical"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v as EscalationTemplateCategory }))
                  }
                  disabled={!!editing?.is_system}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, severity: v as EscalationTemplateSeverity }))
                  }
                  disabled={!!editing?.is_system}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Description Template</Label>
              <Textarea
                id="tpl-desc"
                value={form.description_template}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description_template: e.target.value }))
                }
                disabled={!!editing?.is_system}
                rows={4}
                placeholder="Use {placeholders} for dynamic values, e.g. {partner_name}, {deadline}"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-actions">
                Suggested Actions
                <span className="text-xs text-muted-foreground ml-1">(one per line)</span>
              </Label>
              <Textarea
                id="tpl-actions"
                value={form.suggested_actions_text}
                onChange={(e) =>
                  setForm((f) => ({ ...f, suggested_actions_text: e.target.value }))
                }
                disabled={!!editing?.is_system}
                rows={5}
                placeholder={"Contact partner immediately\nDocument the breach\nNotify client"}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-notif">Notification Template</Label>
              <Textarea
                id="tpl-notif"
                value={form.notification_template}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notification_template: e.target.value }))
                }
                disabled={!!editing?.is_system}
                rows={2}
                placeholder="Short notification message for alerts"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="tpl-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="tpl-active">Active</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TemplateTableProps {
  templates: EscalationTemplate[];
  isAdmin: boolean;
  onEdit: (tpl: EscalationTemplate) => void;
  onDelete: (tpl: EscalationTemplate) => void;
}

function TemplateTable({
  templates,
  isAdmin,
  onEdit,
  onDelete,
}: TemplateTableProps) {
  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Actions</TableHead>
            <TableHead>Status</TableHead>
            {isAdmin && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((tpl) => (
            <TableRow key={tpl.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {tpl.name}
                  {tpl.is_system && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      System
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {CATEGORY_LABELS[tpl.category]}
              </TableCell>
              <TableCell>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    SEVERITY_COLORS[tpl.severity] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {SEVERITY_LABELS[tpl.severity]}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {tpl.suggested_actions?.length ?? 0} suggested
              </TableCell>
              <TableCell>
                <Badge variant={tpl.is_active ? "default" : "secondary"}>
                  {tpl.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(tpl)}
                      title="Edit template"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!tpl.is_system && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(tpl)}
                        title="Delete template"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
