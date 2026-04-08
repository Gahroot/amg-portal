"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  type PartnerCapability,
  type ProficiencyLevel,
  PROFICIENCY_LABELS,
  PROFICIENCY_COLORS,
} from "@/types/partner-capability";

interface CapabilityMatrixProps {
  capabilities: PartnerCapability[];
  onAdd?: (data: {
    capability_name: string;
    proficiency_level: ProficiencyLevel;
    years_experience?: number;
    notes?: string;
  }) => Promise<void>;
  onUpdate?: (
    capabilityId: string,
    data: {
      capability_name?: string;
      proficiency_level?: ProficiencyLevel;
      years_experience?: number;
      notes?: string;
    }
  ) => Promise<void>;
  onDelete?: (capabilityId: string) => Promise<void>;
  onVerify?: (capabilityId: string) => Promise<void>;
  canEdit?: boolean;
  canVerify?: boolean;
}

export function CapabilityMatrix({
  capabilities,
  onAdd,
  onUpdate,
  onDelete,
  onVerify,
  canEdit = false,
  canVerify = false,
}: CapabilityMatrixProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingCapability, setEditingCapability] = React.useState<PartnerCapability | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Form state
  const [formState, setFormState] = React.useState({
    capability_name: "",
    proficiency_level: "intermediate" as ProficiencyLevel,
    years_experience: "",
    notes: "",
  });

  const resetForm = () => {
    setFormState({
      capability_name: "",
      proficiency_level: "intermediate",
      years_experience: "",
      notes: "",
    });
  };

  const handleAdd = async () => {
    if (!onAdd || !formState.capability_name.trim()) return;

    setIsLoading(true);
    try {
      await onAdd({
        capability_name: formState.capability_name.trim(),
        proficiency_level: formState.proficiency_level,
        years_experience: formState.years_experience
          ? parseFloat(formState.years_experience)
          : undefined,
        notes: formState.notes.trim() || undefined,
      });
      resetForm();
      setIsAddDialogOpen(false);
    } catch {
      toast.error("Failed to add capability");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!onUpdate || !editingCapability || !formState.capability_name.trim()) return;

    setIsLoading(true);
    try {
      await onUpdate(editingCapability.id, {
        capability_name: formState.capability_name.trim(),
        proficiency_level: formState.proficiency_level,
        years_experience: formState.years_experience
          ? parseFloat(formState.years_experience)
          : undefined,
        notes: formState.notes.trim() || undefined,
      });
      setEditingCapability(null);
      resetForm();
    } catch (error) {
      console.error("Failed to update capability:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (capabilityId: string) => {
    if (!onDelete) return;
    if (!confirm("Are you sure you want to delete this capability?")) return;

    try {
      await onDelete(capabilityId);
    } catch {
      toast.error("Failed to delete capability");
    }
  };

  const handleVerify = async (capabilityId: string) => {
    if (!onVerify) return;

    try {
      await onVerify(capabilityId);
    } catch (error) {
      console.error("Failed to verify capability:", error);
    }
  };

  const openEditDialog = (capability: PartnerCapability) => {
    setEditingCapability(capability);
    setFormState({
      capability_name: capability.capability_name,
      proficiency_level: capability.proficiency_level,
      years_experience: capability.years_experience?.toString() || "",
      notes: capability.notes || "",
    });
  };

  const ProficiencyIndicator = ({ level }: { level: ProficiencyLevel }) => {
    const dotCount = level === "beginner" ? 1 : level === "intermediate" ? 2 : 3;
    return (
      <div className="flex items-center gap-1">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < dotCount ? "bg-current" : "bg-muted"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Capability Matrix</CardTitle>
        {canEdit && onAdd && (
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Capability
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {capabilities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No capabilities added yet.</p>
            {canEdit && onAdd && (
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setIsAddDialogOpen(true)}
              >
                Add your first capability
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {capabilities.map((capability) => (
              <div
                key={capability.id}
                className="flex items-center justify-between p-3 rounded-md border"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {capability.capability_name}
                      </p>
                      {capability.verified && (
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                          <Check className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge className={PROFICIENCY_COLORS[capability.proficiency_level]}>
                        <ProficiencyIndicator level={capability.proficiency_level} />
                        <span className="ml-2 text-xs">
                          {PROFICIENCY_LABELS[capability.proficiency_level]}
                        </span>
                      </Badge>
                      {capability.years_experience !== null && (
                        <span className="text-xs text-muted-foreground">
                          {capability.years_experience} years exp.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!capability.verified && canVerify && onVerify && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVerify(capability.id)}
                      title="Verify capability"
                    >
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </Button>
                  )}
                  {canEdit && (
                    <>
                      {onUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(capability)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(capability.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog
        open={isAddDialogOpen || !!editingCapability}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingCapability(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCapability ? "Edit Capability" : "Add Capability"}
            </DialogTitle>
            <DialogDescription>
              {editingCapability
                ? "Update the capability details below."
                : "Add a new skill or capability to the partner's profile."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="capability_name">Capability Name</Label>
              <Input
                id="capability_name"
                value={formState.capability_name}
                onChange={(e) =>
                  setFormState({ ...formState, capability_name: e.target.value })
                }
                placeholder="e.g., Investment Advisory, Tax Planning"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proficiency_level">Proficiency Level</Label>
              <Select
                value={formState.proficiency_level}
                onValueChange={(value: ProficiencyLevel) =>
                  setFormState({ ...formState, proficiency_level: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select proficiency level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="years_experience">Years of Experience</Label>
              <Input
                id="years_experience"
                type="number"
                step="0.5"
                min="0"
                value={formState.years_experience}
                onChange={(e) =>
                  setFormState({ ...formState, years_experience: e.target.value })
                }
                placeholder="e.g., 5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formState.notes}
                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                placeholder="Additional notes about this capability"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingCapability(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingCapability ? handleUpdate : handleAdd}
              disabled={isLoading || !formState.capability_name.trim()}
            >
              {isLoading
                ? "Saving..."
                : editingCapability
                  ? "Update"
                  : "Add Capability"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
