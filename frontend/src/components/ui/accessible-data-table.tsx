"use client";

import { createContext, useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Row,
  type RowSelectionState,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { VisuallyHidden } from "./visually-hidden";

interface AccessibleDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Accessible caption for the table */
  caption?: string;
  /** Message to show when there's no data */
  emptyMessage?: string;
  /** Unique ID for each row (used for accessibility) */
  getRowId?: (row: TData) => string;
  /** Whether rows are selectable */
  selectable?: boolean;
  /** Currently selected rows */
  selectedRows?: RowSelectionState;
  /** Callback when row selection changes */
  onSelectionChange?: (selection: RowSelectionState) => void;
  /** Whether the table is loading */
  loading?: boolean;
  /** Additional class name */
  className?: string;
  /** Callback when a row is clicked */
  onRowClick?: (row: Row<TData>) => void;
  /** Keyboard navigation mode */
  navigationMode?: "row" | "cell";
}

interface TableContextValue {
  navigateMode: "row" | "cell";
  onRowClick?: (row: Row<any>) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const TableContext = createContext<TableContextValue>({
  navigateMode: "row",
});

/**
 * Accessible data table component with full keyboard navigation.
 * Supports row selection, keyboard navigation, and screen reader announcements.
 *
 * @example
 * <AccessibleDataTable
 *   columns={columns}
 *   data={users}
 *   caption="User list"
 *   selectable
 *   onSelectionChange={handleSelection}
 * />
 */
export function AccessibleDataTable<TData, TValue>({
  columns,
  data,
  caption,
  emptyMessage = "No results.",
  getRowId,
  selectable = false,
  selectedRows = {},
  onSelectionChange,
  loading = false,
  className,
  onRowClick,
  navigationMode = "row",
}: AccessibleDataTableProps<TData, TValue>) {
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(0);
  const [focusedCellIndex, setFocusedCellIndex] = useState<number>(0);
  const tableRef = useRef<HTMLTableElement>(null);
  const announceRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId ? (row: TData) => getRowId(row) : undefined,
    state: {
      rowSelection: selectedRows,
    },
    enableRowSelection: selectable,
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === "function" ? updater(selectedRows) : updater;
      onSelectionChange?.(newSelection);
    },
  });

  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();

  // Announce changes to screen readers
  const announce = useCallback((message: string) => {
    if (announceRef.current) {
      announceRef.current.textContent = message;
    }
  }, []);

  // Handle keyboard navigation
  const handleTableKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const totalRows = rows.length;
      const totalCols = columns.length;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setFocusedRowIndex((prev) => Math.min(prev + 1, totalRows - 1));
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedRowIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "ArrowRight":
          if (navigationMode === "cell") {
            event.preventDefault();
            setFocusedCellIndex((prev) => Math.min(prev + 1, totalCols - 1));
          }
          break;
        case "ArrowLeft":
          if (navigationMode === "cell") {
            event.preventDefault();
            setFocusedCellIndex((prev) => Math.max(prev - 1, 0));
          }
          break;
        case "Home":
          event.preventDefault();
          if (event.ctrlKey) {
            setFocusedRowIndex(0);
            setFocusedCellIndex(0);
          } else {
            setFocusedCellIndex(0);
          }
          break;
        case "End":
          event.preventDefault();
          if (event.ctrlKey) {
            setFocusedRowIndex(totalRows - 1);
            setFocusedCellIndex(totalCols - 1);
          } else {
            setFocusedCellIndex(totalCols - 1);
          }
          break;
        case " ":
          if (selectable && focusedRowIndex >= 0 && focusedRowIndex < totalRows) {
            event.preventDefault();
            const row = rows[focusedRowIndex];
            row.toggleSelected?.(!row.getIsSelected());
            announce(
              row.getIsSelected()
                ? `Row ${focusedRowIndex + 1} deselected`
                : `Row ${focusedRowIndex + 1} selected`
            );
          }
          break;
        case "Enter":
          if (onRowClick && focusedRowIndex >= 0 && focusedRowIndex < totalRows) {
            event.preventDefault();
            onRowClick(rows[focusedRowIndex] as Row<any>); // eslint-disable-line @typescript-eslint/no-explicit-any
          }
          break;
        case "a":
          if (event.ctrlKey && selectable) {
            event.preventDefault();
            table.toggleAllRowsSelected(!table.getIsAllRowsSelected());
            announce(
              table.getIsAllRowsSelected()
                ? "All rows deselected"
                : "All rows selected"
            );
          }
          break;
      }
    },
    [rows, columns.length, navigationMode, selectable, focusedRowIndex, onRowClick, table, announce]
  );

  // Focus management
  useEffect(() => {
    if (tableRef.current && rows.length > 0) {
      const cells = tableRef.current.querySelectorAll(
        "tbody tr td, tbody tr th"
      );
      const targetIndex =
        navigationMode === "cell"
          ? focusedRowIndex * columns.length + focusedCellIndex
          : focusedRowIndex * columns.length;
      const targetCell = cells[targetIndex] as HTMLElement;
      targetCell?.focus();
    }
  }, [focusedRowIndex, focusedCellIndex, rows.length, columns.length, navigationMode]);

  return (
    <TableContext.Provider
      value={{ navigateMode: navigationMode, onRowClick }}
    >
      <div className={cn("relative", className)}>
        {/* Screen reader announcements */}
        <div
          ref={announceRef}
          role="status"
          aria-live="polite"
          className="sr-only"
        />

        {/* Loading overlay */}
        {loading && (
          <div
            className="absolute inset-0 bg-background/50 flex items-center justify-center z-10"
            role="status"
            aria-label="Loading data"
          >
            <span className="sr-only">Loading...</span>
          </div>
        )}

        <div className="rounded-md border">
          <table
            ref={tableRef}
            role="grid"
            aria-rowcount={rows.length}
            aria-colcount={columns.length}
            aria-busy={loading}
            onKeyDown={handleTableKeyDown}
            className="w-full"
          >
            {/* Caption for screen readers */}
            {caption && (
              <caption className="sr-only text-left">{caption}</caption>
            )}

            <TableHeader headerGroups={headerGroups} selectable={selectable} />
            <TableBody
              rows={rows}
              selectable={selectable}
              emptyMessage={emptyMessage}
              focusedRowIndex={focusedRowIndex}
              focusedCellIndex={focusedCellIndex}
              columnsLength={columns.length}
            />
          </table>
        </div>

        {/* Selection summary */}
        {selectable && (
          <div
            className="mt-2 text-sm text-muted-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            {Object.keys(selectedRows).length > 0 && (
              <span>
                {Object.keys(selectedRows).length} of {data.length} rows selected
              </span>
            )}
          </div>
        )}
      </div>
    </TableContext.Provider>
  );
}

