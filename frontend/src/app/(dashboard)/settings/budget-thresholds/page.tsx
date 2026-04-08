"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  useApprovalThresholds,
  useCreateApprovalThreshold,
  useUpdateApprovalThreshold,
  useDeleteApprovalThreshold,
  useApprovalChains,
  useApprovalChain,
  useCreateApprovalChain,
  useUpdateApprovalChain,
  useDeleteApprovalChain,
  useAddChainStep,
  useRemoveChainStep,
} from "@/hooks/use-budget-approvals";
import type {
  ApprovalThreshold,
  ApprovalChainSummary,
  ApprovalChainStepCreate,
} from "@/types/budget-approval";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
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
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ArrowLeft,
  GripVertical,
  X,
} from "lucide-react";

const ALLOWED_ROLES = ["managing_director"];

// Roles available for chain steps — matches backend UserRole enum
const APPROVER_ROLES = [
  { value: "relationship_manager", label: "Relationship Manager" },
  { value: "managing_director", label: "Managing Director" },
  { value: "finance_compliance", label: "Finance / Compliance" },
  { value: "partner_manager", label: "Partner Manager" },
  { value: "program_coordinator", label: "Program Coordinator" },
  { value: "admin", label: "Admin" },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRole(role: string): string {
  return (
    APPROVER_ROLES.find((r) => r.value === role)?.label ??
    role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ===================================================================
// Threshold Dialog
// ===================================================================

interface ThresholdFormState {
  name: string;
  description: string;
  min_amount: string;
  max_amount: string;
  approval_chain_id: string;
  priority: string;
  is_active: boolean;
}

const defaultThresholdForm: ThresholdFormState = {
  name: "",
  description: "",
  min_amount: "0",
  max_amount: "",
  approval_chain_id: "",
  priority: "0",
  is_active: true,
};

interface ThresholdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threshold?: ApprovalThreshold | null;
  chains: ApprovalChainSummary[];
}

function ThresholdDialog({
  open,
  onOpenChange,
  threshold,
  chains,
}: ThresholdDialogProps) {
  const createThreshold = useCreateApprovalThreshold();
  const updateThreshold = useUpdateApprovalThreshold();

  const [form, setForm] = React.useState<ThresholdFormState>(
    defaultThresholdForm
  );

  React.useEffect(() => {
    if (open) {
      if (threshold) {
        setForm({
          name: threshold.name,
          description: threshold.description ?? "",
          min_amount: String(threshold.min_amount),
          max_amount: threshold.max_amount != null ? String(threshold.max_amount) : "",
          approval_chain_id: threshold.approval_chain_id,
          priority: String(threshold.priority),
          is_active: threshold.is_active,
        });
      } else {
        setForm(defaultThresholdForm);
      }
    }
  }, [open, threshold]);

  const isEditing = !!threshold;
  const isPending = createThreshold.isPending || updateThreshold.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      min_amount: parseFloat(form.min_amount) || 0,
      max_amount: form.max_amount !== "" ? parseFloat(form.max_amount) : null,
      approval_chain_id: form.approval_chain_id,
      is_active: form.is_active,
      priority: parseInt(form.priority) || 0,
    };

    if (isEditing && threshold) {
      updateThreshold.mutate(
        { id: threshold.id, data: payload },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createThreshold.mutate(payload, {
        onSuccess: () => onOpenChange(false),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Threshold" : "Add Threshold"}
          </DialogTitle>
          <DialogDescription>
            Configure the budget range and approval chain for this threshold
            tier.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="th-name">Name *</Label>
            <Select
              value={form.name}
              onValueChange={(v) => setForm((f) => ({ ...f, name: v }))}
            >
              <SelectTrigger id="th-name">
                <SelectValue placeholder="Select tier…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Elevated">Elevated</SelectItem>
                <SelectItem value="Strategic">Strategic</SelectItem>
                <SelectItem value="Emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="th-description">Description</Label>
            <Input
              id="th-description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="e.g. RM sign-off required before activation"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="th-min">Min Amount ($) *</Label>
              <Input
                id="th-min"
                type="number"
                min={0}
                step={0.01}
                value={form.min_amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, min_amount: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="th-max">Max Amount ($)</Label>
              <Input
                id="th-max"
                type="number"
                min={0}
                step={0.01}
                value={form.max_amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, max_amount: e.target.value }))
                }
                placeholder="No limit"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="th-chain">Approval Chain *</Label>
            <Select
              value={form.approval_chain_id}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, approval_chain_id: v }))
              }
            >
              <SelectTrigger id="th-chain">
                <SelectValue placeholder="Select chain…" />
              </SelectTrigger>
              <SelectContent>
                {chains.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {!c.is_active && " (inactive)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="th-priority">Priority</Label>
              <Input
                id="th-priority"
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Higher = matched first
              </p>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.is_active ? "active" : "inactive"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, is_active: v === "active" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isPending || !form.name || !form.approval_chain_id
              }
            >
              {isPending
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                  ? "Save Changes"
                  : "Create Threshold"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===================================================================
// Chain Dialog (create / edit name + description)
// ===================================================================

interface ChainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chain?: ApprovalChainSummary | null;
}

function ChainDialog({ open, onOpenChange, chain }: ChainDialogProps) {
  const createChain = useCreateApprovalChain();
  const updateChain = useUpdateApprovalChain();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);

  React.useEffect(() => {
    if (open) {
      if (chain) {
        setName(chain.name);
        setDescription(chain.description ?? "");
        setIsActive(chain.is_active);
      } else {
        setName("");
        setDescription("");
        setIsActive(true);
      }
    }
  }, [open, chain]);

  const isEditing = !!chain;
  const isPending = createChain.isPending || updateChain.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      is_active: isActive,
    };

    if (isEditing && chain) {
      updateChain.mutate(
        { id: chain.id, data: payload },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createChain.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Approval Chain" : "New Approval Chain"}
          </DialogTitle>
          <DialogDescription>
            Name and describe this multi-level approval chain. Add steps after
            creation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ch-name">Name *</Label>
            <Input
              id="ch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. RM + MD Joint Approval"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-description">Description</Label>
            <Input
              id="ch-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Elevated spend requiring joint sign-off"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={isActive ? "active" : "inactive"}
              onValueChange={(v) => setIsActive(v === "active")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                  ? "Save Changes"
                  : "Create Chain"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===================================================================
// Add Step Dialog
// ===================================================================

interface AddStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chainId: string;
  nextStepNumber: number;
}

function AddStepDialog({
  open,
  onOpenChange,
  chainId,
  nextStepNumber,
}: AddStepDialogProps) {
  const addStep = useAddChainStep();

  const [stepNumber, setStepNumber] = React.useState(nextStepNumber);
  const [requiredRole, setRequiredRole] = React.useState("");
  const [isParallel, setIsParallel] = React.useState(false);
  const [timeoutHours, setTimeoutHours] = React.useState("");
  const [autoApprove, setAutoApprove] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStepNumber(nextStepNumber);
      setRequiredRole("");
      setIsParallel(false);
      setTimeoutHours("");
      setAutoApprove(false);
    }
  }, [open, nextStepNumber]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: ApprovalChainStepCreate = {
      step_number: stepNumber,
      required_role: requiredRole,
      is_parallel: isParallel,
      timeout_hours: timeoutHours !== "" ? parseInt(timeoutHours) : null,
      auto_approve_on_timeout: autoApprove,
    };
    addStep.mutate(
      { chainId, data },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Approval Step</DialogTitle>
          <DialogDescription>
            Define the role required to approve at this step in the chain.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="step-num">Step Number *</Label>
              <Input
                id="step-num"
                type="number"
                min={1}
                value={stepNumber}
                onChange={(e) => setStepNumber(parseInt(e.target.value) || 1)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="step-role">Required Role *</Label>
              <Select value={requiredRole} onValueChange={setRequiredRole}>
                <SelectTrigger id="step-role">
                  <SelectValue placeholder="Select role…" />
                </SelectTrigger>
                <SelectContent>
                  {APPROVER_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Parallel Step?</Label>
              <Select
                value={isParallel ? "yes" : "no"}
                onValueChange={(v) => setIsParallel(v === "yes")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No (sequential)</SelectItem>
                  <SelectItem value="yes">Yes (runs in parallel)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="step-timeout">Timeout (hours)</Label>
              <Input
                id="step-timeout"
                type="number"
                min={1}
                value={timeoutHours}
                onChange={(e) => setTimeoutHours(e.target.value)}
                placeholder="None"
              />
            </div>
          </div>

          {timeoutHours !== "" && (
            <div className="space-y-2">
              <Label>On Timeout</Label>
              <Select
                value={autoApprove ? "auto" : "escalate"}
                onValueChange={(v) => setAutoApprove(v === "auto")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="escalate">Escalate / stay pending</SelectItem>
                  <SelectItem value="auto">Auto-approve</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={addStep.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addStep.isPending || !requiredRole}
            >
              {addStep.isPending ? "Adding…" : "Add Step"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===================================================================
// Chain Detail View (steps management)
// ===================================================================

interface ChainDetailProps {
  chainId: string;
  onBack: () => void;
}

function ChainDetail({ chainId, onBack }: ChainDetailProps) {
  const { data: chain, isLoading } = useApprovalChain(chainId);
  const removeStep = useRemoveChainStep();
  const [addStepOpen, setAddStepOpen] = React.useState(false);
  const [deleteStepId, setDeleteStepId] = React.useState<string | null>(null);

  if (isLoading || !chain) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading chain details…
      </p>
    );
  }

  const sortedSteps = [...chain.steps].sort(
    (a, b) => a.step_number - b.step_number
  );
  const nextStepNumber =
    sortedSteps.length > 0
      ? sortedSteps[sortedSteps.length - 1].step_number + 1
      : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h3 className="font-semibold text-lg">{chain.name}</h3>
          {chain.description && (
            <p className="text-sm text-muted-foreground">{chain.description}</p>
          )}
        </div>
        <Badge
          variant={chain.is_active ? "default" : "secondary"}
          className="ml-auto"
        >
          {chain.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Required Role</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Timeout</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSteps.map((step) => (
              <TableRow key={step.id}>
                <TableCell>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </TableCell>
                <TableCell className="font-medium">
                  Step {step.step_number}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{formatRole(step.required_role)}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {step.is_parallel ? "Parallel" : "Sequential"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {step.timeout_hours != null ? (
                    <>
                      {step.timeout_hours}h
                      {step.auto_approve_on_timeout && (
                        <span className="ml-1 text-xs">(auto-approve)</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteStepId(step.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {sortedSteps.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-6 text-center text-muted-foreground"
                >
                  No steps configured. Add a step to define the approval flow.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setAddStepOpen(true)}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Step
      </Button>

      <AddStepDialog
        open={addStepOpen}
        onOpenChange={setAddStepOpen}
        chainId={chainId}
        nextStepNumber={nextStepNumber}
      />

      <AlertDialog
        open={!!deleteStepId}
        onOpenChange={(o) => !o && setDeleteStepId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Step?</AlertDialogTitle>
            <AlertDialogDescription>
              This step will be permanently removed from the approval chain. Any
              in-progress requests using this chain may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteStepId) {
                  removeStep.mutate(
                    { chainId, stepId: deleteStepId },
                    { onSuccess: () => setDeleteStepId(null) }
                  );
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===================================================================
// Main Page
// ===================================================================

export default function BudgetThresholdsPage() {
  const { user } = useAuth();

  const { data: thresholds = [], isLoading: thresholdsLoading } =
    useApprovalThresholds();
  const { data: chains = [], isLoading: chainsLoading } = useApprovalChains();

  const deleteThreshold = useDeleteApprovalThreshold();
  const deleteChain = useDeleteApprovalChain();

  // Threshold dialog state
  const [thresholdDialogOpen, setThresholdDialogOpen] = React.useState(false);
  const [editingThreshold, setEditingThreshold] =
    React.useState<ApprovalThreshold | null>(null);
  const [deleteThresholdId, setDeleteThresholdId] = React.useState<
    string | null
  >(null);

  // Chain dialog / detail state
  const [chainDialogOpen, setChainDialogOpen] = React.useState(false);
  const [editingChain, setEditingChain] =
    React.useState<ApprovalChainSummary | null>(null);
  const [deleteChainId, setDeleteChainId] = React.useState<string | null>(null);
  const [selectedChainId, setSelectedChainId] = React.useState<string | null>(
    null
  );

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  // Tier colour helpers
  const tierVariant = (
    name: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (name.toLowerCase()) {
      case "emergency":
        return "destructive";
      case "strategic":
        return "default";
      case "elevated":
        return "secondary";
      default:
        return "outline";
    }
  };

  const sortedThresholds = [...thresholds].sort(
    (a, b) => b.priority - a.priority
  );

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Settings className="mt-1 h-7 w-7 text-muted-foreground shrink-0" />
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Budget Approval Configuration
            </h1>
            <p className="mt-1 text-muted-foreground">
              Configure approval thresholds and multi-step approval chains that
              govern program budget requests.
            </p>
          </div>
        </div>

        {/* Reference Card */}
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              Governance Reference — Program Approval Tiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  tier: "Standard",
                  rule: "Below defined threshold",
                  approver: "Relationship Manager sign-off",
                },
                {
                  tier: "Elevated",
                  rule: "Above threshold",
                  approver: "RM + MD joint sign-off; MD review within 24h",
                },
                {
                  tier: "Strategic",
                  rule: "Complex / high-value",
                  approver: "Full Leadership Review — formal decision record",
                },
                {
                  tier: "Emergency",
                  rule: "Urgent activation",
                  approver: "MD verbal + retrospective formal within 4h",
                },
              ].map((row) => (
                <div
                  key={row.tier}
                  className="rounded-md border border-amber-200 dark:border-amber-800 bg-card/80 p-3"
                >
                  <p className="font-semibold text-amber-900 dark:text-amber-300 text-sm">
                    {row.tier}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {row.rule}
                  </p>
                  <p className="text-xs mt-1 text-amber-800 dark:text-amber-300">{row.approver}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ============================================================
            THRESHOLDS SECTION
            ============================================================ */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Approval Thresholds</CardTitle>
                <CardDescription>
                  Define the budget ranges that trigger each approval tier.
                  Thresholds are matched by priority (highest first).
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  setEditingThreshold(null);
                  setThresholdDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add Threshold
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {thresholdsLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading thresholds…
              </p>
            ) : (
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tier</TableHead>
                      <TableHead>Budget Range</TableHead>
                      <TableHead>Approval Chain</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedThresholds.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Badge variant={tierVariant(t.name)}>{t.name}</Badge>
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {formatCurrency(t.min_amount)}
                          {" — "}
                          {t.max_amount != null
                            ? formatCurrency(t.max_amount)
                            : "∞"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {t.approval_chain_name || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {t.priority}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={t.is_active ? "default" : "secondary"}
                          >
                            {t.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingThreshold(t);
                                setThresholdDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteThresholdId(t.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sortedThresholds.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No thresholds configured. Add one to start routing
                          approval requests.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* ============================================================
            APPROVAL CHAINS SECTION
            ============================================================ */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Approval Chains</CardTitle>
                <CardDescription>
                  Define multi-step approval workflows with ordered approver
                  roles. Click a chain to configure its steps.
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  setEditingChain(null);
                  setChainDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                New Chain
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {selectedChainId ? (
              <ChainDetail
                chainId={selectedChainId}
                onBack={() => setSelectedChainId(null)}
              />
            ) : chainsLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading chains…
              </p>
            ) : (
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chain Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Steps</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chains.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setSelectedChainId(c.id)}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1">
                            {c.name}
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.description ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {c.step_count}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={c.is_active ? "default" : "secondary"}
                          >
                            {c.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingChain(c);
                                setChainDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteChainId(c.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {chains.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No approval chains defined. Create one and add steps
                          to build an approval workflow.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================================
          DIALOGS
          ============================================================ */}

      <ThresholdDialog
        open={thresholdDialogOpen}
        onOpenChange={setThresholdDialogOpen}
        threshold={editingThreshold}
        chains={chains}
      />

      <ChainDialog
        open={chainDialogOpen}
        onOpenChange={setChainDialogOpen}
        chain={editingChain}
      />

      {/* Delete Threshold Confirmation */}
      <AlertDialog
        open={!!deleteThresholdId}
        onOpenChange={(o) => !o && setDeleteThresholdId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Threshold?</AlertDialogTitle>
            <AlertDialogDescription>
              This threshold will be permanently deleted. Existing approval
              requests that reference it will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteThresholdId) {
                  deleteThreshold.mutate(deleteThresholdId, {
                    onSuccess: () => setDeleteThresholdId(null),
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Chain Confirmation */}
      <AlertDialog
        open={!!deleteChainId}
        onOpenChange={(o) => !o && setDeleteChainId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Approval Chain?</AlertDialogTitle>
            <AlertDialogDescription>
              This chain and all its steps will be permanently deleted. Existing
              approval requests that reference it will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteChainId) {
                  deleteChain.mutate(deleteChainId, {
                    onSuccess: () => setDeleteChainId(null),
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
