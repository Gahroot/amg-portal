"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  EditableCell,
  type CellEditState,
  type ValidationResult,
  type EditableCellProps,
} from "@/components/ui/editable-cell";

/**
 * Editable cell configuration (excluded props that are provided by table)
 */
export type EditableCellConfig = Omit<
  EditableCellProps,
  "value" | "rowId" | "columnId" | "isEditing" | "onStartEdit" | "onCancelEdit" | "onSave"
>;

/**
 * Editable column definition - combines ColumnDef with editable properties
 */
export type EditableColumnDef<TData, TValue = unknown> = ColumnDef<TData, TValue> & {
  /** Unique column identifier (required for editable columns) */
  id?: string;
  /** Whether this column is editable */
  editable?: boolean;
  /** Editable cell configuration */
  editableConfig?: EditableCellConfig;
};

/**
 * Props for EditableTable component
 */
export interface EditableTableProps<TData> {
  /** Column definitions with editable config */
  columns: EditableColumnDef<TData, unknown>[];
  /** Table data */
  data: TData[];
  /** Message to show when there's no data */
  emptyMessage?: string;
  /** Unique ID for each row */
  getRowId?: (row: TData) => string;
  /** Whether rows are selectable */
  selectable?: boolean;
  /** Currently selected rows */
  selectedRows?: RowSelectionState;
  /** Callback when selection changes */
  onSelectionChange?: (selection: RowSelectionState) => void;
  /** Additional class name */
  className?: string;
  /** Column visibility state */
  columnVisibility?: VisibilityState;
  /** Callback when column visibility changes */
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  /** Callback when a cell value is saved */
  onCellSave?: (rowId: string, columnId: string, value: unknown) => Promise<ValidationResult | void> | ValidationResult | void;
  /** Callback when a cell value changes (for optimistic updates) */
  onCellChange?: (rowId: string, columnId: string, value: unknown) => void;
  /** Custom validation function for cells */
  onCellValidate?: (rowId: string, columnId: string, value: unknown) => ValidationResult | Promise<ValidationResult>;
  /** Custom edit state management (controlled mode) */
  editingCell?: CellEditState | null;
  /** Callback when edit state changes */
  onEditingCellChange?: (cell: CellEditState | null) => void;
  /** Saving state for specific cells */
  savingCells?: Record<string, boolean>;
  /** Error state for specific cells */
  cellErrors?: Record<string, string | null>;
  /** Whether to use optimistic updates */
  optimisticUpdates?: boolean;
  /** Whether the entire table is disabled */
  disabled?: boolean;
}

/**
 * EditableTable - A data table component with inline editing support.
 *
 * Features:
 * - Click to edit cells
 * - Save on blur or Enter
 * - Cancel on Escape
 * - Validation support
 * - Visual feedback (hover, saving, error)
 *
 * @example
 * ```tsx
 * const columns: EditableColumnDef<User>[] = [
 *   {
 *     id: "name",
 *     accessorKey: "name",
 *     header: "Name",
 *     editable: true,
 *     editableConfig: {
 *       type: "text",
 *       validationRules: { required: true },
 *     },
 *   },
 *   {
 *     id: "status",
 *     accessorKey: "status",
 *     header: "Status",
 *     editable: true,
 *     editableConfig: {
 *       type: "select",
 *       options: [
 *         { value: "active", label: "Active" },
 *         { value: "inactive", label: "Inactive" },
 *       ],
 *     },
 *   },
 * ];
 *
 * <EditableTable
 *   columns={columns}
 *   data={users}
 *   getRowId={(row) => row.id}
 *   onCellSave={handleSave}
 * />
 * ```
 */
