"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
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
import { ColumnResizer } from "@/components/ui/column-customizer";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Message to show when there's no data */
  emptyMessage?: string;
  /** Unique ID for each row */
  getRowId?: (row: TData) => string;
  /** Whether rows are selectable (enables bulk edit) */
  selectable?: boolean;
  /** Currently selected rows (controlled) */
  selectedRows?: RowSelectionState;
  /** Callback when row selection changes */
  onSelectionChange?: (selection: RowSelectionState) => void;
  /** Additional class name */
  className?: string;
  /** Column visibility state */
  columnVisibility?: VisibilityState;
  /** Callback when column visibility changes */
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  /** Column order state (for reordering) */
  columnOrder?: ColumnOrderState;
  /** Callback when column order changes */
  onColumnOrderChange?: (order: ColumnOrderState) => void;
  /** Column sizing state (for resizing) */
  columnSizing?: ColumnSizingState;
  /** Callback when column sizing changes */
  onColumnSizingChange?: (sizing: ColumnSizingState) => void;
  /** Column resize mode: 'onChange' (live) or 'onEnd' (after drag) */
  columnResizeMode?: "onChange" | "onEnd";
  /** Enable column resizing */
  enableColumnResizing?: boolean;
}

/**
 * Data table component with optional row selection and column customization support.
 *
 * When `selectable` is true, adds a checkbox column for row selection.
 * Use with `BulkEditDialog` and `BulkEditToolbar` for bulk edit functionality.
 *
 * Supports column visibility, ordering, and resizing via TanStack Table APIs.
 *
 * @example
 * ```tsx
 * const [selection, setSelection] = useState<RowSelectionState>({});
 *
 * <DataTable
 *   columns={columns}
 *   data={tasks}
 *   selectable
 *   getRowId={(row) => row.id}
 *   selectedRows={selection}
 *   onSelectionChange={setSelection}
 *   enableColumnResizing
 *   columnVisibility={visibility}
 *   columnOrder={order}
 *   columnSizing={sizing}
 * />
 * ```
 */
export function DataTable<TData, TValue>({
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
  columnOrder,
  onColumnOrderChange,
  columnSizing,
  onColumnSizingChange,
  columnResizeMode = "onEnd",
  enableColumnResizing = false,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId as ((row: TData) => string) | undefined,
    state: {
      rowSelection: selectedRows,
      columnVisibility: columnVisibility,
      columnOrder: columnOrder,
      columnSizing: columnSizing,
    },
    enableRowSelection: selectable,
    enableColumnResizing,
    columnResizeMode,
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
    onColumnOrderChange: (updater) => {
      if (onColumnOrderChange) {
        const newOrder =
          typeof updater === "function"
            ? updater(columnOrder ?? [])
            : updater;
        onColumnOrderChange(newOrder);
      }
    },
    onColumnSizingChange: (updater) => {
      if (onColumnSizingChange) {
        const newSizing =
          typeof updater === "function"
            ? updater(columnSizing ?? {})
            : updater;
        onColumnSizingChange(newSizing);
      }
    },
  });

  const selectedCount = Object.keys(selectedRows).length;

  // Calculate column sizes for CSS variables (performance optimization)
  const columnSizeVars = React.useMemo(() => {
    if (!enableColumnResizing) return {};

    const headers = table.getFlatHeaders();
    const colSizes: Record<string, string> = {};

    for (const header of headers) {
      const size = header.getSize();
      colSizes[`--header-${header.id}-size`] = `${size}px`;
      colSizes[`--col-${header.column.id}-size`] = `${size}px`;
    }

    return colSizes;
  }, [table, enableColumnResizing]);

  return (
    <div className={cn("rounded-md border bg-card", className)}>
      <Table
        style={{
          ...columnSizeVars,
          width: enableColumnResizing ? table.getTotalSize() : undefined,
          minWidth: "100%",
        }}
      >
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
              {headerGroup.headers.map((header) => {
                const canResize = enableColumnResizing && header.column.getCanResize();

                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(canResize && "relative select-none")}
                    style={{
                      width: enableColumnResizing
                        ? `calc(var(--header-${header.id}-size) * 1px)`
                        : undefined,
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {canResize && (
                      <ColumnResizer
                        isResizing={header.column.getIsResizing()}
                        onMouseDown={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                      />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(row.getIsSelected() && "bg-muted/50")}
              >
                {selectable && (
                  <TableCell className="w-12">
                    <Checkbox
                      checked={row.getIsSelected()}
                      onCheckedChange={(value) => row.toggleSelected(!!value)}
                      aria-label="Select row"
                    />
                  </TableCell>
                )}
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{
                      width: enableColumnResizing
                        ? `calc(var(--col-${cell.column.id}-size) * 1px)`
                        : undefined,
                    }}
                  >
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

/**
 * Helper function to get selected row IDs from selection state.
 */
export function getSelectedRowIds(
  selection: RowSelectionState
): string[] {
  return Object.keys(selection).filter((key) => selection[key]);
}

/**
 * Helper function to get selected row data from selection state and data array.
 */
export function getSelectedRows<TData>(
  selection: RowSelectionState,
  data: TData[],
  getRowId: (row: TData) => string
): TData[] {
  return data.filter((row) => selection[getRowId(row)]);
}

export default DataTable;
