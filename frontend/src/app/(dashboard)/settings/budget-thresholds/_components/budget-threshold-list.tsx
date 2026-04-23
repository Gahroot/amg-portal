"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  useCreateApprovalThreshold,
  useUpdateApprovalThreshold,
  useDeleteApprovalThreshold,
} from "@/hooks/use-budget-approvals";
import type {
  ApprovalThreshold,
  ApprovalChainSummary,
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
import { Plus, Pencil, Trash2 } from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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

  const [form, setForm] = useState<ThresholdFormState>(
    defaultThresholdForm
  );

  useEffect(() => {
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

  function handleSubmit(e: FormEvent) {
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
// Budget Threshold List
// ===================================================================

interface BudgetThresholdListProps {
  thresholds: ApprovalThreshold[];
  isLoading: boolean;
  chains: ApprovalChainSummary[];
}

export function BudgetThresholdList({
  thresholds,
  isLoading,
  chains,
}: BudgetThresholdListProps) {
  const deleteThreshold = useDeleteApprovalThreshold();

  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [editingThreshold, setEditingThreshold] =
    useState<ApprovalThreshold | null>(null);
  const [deleteThresholdId, setDeleteThresholdId] = useState<string | null>(
    null
  );

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
    <>
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
          {isLoading ? (
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
                        {formatCurrency(Number(t.min_amount))}
                        {" — "}
                        {t.max_amount != null
                          ? formatCurrency(Number(t.max_amount))
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

      <ThresholdDialog
        open={thresholdDialogOpen}
        onOpenChange={setThresholdDialogOpen}
        threshold={editingThreshold}
        chains={chains}
      />

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
    </>
  );
}
