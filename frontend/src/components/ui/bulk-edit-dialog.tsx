"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Edit3, Trash2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type {
  BulkEditConfig,
  BulkEditField,
  BulkEditResult,
} from "@/types/bulk-edit";
import api from "@/lib/api";

interface BulkEditDialogProps<TRecord> {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Records selected for bulk edit */
  selectedRecords: TRecord[];
  /** Configuration for bulk edit */
  config: BulkEditConfig<TRecord>;
  /** Callback when bulk edit completes successfully */
  onComplete?: (result: BulkEditResult) => void;
}

type Step = "select" | "preview" | "confirm";

/**
 * Bulk edit dialog for editing multiple records at once.
 *
 * Features:
 * - Field selector with type-appropriate inputs
 * - Preview of affected records
 * - Confirmation before applying changes
 * - Delete option (if enabled)
 * - Audit logging (handled by backend)
 *
 * @example
 * ```tsx
 * <BulkEditDialog
 *   open={bulkEditOpen}
 *   onOpenChange={setBulkEditOpen}
 *   selectedRecords={selectedTasks}
 *   config={{
 *     fields: [
 *       { key: "status", label: "Status", type: "select", options: statusOptions },
 *       { key: "priority", label: "Priority", type: "select", options: priorityOptions },
 *     ],
 *     getRowId: (task) => task.id,
 *     getRowLabel: (task) => task.title,
 *     endpoint: "/tasks/bulk-update",
 *   }}
 *   onComplete={handleBulkEditComplete}
 * />
 * ```
 */
