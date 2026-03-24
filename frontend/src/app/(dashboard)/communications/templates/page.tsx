"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { useAuth } from "@/providers/auth-provider";
import {
  useAllTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useUpdateTemplateStatus,
} from "@/hooks/use-templates";
import type { CommunicationTemplate, TemplateStatus, TemplateType, VariableDefinition } from "@/types/communication";
import { ApprovalDialog } from "@/components/communications/ApprovalDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Pencil, Eye, Trash2, Search, MoreHorizontal, CheckCircle, XCircle, Send } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["managing_director", "relationship_manager", "coordinator"];

const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: "welcome", label: "Welcome" },
  { value: "program_kickoff", label: "Program Kickoff" },
  { value: "weekly_status", label: "Weekly Status" },
  { value: "decision_request", label: "Decision Request" },
  { value: "milestone_alert", label: "Milestone Alert" },
  { value: "completion_note", label: "Completion Note" },
  { value: "partner_dispatch", label: "Partner Dispatch" },
  { value: "deliverable_submission", label: "Deliverable Submission" },
  { value: "custom", label: "Custom" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TEMPLATE_TYPES.map((t) => [t.value, t.label])
);

// ─── Form types ───────────────────────────────────────────────────────────────

interface TemplateFormValues {
  name: string;
  template_type: TemplateType;
  subject: string;
  body: string;
  is_active: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract {{variable_name}} placeholders from a template body. */
function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{\s*(\w+)\s*\}\}/g) ?? [];
  const names = matches.map((m) => m.replace(/\{\{\s*|\s*\}\}/g, ""));
  return [...new Set(names)];
}

/** Build variable_definitions from detected placeholder names. */
function buildVariableDefinitions(
  body: string,
  subject: string
): Record<string, VariableDefinition> | undefined {
  const allVars = extractVariables(body + " " + subject);
  if (allVars.length === 0) return undefined;
  return Object.fromEntries(
    allVars.map((name) => [
      name,
      {
        type: "string",
        description: name.replace(/_/g, " "),
        required: true,
      } satisfies VariableDefinition,
    ])
  );
}

// ─── TemplateStatusBadge ──────────────────────────────────────────────────────

interface TemplateStatusBadgeProps {
  status: TemplateStatus;
}

function TemplateStatusBadge({ status }: TemplateStatusBadgeProps) {
  const configs: Record<TemplateStatus, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
    pending: { label: "Pending Review", className: "bg-amber-100 text-amber-700 border-amber-200" },
    approved: { label: "Approved", className: "bg-green-100 text-green-700 border-green-200" },
    rejected: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200" },
  };
  const config = configs[status] ?? configs.draft;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CommunicationTemplate | null;
}

