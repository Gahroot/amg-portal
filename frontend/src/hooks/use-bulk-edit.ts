"use client";

import * as React from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import type { BulkEditResult } from "@/types/bulk-edit";

interface UseBulkEditOptions<TRecord> {
  /** Function to get unique ID from a record */
  getRowId: (record: TRecord) => string;
  /** Callback when bulk edit completes successfully */
  onSuccess?: (result: BulkEditResult) => void;
  /** All available records */
  records: TRecord[];
}

interface UseBulkEditReturn<TRecord> {
  /** Current row selection state */
  selection: RowSelectionState;
  /** Set selection state */
  setSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  /** Selected records (derived from selection) */
  selectedRecords: TRecord[];
  /** IDs of selected records */
  selectedIds: string[];
  /** Number of selected records */
  selectedCount: number;
  /** Whether bulk edit dialog is open */
  isDialogOpen: boolean;
  /** Open bulk edit dialog */
  openDialog: () => void;
  /** Close bulk edit dialog */
  closeDialog: () => void;
  /** Set dialog open state */
  setDialogOpen: (open: boolean) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Select all records */
  selectAll: () => void;
  /** Toggle a specific row's selection */
  toggleRow: (id: string) => void;
  /** Whether all records are selected */
  isAllSelected: boolean;
  /** Handle successful bulk edit completion */
  handleComplete: (result: BulkEditResult) => void;
}

/**
 * Hook for managing bulk edit state in data tables.
 *
 * Provides selection state management, dialog control, and
 * derived data for bulk edit operations.
 *
 * @example
 * ```tsx
 * const bulkEdit = useBulkEdit({
 *   getRowId: (task) => task.id,
 *   records: tasks,
 *   onSuccess: (result) => {
 *     toast.success(`Updated ${result.updated} tasks`);
 *     refetch();
 *   },
 * });
 *
 * return (
 *   <>
 *     <BulkEditToolbar
 *       selectedCount={bulkEdit.selectedCount}
 *       onBulkEdit={bulkEdit.openDialog}
 *       onClearSelection={bulkEdit.clearSelection}
 *     />
 *     <DataTable
 *       selectable
 *       selectedRows={bulkEdit.selection}
 *       onSelectionChange={bulkEdit.setSelection}
 *     />
 *     <BulkEditDialog
 *       open={bulkEdit.isDialogOpen}
 *       onOpenChange={bulkEdit.setDialogOpen}
 *       selectedRecords={bulkEdit.selectedRecords}
 *       config={bulkEditConfig}
 *       onComplete={bulkEdit.handleComplete}
 *     />
 *   </>
 * );
 * ```
 */
export function useBulkEdit<TRecord>({
  getRowId,
  records,
  onSuccess,
}: UseBulkEditOptions<TRecord>): UseBulkEditReturn<TRecord> {
  const [selection, setSelection] = React.useState<RowSelectionState>({});
  const [isDialogOpen, setDialogOpen] = React.useState(false);

  // Derive selected records from selection state
  const selectedRecords = React.useMemo(() => {
    return records.filter((record) => selection[getRowId(record)]);
  }, [records, selection, getRowId]);

  const selectedIds = React.useMemo(() => {
    return selectedRecords.map(getRowId);
  }, [selectedRecords, getRowId]);

  const selectedCount = selectedRecords.length;

  const isAllSelected =
    records.length > 0 && selectedCount === records.length;

  const clearSelection = React.useCallback(() => {
    setSelection({});
  }, []);

  const selectAll = React.useCallback(() => {
    const newSelection: RowSelectionState = {};
    records.forEach((record) => {
      newSelection[getRowId(record)] = true;
    });
    setSelection(newSelection);
  }, [records, getRowId]);

  const toggleRow = React.useCallback((id: string) => {
    setSelection((prev) => {
      const newSelection = { ...prev };
      if (newSelection[id]) {
        delete newSelection[id];
      } else {
        newSelection[id] = true;
      }
      return newSelection;
    });
  }, []);

  const openDialog = React.useCallback(() => {
    if (selectedCount > 0) {
      setDialogOpen(true);
    }
  }, [selectedCount]);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleComplete = React.useCallback(
    (result: BulkEditResult) => {
      clearSelection();
      closeDialog();
      onSuccess?.(result);
    },
    [clearSelection, closeDialog, onSuccess]
  );

  return {
    selection,
    setSelection,
    selectedRecords,
    selectedIds,
    selectedCount,
    isDialogOpen,
    openDialog,
    closeDialog,
    setDialogOpen,
    clearSelection,
    selectAll,
    toggleRow,
    isAllSelected,
    handleComplete,
  };
}

export default useBulkEdit;
