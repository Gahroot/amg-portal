"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  useCreateApprovalChain,
  useUpdateApprovalChain,
  useAddChainStep,
} from "@/hooks/use-budget-approvals";
import type {
  ApprovalChainSummary,
  ApprovalChainStepCreate,
} from "@/types/budget-approval";
import { Button } from "@/components/ui/button";
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

// Roles available for chain steps — matches backend UserRole enum
export const APPROVER_ROLES = [
  { value: "relationship_manager", label: "Relationship Manager" },
  { value: "managing_director", label: "Managing Director" },
  { value: "finance_compliance", label: "Finance / Compliance" },
  { value: "partner_manager", label: "Partner Manager" },
  { value: "program_coordinator", label: "Program Coordinator" },
  { value: "admin", label: "Admin" },
];

// ===================================================================
// Chain Dialog (create / edit name + description)
// ===================================================================

interface ChainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chain?: ApprovalChainSummary | null;
}

export function ChainDialog({ open, onOpenChange, chain }: ChainDialogProps) {
  const createChain = useCreateApprovalChain();
  const updateChain = useUpdateApprovalChain();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
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

  function handleSubmit(e: FormEvent) {
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

export function AddStepDialog({
  open,
  onOpenChange,
  chainId,
  nextStepNumber,
}: AddStepDialogProps) {
  const addStep = useAddChainStep();

  const [stepNumber, setStepNumber] = useState(nextStepNumber);
  const [requiredRole, setRequiredRole] = useState("");
  const [isParallel, setIsParallel] = useState(false);
  const [timeoutHours, setTimeoutHours] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);

  useEffect(() => {
    if (open) {
      setStepNumber(nextStepNumber);
      setRequiredRole("");
      setIsParallel(false);
      setTimeoutHours("");
      setAutoApprove(false);
    }
  }, [open, nextStepNumber]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const data: ApprovalChainStepCreate = {
      step_number: stepNumber,
      required_role: requiredRole as ApprovalChainStepCreate["required_role"],
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