function TemplateFormDialog({ open, onOpenChange, editing }: TemplateFormDialogProps) {
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormValues>({
    defaultValues: {
      name: "",
      template_type: "custom",
      subject: "",
      body: "",
      is_active: true,
    },
  });

  // Populate form when editing
  React.useEffect(() => {
    if (open) {
      if (editing) {
        reset({
          name: editing.name,
          template_type: editing.template_type,
          subject: editing.subject ?? "",
          body: editing.body,
          is_active: editing.is_active,
        });
      } else {
        reset({
          name: "",
          template_type: "custom",
          subject: "",
          body: "",
          is_active: true,
        });
      }
    }
  }, [open, editing, reset]);

  const isActiveValue = watch("is_active");
  const bodyValue = watch("body");
  const detectedVars = extractVariables(bodyValue + " " + (watch("subject") ?? ""));

  const isPending = createMutation.isPending || updateMutation.isPending || isSubmitting;

  const onSubmit = async (values: TemplateFormValues) => {
    const variableDefs = buildVariableDefinitions(values.body, values.subject);
    const payload = {
      name: values.name,
      template_type: values.template_type,
      subject: values.subject || undefined,
      body: values.body,
      variable_definitions: variableDefs,
    };

    if (editing) {
      await updateMutation.mutateAsync({
        id: editing.id,
        data: { ...payload, is_active: values.is_active },
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Template" : "New Template"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the template details below."
              : "Create a new communication template. Use {{variable_name}} syntax for dynamic content."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tmpl-name"
              placeholder="e.g. Weekly Status Update"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Template Type */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-type">
              Template Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch("template_type")}
              onValueChange={(v) => setValue("template_type", v as TemplateType)}
            >
              <SelectTrigger id="tmpl-type">
                <SelectValue placeholder="Select a type…" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-subject">Subject</Label>
            <Input
              id="tmpl-subject"
              placeholder="e.g. Your {{program_title}} — Week {{week_number}} Update"
              {...register("subject")}
            />
            <p className="text-xs text-muted-foreground">
              Optional email subject line. Supports {"{{variable}}"} placeholders.
            </p>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-body">
              Body <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="tmpl-body"
              rows={10}
              className="font-mono text-sm"
              placeholder={"Dear {{client_name}},\n\nYour programme update for this week…"}
              {...register("body", { required: "Body is required" })}
            />
            {errors.body && (
              <p className="text-xs text-destructive">{errors.body.message}</p>
            )}
            {detectedVars.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                <span className="text-xs text-muted-foreground mr-1">Detected variables:</span>
                {detectedVars.map((v) => (
                  <Badge key={v} variant="outline" className="text-xs font-mono">
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Active toggle — only shown when editing */}
          {editing && (
            <div className="flex items-center gap-3">
              <Switch
                id="tmpl-active"
                checked={isActiveValue}
                onCheckedChange={(checked) => setValue("is_active", checked)}
              />
              <Label htmlFor="tmpl-active" className="cursor-pointer">
                Active
              </Label>
              <span className="text-xs text-muted-foreground">
                Inactive templates are hidden from the compose flow.
              </span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Preview Dialog ───────────────────────────────────────────────────────────

interface PreviewDialogProps {
  template: CommunicationTemplate | null;
  onClose: () => void;
}

function PreviewDialog({ template, onClose }: PreviewDialogProps) {
  if (!template) return null;

  const allVars = template.variable_definitions
    ? Object.keys(template.variable_definitions)
    : extractVariables((template.subject ?? "") + " " + template.body);

  return (
    <Dialog open={!!template} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview — {template.name}</DialogTitle>
          <DialogDescription>
            Template body shown with placeholders. Fill in variables when composing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata row */}
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{TYPE_LABEL[template.template_type] ?? template.template_type}</Badge>
            <Badge variant={template.is_active ? "default" : "outline"}>
              {template.is_active ? "Active" : "Inactive"}
            </Badge>
            {template.is_system && <Badge variant="secondary">System</Badge>}
            <TemplateStatusBadge status={template.status} />
          </div>

          {/* Rejection reason */}
          {template.status === "rejected" && template.rejection_reason && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <span className="font-medium">Rejection reason:</span> {template.rejection_reason}
            </div>
          )}

          {/* Subject */}
          {template.subject && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Subject
              </p>
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono">
                {template.subject}
              </p>
            </div>
          )}

          {/* Body */}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Body
            </p>
            <pre className="rounded-md border bg-muted/40 p-3 text-sm font-mono whitespace-pre-wrap leading-relaxed">
              {template.body}
            </pre>
          </div>

          {/* Variable reference */}
          {allVars.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Variables
              </p>
              <div className="rounded-md border divide-y">
                {allVars.map((name) => {
                  const def = template.variable_definitions?.[name];
                  return (
                    <div key={name} className="flex items-start gap-3 px-3 py-2 text-sm">
                      <code className="text-xs font-mono text-primary shrink-0">{`{{${name}}}`}</code>
                      <span className="text-muted-foreground">{def?.description ?? name.replace(/_/g, " ")}</span>
                      {def?.required && (
                        <Badge variant="outline" className="ml-auto text-xs shrink-0">required</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

interface DeleteDialogProps {
  template: CommunicationTemplate | null;
  onClose: () => void;
}

function DeleteDialog({ template, onClose }: DeleteDialogProps) {
  const deleteMutation = useDeleteTemplate();

  const handleConfirm = async () => {
    if (!template) return;
    await deleteMutation.mutateAsync(template.id);
    onClose();
  };

  return (
    <AlertDialog open={!!template} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Template</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to permanently delete{" "}
            <strong>{template?.name}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const { user } = useAuth();
  const isMD = user?.role === "managing_director";

  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [approvalFilter, setApprovalFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<CommunicationTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = React.useState<CommunicationTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CommunicationTemplate | null>(null);

  // Approval dialog state
  const [approvalTarget, setApprovalTarget] = React.useState<CommunicationTemplate | null>(null);
  const [approvalAction, setApprovalAction] = React.useState<"approve" | "reject">("approve");

  const statusMutation = useUpdateTemplateStatus();

  const { data, isLoading } = useAllTemplates(
    typeFilter !== "all" ? { template_type: typeFilter } : undefined
  );

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to manage communication templates.
        </p>
      </div>
    );
  }

  // Client-side filtering
  const templates = (data?.templates ?? []).filter((t) => {
    if (statusFilter === "active" && !t.is_active) return false;
    if (statusFilter === "inactive" && t.is_active) return false;
    if (approvalFilter !== "all" && t.status !== approvalFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.template_type.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const openNew = () => {
    setEditingTemplate(null);
    setFormOpen(true);
  };

  const openEdit = (t: CommunicationTemplate) => {
    setEditingTemplate(t);
    setFormOpen(true);
  };

  const openApprovalDialog = (t: CommunicationTemplate, action: "approve" | "reject") => {
    setApprovalTarget(t);
    setApprovalAction(action);
  };

  const handleSubmitForApproval = async (t: CommunicationTemplate) => {
    await statusMutation.mutateAsync({ id: t.id, data: { action: "submit" } });
  };

  const handleApprovalConfirm = async (reason?: string) => {
    if (!approvalTarget) return;
    await statusMutation.mutateAsync({
      id: approvalTarget.id,
      data: { action: approvalAction, reason },
    });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Communication Templates
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage reusable message templates for client and partner communications.
            </p>
          </div>
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TEMPLATE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={approvalFilter} onValueChange={setApprovalFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All approvals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All approvals</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading templates…
          </div>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      {data?.templates.length === 0
                        ? "No templates found. Create your first template to get started."
                        : "No templates match the current filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.name}
                        {t.status === "rejected" && t.rejection_reason && (
                          <p className="text-xs text-red-600 mt-0.5 truncate max-w-[200px]" title={t.rejection_reason}>
                            {t.rejection_reason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {TYPE_LABEL[t.template_type] ?? t.template_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.is_active ? "default" : "outline"}>
                          {t.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TemplateStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        {t.is_system ? (
                          <Badge variant="secondary">System</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(t.updated_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Preview template"
                            onClick={() => setPreviewTemplate(t)}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Preview</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title={t.is_system ? "System templates cannot be edited" : "Edit template"}
                            disabled={t.is_system}
                            onClick={() => openEdit(t)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title={t.is_system ? "System templates cannot be deleted" : "Delete template"}
                            disabled={t.is_system}
                            onClick={() => setDeleteTarget(t)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>

                          {/* Approval workflow actions */}
                          {!t.is_system && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  title="More actions"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">More</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {/* Submit for approval — available when draft or rejected */}
                                {(t.status === "draft" || t.status === "rejected") && (
                                  <DropdownMenuItem
                                    onClick={() => handleSubmitForApproval(t)}
                                    disabled={statusMutation.isPending}
                                  >
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit for Approval
                                  </DropdownMenuItem>
                                )}

                                {/* Approve / Reject — MD only, pending templates */}
                                {isMD && t.status === "pending" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => openApprovalDialog(t, "approve")}
                                      className="text-green-700 focus:text-green-700"
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => openApprovalDialog(t, "reject")}
                                      className="text-red-700 focus:text-red-700"
                                    >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Reject
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Count */}
        {!isLoading && data && (
          <p className="text-sm text-muted-foreground">
            Showing {templates.length} of {data.total} template
            {data.total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Dialogs */}
      <TemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editingTemplate}
      />

      <PreviewDialog
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
      />

      <DeleteDialog
        template={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />

      {approvalTarget && (
        <ApprovalDialog
          open={!!approvalTarget}
          onOpenChange={(open) => { if (!open) setApprovalTarget(null); }}
          templateName={approvalTarget.name}
          action={approvalAction}
          onConfirm={handleApprovalConfirm}
        />
      )}
    </div>
  );
}