interface TableHeaderProps {
  headerGroups: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  selectable: boolean;
}

function TableHeader({ headerGroups, selectable }: TableHeaderProps) {
  return (
    <thead>
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id} role="row">
          {selectable && (
            <th
              role="columnheader"
              scope="col"
              className="w-12 px-2 py-3 text-left"
              aria-label="Select all rows"
            >
              <VisuallyHidden>Select row</VisuallyHidden>
            </th>
          )}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {headerGroup.headers.map((header: any, index: number) => (
            <th
              key={header.id}
              role="columnheader"
              scope="col"
              aria-colindex={index + 1}
              className="h-10 px-2 text-left align-middle font-medium text-muted-foreground"
            >
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
            </th>
          ))}
        </tr>
      ))}
    </thead>
  );
}

interface TableBodyProps {
  rows: Row<any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  selectable: boolean;
  emptyMessage: string;
  focusedRowIndex: number;
  focusedCellIndex: number;
  columnsLength: number;
}

function TableBody({
  rows,
  selectable,
  emptyMessage,
  focusedRowIndex,
  focusedCellIndex,
  columnsLength,
}: TableBodyProps) {
  if (rows.length === 0) {
    return (
      <tbody>
        <tr role="row">
          <td
            colSpan={columnsLength + (selectable ? 1 : 0)}
            className="py-8 text-center text-muted-foreground"
            role="cell"
          >
            {emptyMessage}
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody>
      {rows.map((row, rowIndex) => (
        <tr
          key={row.id}
          role="row"
          aria-rowindex={rowIndex + 1}
          data-state={row.getIsSelected() ? "selected" : undefined}
          className={cn(
            "border-b transition-colors hover:bg-muted/50",
            row.getIsSelected() && "bg-muted"
          )}
        >
          {selectable && (
            <td
              role="gridcell"
              tabIndex={rowIndex === focusedRowIndex ? 0 : -1}
              className="w-12 px-2 py-3"
            >
              <input
                type="checkbox"
                checked={row.getIsSelected()}
                onChange={row.getToggleSelectedHandler()}
                aria-label={`Select row ${rowIndex + 1}`}
                className="h-4 w-4 rounded border-border"
              />
            </td>
          )}
          {row.getVisibleCells().map((cell, cellIndex) => (
            <td
              key={cell.id}
              role="gridcell"
              tabIndex={
                rowIndex === focusedRowIndex &&
                cellIndex === focusedCellIndex
                  ? 0
                  : -1
              }
              aria-colindex={cellIndex + 1 + (selectable ? 1 : 0)}
              className="px-2 py-3 align-middle"
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export { AccessibleDataTable as default };