export function EditableTable<TData>({
  columns,
  data,
  emptyMessage = "No results.",
  getRowId,
  selectable = false,
  selectedRows = {},
  onSelectionChange,
  className,
  columnVisibility,
  onColumnVisibilityChange,
  onCellSave,
  onCellChange,
  onCellValidate,
  editingCell: controlledEditingCell,
  onEditingCellChange,
  savingCells = {},
  cellErrors = {},
  optimisticUpdates = true,
  disabled = false,
}: EditableTableProps<TData>) {
  // Internal edit state (uncontrolled mode)
  const [internalEditingCell, setInternalEditingCell] = useState<CellEditState | null>(null);
  
  // Use controlled or internal state
  const editingCell = controlledEditingCell ?? internalEditingCell;
  const setEditingCell = useCallback((cell: CellEditState | null) => {
    if (onEditingCellChange) {
      onEditingCellChange(cell);
    } else {
      setInternalEditingCell(cell);
    }
  }, [onEditingCellChange]);

  // Internal saving state
  const [internalSavingCells, setInternalSavingCells] = useState<Record<string, boolean>>({});
  const isCellSaving = useCallback((rowId: string, columnId: string) =>
    savingCells[`${rowId}.${columnId}`] ?? internalSavingCells[`${rowId}.${columnId}`] ?? false,
  [savingCells, internalSavingCells]);

  // Internal error state
  const [internalCellErrors, setInternalCellErrors] = useState<Record<string, string | null>>({});
  const getCellError = useCallback((rowId: string, columnId: string) =>
    cellErrors[`${rowId}.${columnId}`] ?? internalCellErrors[`${rowId}.${columnId}`] ?? null,
  [cellErrors, internalCellErrors]);

  // Optimistic data state
  const [optimisticData, setOptimisticData] = useState<Record<string, Record<string, unknown>>>({});

  // Start editing a cell
  const handleStartEdit = useCallback((rowId: string, columnId: string) => {
    setEditingCell({ rowId, columnId });
    // Clear any previous error
    setInternalCellErrors((prev) => {
      const next = { ...prev };
      delete next[`${rowId}.${columnId}`];
      return next;
    });
  }, [setEditingCell]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
  }, [setEditingCell]);

  // Save cell value
  const handleSave = useCallback(
    async (rowId: string, columnId: string, value: unknown): Promise<ValidationResult | void> => {
      const cellKey = `${rowId}.${columnId}`;

      // Set saving state
      setInternalSavingCells((prev) => ({ ...prev, [cellKey]: true }));

      try {
        // Optimistic update
        if (optimisticUpdates) {
          setOptimisticData((prev) => ({
            ...prev,
            [rowId]: { ...prev[rowId], [columnId]: value },
          }));
          onCellChange?.(rowId, columnId, value);
        }

        // Call save handler
        const result = await onCellSave?.(rowId, columnId, value);

        // Handle result
        if (result && !result.isValid) {
          // Revert optimistic update on failure
          if (optimisticUpdates) {
            setOptimisticData((prev) => {
              const rowUpdates = { ...prev[rowId] };
              delete rowUpdates[columnId];
              const newData = { ...prev };
              if (Object.keys(rowUpdates).length === 0) {
                delete newData[rowId];
              } else {
                newData[rowId] = rowUpdates;
              }
              return newData;
            });
          }
          setInternalCellErrors((prev) => ({ ...prev, [cellKey]: result.error ?? "Save failed" }));
          return result;
        }

        // Success - clear editing state
        setEditingCell(null);
        setInternalCellErrors((prev) => {
          const next = { ...prev };
          delete next[cellKey];
          return next;
        });

        return result;
      } catch (error) {
        // Revert optimistic update on error
        if (optimisticUpdates) {
          setOptimisticData((prev) => {
            const rowUpdates = { ...prev[rowId] };
            delete rowUpdates[columnId];
            const newData = { ...prev };
            if (Object.keys(rowUpdates).length === 0) {
              delete newData[rowId];
            } else {
              newData[rowId] = rowUpdates;
            }
            return newData;
          });
        }
        const errorMessage = error instanceof Error ? error.message : "Save failed";
        setInternalCellErrors((prev) => ({ ...prev, [cellKey]: errorMessage }));
        return { isValid: false, error: errorMessage };
      } finally {
        setInternalSavingCells((prev) => {
          const next = { ...prev };
          delete next[cellKey];
          return next;
        });
      }
    },
    [onCellSave, onCellChange, optimisticUpdates, setEditingCell]
  );

  // Validate cell
  const handleValidate = useCallback(
    async (rowId: string, columnId: string, value: unknown): Promise<ValidationResult> => {
      return onCellValidate?.(rowId, columnId, value) ?? { isValid: true };
    },
    [onCellValidate]
  );

  // Transform columns to include editable cell renderers
  const tableColumns = useMemo(() => {
    return columns.map((column) => {
      const editableCol = column as EditableColumnDef<TData>;
      const colId = editableCol.id ?? (column as { accessorKey?: string }).accessorKey ?? "";
      
      if (editableCol.editable && editableCol.editableConfig) {
        return {
          ...column,
          id: colId,
          cell: ({ row, getValue }: { row: { id: string }; getValue: () => unknown }) => {
            const _cellKey = `${row.id}.${colId}`;
            const isEditing =
              editingCell?.rowId === row.id && editingCell?.columnId === colId;
            const isSaving = isCellSaving(row.id, colId);
            const error = getCellError(row.id, colId);
            
            // Get optimistic value or original value
            const optimisticValue = optimisticData[row.id]?.[colId];
            const value = optimisticValue !== undefined ? optimisticValue : getValue();

            const cellProps = {
              ...editableCol.editableConfig!,
              value,
              rowId: row.id,
              columnId: colId,
              isEditing,
              isSaving,
              error: error,
              onStartEdit: handleStartEdit,
              onCancelEdit: handleCancelEdit,
              onSave: handleSave,
              validate: (val: unknown) => handleValidate(row.id, colId, val),
              editable: !disabled,
            } as EditableCellProps;

            return <EditableCell {...cellProps} />;
          },
        };
      }
      return column;
    });
  }, [
    columns,
    editingCell,
    handleStartEdit,
    handleCancelEdit,
    handleSave,
    handleValidate,
    disabled,
    optimisticData,
    getCellError,
    isCellSaving,
  ]);

  // Create table instance
  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId as ((row: TData) => string) | undefined,
    state: {
      rowSelection: selectedRows,
      columnVisibility: columnVisibility,
    },
    enableRowSelection: selectable,
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === "function" ? updater(selectedRows) : updater;
      onSelectionChange?.(newSelection);
    },
    onColumnVisibilityChange: (updater) => {
      if (onColumnVisibilityChange) {
        const newVisibility =
          typeof updater === "function"
            ? updater(columnVisibility ?? {})
            : updater;
        onColumnVisibilityChange(newVisibility);
      }
    },
  });

  const selectedCount = Object.keys(selectedRows).length;

  return (
    <div className={cn("rounded-md border bg-card", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      table.getIsAllPageRowsSelected() ||
                      (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) =>
                      table.toggleAllPageRowsSelected(!!value)
                    }
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(
                  row.getIsSelected() && "bg-muted/50",
                  editingCell?.rowId === row.id && "bg-accent/50"
                )}
              >
                {selectable && (
                  <TableCell className="w-12">
                    <Checkbox
                      checked={row.getIsSelected()}
                      onCheckedChange={(value) =>
                        row.toggleSelected(!!value)
                      }
                      aria-label="Select row"
                    />
                  </TableCell>
                )}
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="relative">
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Selection indicator */}
      {selectable && selectedCount > 0 && (
        <div className="border-t px-4 py-2 text-sm text-muted-foreground">
          {selectedCount} of {data.length} row(s) selected
        </div>
      )}
    </div>
  );
}

export default EditableTable;
