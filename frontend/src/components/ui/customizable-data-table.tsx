"use client";

import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { ColumnCustomizer } from "@/components/ui/column-customizer";
import {
  useTableColumns,
  type ColumnMeta,
} from "@/hooks/use-table-columns";
import { cn } from "@/lib/utils";

/**
 * Props for CustomizableDataTable component
 */
export interface CustomizableDataTableProps<TData, TValue> {
  /** Unique identifier for the table (used for persistence) */
  tableId: string;
  /** Column definitions */
  columns: ColumnDef<TData, TValue>[];
  /** Column metadata for customization UI */
  columnMeta: ColumnMeta[];
  /** Data to display */
  data: TData[];
  /** Message to show when there's no data */
  emptyMessage?: string;
  /** Unique ID for each row */
  getRowId?: (row: TData) => string;
  /** Whether rows are selectable */
  selectable?: boolean;
  /** Currently selected rows */
  selectedRows?: RowSelectionState;
  /** Callback when row selection changes */
  onSelectionChange?: (selection: RowSelectionState) => void;
  /** Additional class name */
  className?: string;
  /** Whether to show the column customizer toolbar */
  showColumnCustomizer?: boolean;
  /** Class name for the toolbar container */
  toolbarClassName?: string;
  /** Additional toolbar elements to render before the customizer */
  toolbarContent?: React.ReactNode;
  /** Enable column resizing */
  enableColumnResizing?: boolean;
}

/**
 * A data table with built-in column customization support.
 *
 * This component wraps DataTable with column visibility, ordering, and sizing
 * capabilities, plus a ColumnCustomizer dropdown in the toolbar.
 *
 * @example
 * ```tsx
 * const columns: ColumnDef<Client>[] = [
 *   { accessorKey: "name", header: "Name" },
 *   { accessorKey: "email", header: "Email" },
 *   { accessorKey: "status", header: "Status" },
 * ];
 *
 * const columnMeta: ColumnMeta[] = [
 *   { id: "name", label: "Name", required: true, defaultWidth: 200 },
 *   { id: "email", label: "Email", defaultWidth: 250 },
 *   { id: "status", label: "Status", defaultWidth: 120, minWidth: 100 },
 * ];
 *
 * <CustomizableDataTable
 *   tableId="clients-table"
 *   columns={columns}
 *   columnMeta={columnMeta}
 *   data={clients}
 *   showColumnCustomizer
 *   enableColumnResizing
 * />
 * ```
 */
export function CustomizableDataTable<TData, TValue>({
  tableId,
  columns,
  columnMeta,
  data,
  emptyMessage = "No results.",
  getRowId,
  selectable = false,
  selectedRows = {},
  onSelectionChange,
  className,
  showColumnCustomizer = true,
  toolbarClassName,
  toolbarContent,
  enableColumnResizing = true,
}: CustomizableDataTableProps<TData, TValue>) {
  const {
    columnVisibility,
    columnOrder,
    columnSizing,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onColumnSizingChange,
    resetColumns,
  } = useTableColumns({
    tableId,
    columns: columnMeta,
    defaultOrder: columnMeta.map((c) => c.id),
  });

  // Handler for ColumnCustomizer visibility change
  const handleVisibilityChange = (columnId: string, visible: boolean) => {
    onColumnVisibilityChange({
      ...columnVisibility,
      [columnId]: visible,
    });
  };

  // Handler for ColumnCustomizer order change
  const handleOrderChange = (order: string[]) => {
    onColumnOrderChange(order);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      {showColumnCustomizer && (
        <div
          className={cn(
            "flex items-center justify-between gap-2",
            toolbarClassName
          )}
        >
          <div className="flex items-center gap-2">
            {toolbarContent}
          </div>
          <ColumnCustomizer
            columns={columnMeta}
            columnVisibility={columnVisibility as Record<string, boolean>}
            columnOrder={columnOrder}
            onVisibilityChange={handleVisibilityChange}
            onOrderChange={handleOrderChange}
            onReset={resetColumns}
          />
        </div>
      )}

      {/* Data table */}
      <DataTable
        columns={columns}
        data={data}
        emptyMessage={emptyMessage}
        getRowId={getRowId}
        selectable={selectable}
        selectedRows={selectedRows}
        onSelectionChange={onSelectionChange}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={onColumnVisibilityChange}
        columnOrder={columnOrder}
        onColumnOrderChange={onColumnOrderChange}
        columnSizing={columnSizing}
        onColumnSizingChange={onColumnSizingChange}
        enableColumnResizing={enableColumnResizing}
        columnResizeMode="onEnd"
      />
    </div>
  );
}

export default CustomizableDataTable;