export function BulkEditDialog<TRecord>({
  open,
  onOpenChange,
  selectedRecords,
  config,
  onComplete,
}: BulkEditDialogProps<TRecord>) {
  const [step, setStep] = useState<Step>("select");
  const [selectedField, setSelectedField] = useState<BulkEditField | null>(null);
  const [newValue, setNewValue] = useState<unknown>(null);
  const [clearValue, setClearValue] = useState(false);
  const [isDelete, setIsDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const maxPreviewRows = config.maxPreviewRows ?? 10;

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("select");
      setSelectedField(null);
      setNewValue(null);
      setClearValue(false);
      setIsDelete(false);
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  }, [open]);

  // Handle field selection
  const handleFieldChange = (fieldKey: string) => {
    const field = config.fields.find((f) => f.key === fieldKey);
    setSelectedField(field ?? null);
    setNewValue(null);
    setClearValue(false);
    setIsDelete(false);
  };

  // Handle delete action
  const handleDeleteClick = () => {
    setIsDelete(true);
    setSelectedField(null);
    setShowDeleteConfirm(true);
  };

  // Move to preview step
  const handleContinue = () => {
    if (isDelete || selectedField) {
      setStep("preview");
    }
  };

  // Execute bulk edit
  const handleApply = async () => {
    setIsSubmitting(true);

    try {
      const ids = selectedRecords.map(config.getRowId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let payload: any;

      if (isDelete) {
        payload = { ids, delete: true };
      } else if (config.buildPayload) {
        payload = config.buildPayload(ids, selectedField!.key, newValue, clearValue);
      } else {
        payload = {
          ids,
          field: selectedField!.key,
          value: selectedField!.transform ? selectedField!.transform(newValue) : newValue,
          clear: clearValue,
        };
      }

      const response = await api.post<BulkEditResult>(config.endpoint, payload);
      const result = response.data;

      // Show result toast
      if (result.failed.length > 0) {
        toast.warning(
          `Bulk edit completed with ${result.failed.length} error(s)`,
          {
            description: result.failed
              .slice(0, 3)
              .map((f) => f.error)
              .join("\n"),
          }
        );
      } else if (isDelete) {
        toast.success(`Successfully deleted ${result.deleted} record(s)`);
      } else {
        toast.success(`Successfully updated ${result.updated} record(s)`);
      }

      config.onSuccess?.(result);
      onComplete?.(result);
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to apply changes";
      toast.error("Bulk edit failed", { description: message });
      config.onError?.(error instanceof Error ? error : new Error(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render field-specific input
  const renderFieldInput = () => {
    if (!selectedField) return null;

    const field = selectedField;

    switch (field.type) {
      case "text":
        return (
          <Input
            value={(newValue as string) ?? ""}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={field.placeholder}
            disabled={clearValue}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={(newValue as number) ?? ""}
            onChange={(e) => setNewValue(e.target.valueAsNumber || null)}
            placeholder={field.placeholder}
            disabled={clearValue}
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={(newValue as string) ?? ""}
            onChange={(e) => setNewValue(e.target.value)}
            disabled={clearValue}
          />
        );

      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={newValue as boolean}
              onCheckedChange={(checked) => setNewValue(checked === true)}
              disabled={clearValue}
            />
            <Label>{field.label}</Label>
          </div>
        );

      case "select":
      case "user":
        return (
          <Select
            value={(newValue as string) ?? ""}
            onValueChange={setNewValue}
            disabled={clearValue}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder ?? "Select..."} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multiselect":
        const selectedValues = (newValue as string[]) ?? [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {selectedValues.map((v) => {
                const opt = field.options?.find((o) => o.value === v);
                return (
                  <Badge key={v} variant="secondary">
                    {opt?.label ?? v}
                    <button
                      className="ml-1 hover:text-destructive"
                      onClick={() => {
                        setNewValue(selectedValues.filter((sv) => sv !== v));
                      }}
                    >
                      ×
                    </button>
                  </Badge>
                );
              })}
            </div>
            <Select
              value=""
              onValueChange={(v) => {
                if (!selectedValues.includes(v)) {
                  setNewValue([...selectedValues, v]);
                }
              }}
              disabled={clearValue}
            >
              <SelectTrigger>
                <SelectValue placeholder="Add..." />
              </SelectTrigger>
              <SelectContent>
                {field.options
                  ?.filter((o) => !selectedValues.includes(o.value))
                  .map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        );

      default:
        return null;
    }
  };

  // Render preview of affected records
  const renderPreview = () => {
    const displayRecords = selectedRecords.slice(0, maxPreviewRows);
    const remainingCount = selectedRecords.length - maxPreviewRows;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>
            {isDelete
              ? `You are about to delete ${selectedRecords.length} record(s)`
              : `You are about to update "${selectedField?.label}" for ${selectedRecords.length} record(s)`}
          </span>
        </div>

        {!isDelete && (
          <div className="rounded-md bg-muted/50 p-3">
            <div className="text-sm font-medium">New Value:</div>
            <div className="mt-1 text-sm">
              {clearValue ? (
                <span className="text-muted-foreground italic">(cleared)</span>
              ) : (
                formatValue(newValue, selectedField)
              )}
            </div>
          </div>
        )}

        <Separator />

        <div className="text-sm font-medium">Affected Records:</div>
        <ScrollArea className="h-[200px] rounded-md border">
          <div className="divide-y">
            {displayRecords.map((record) => (
              <div
                key={config.getRowId(record)}
                className="flex items-center gap-2 px-3 py-2"
              >
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {config.getRowLabel?.(record) ?? config.getRowId(record)}
                </span>
              </div>
            ))}
            {remainingCount > 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                ... and {remainingCount} more
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const canContinue =
    isDelete || (selectedField && (clearValue || newValue !== null));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              {step === "select" && "Bulk Edit"}
              {step === "preview" && "Review Changes"}
            </DialogTitle>
            <DialogDescription>
              {step === "select" && (
                <>
                  {selectedRecords.length} record(s) selected. Choose a field to
                  edit or delete the selected records.
                </>
              )}
              {step === "preview" &&
                "Review your changes before applying them."}
            </DialogDescription>
          </DialogHeader>

          {step === "select" && (
            <div className="space-y-4">
              {/* Field selector */}
              <div className="space-y-2">
                <Label>Field to Edit</Label>
                <Select
                  value={selectedField?.key ?? ""}
                  onValueChange={handleFieldChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {config.fields.map((field) => (
                      <SelectItem key={field.key} value={field.key}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Value input */}
              {selectedField && (
                <div className="space-y-2">
                  <Label>New Value</Label>
                  {renderFieldInput()}
                  {selectedField.helpText && (
                    <p className="text-xs text-muted-foreground">
                      {selectedField.helpText}
                    </p>
                  )}
                  {selectedField.clearable && selectedField.type !== "boolean" && (
                    <div className="flex items-center gap-2 pt-2">
                      <Checkbox
                        checked={clearValue}
                        onCheckedChange={(checked) => {
                          setClearValue(checked === true);
                          if (checked) setNewValue(null);
                        }}
                      />
                      <Label className="text-sm font-normal">
                        Clear this field (set to empty)
                      </Label>
                    </div>
                  )}
                </div>
              )}

              {/* Delete option */}
              {config.enableDelete !== false && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-destructive">Delete Records</Label>
                      <p className="text-xs text-muted-foreground">
                        Permanently delete all selected records
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteClick}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === "preview" && renderPreview()}

          <DialogFooter>
            {step === "select" && (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button disabled={!canContinue} onClick={handleContinue}>
                  Continue
                </Button>
              </>
            )}

            {step === "preview" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep("select")}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  variant={isDelete ? "destructive" : "default"}
                  onClick={handleApply}
                  disabled={isSubmitting}
                >
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {isDelete
                    ? `Delete ${selectedRecords.length} Record(s)`
                    : "Apply Changes"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              {config.deleteConfirmMessage ??
                `Are you sure you want to delete ${selectedRecords.length} record(s)? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowDeleteConfirm(false);
                setStep("preview");
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Format a value for display in the preview.
 */
function formatValue(value: unknown, field: BulkEditField | null): string {
  if (value === null || value === undefined || value === "") {
    return "(empty)";
  }

  if (Array.isArray(value)) {
    return value
      .map((v) => field?.options?.find((o) => o.value === v)?.label ?? v)
      .join(", ");
  }

  if (field?.type === "select" || field?.type === "user") {
    return field.options?.find((o) => o.value === value)?.label ?? String(value);
  }

  if (field?.type === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

/**
 * Toolbar component for bulk actions.
 * Shows selection count and bulk edit button when rows are selected.
 */
interface BulkEditToolbarProps {
  /** Number of selected rows */
  selectedCount: number;
  /** Total number of rows */
  totalCount: number;
  /** Callback when bulk edit button is clicked */
  onBulkEdit: () => void;
  /** Callback to clear selection */
  onClearSelection: () => void;
  /** Callback to select all rows */
  onSelectAll?: () => void;
  /** Whether all rows are selected */
  isAllSelected?: boolean;
  /** Additional actions to show in the toolbar */
  additionalActions?: ReactNode;
  /** Custom label for the entity type */
  entityLabel?: string;
}

export function BulkEditToolbar({
  selectedCount,
  totalCount,
  onBulkEdit,
  onClearSelection,
  onSelectAll,
  isAllSelected,
  additionalActions,
  entityLabel = "record",
}: BulkEditToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-md bg-primary/10 px-4 py-2">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">
          {selectedCount} {entityLabel}
          {selectedCount !== 1 ? "s" : ""} selected
        </span>
        {onSelectAll && !isAllSelected && selectedCount < totalCount && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={onSelectAll}
          >
            Select all {totalCount} {entityLabel}
            {totalCount !== 1 ? "s" : ""}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {additionalActions}
        <Button size="sm" onClick={onBulkEdit}>
          <Edit3 className="h-4 w-4 mr-1" />
          Edit Selected
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

export default BulkEditDialog;
