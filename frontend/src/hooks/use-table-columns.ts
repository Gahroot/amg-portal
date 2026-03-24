"use client";

import { useCallback, useEffect, useMemo } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  VisibilityState,
  ColumnOrderState,
  ColumnSizingState,
} from "@tanstack/react-table";

/**
 * Column metadata for customization UI
 */
export interface ColumnMeta {
  /** Unique column identifier */
  id: string;
  /** Display name for the column */
  label: string;
  /** Whether the column can be hidden (default: true) */
  canHide?: boolean;
  /** Whether the column is required (cannot be hidden) */
  required?: boolean;
  /** Default width in pixels */
  defaultWidth?: number;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
}

/**
 * Table column configuration state
 */
export interface TableColumnConfig {
  /** Column visibility state */
  visibility: VisibilityState;
  /** Column order state */
  order: ColumnOrderState;
  /** Column sizing state */
  sizing: ColumnSizingState;
}

/**
 * Store state for table column configurations
 */
interface TableColumnStoreState {
  /** Column configurations per table ID */
  configs: Record<string, TableColumnConfig>;
}

/**
 * Store actions for table column configurations
 */
interface TableColumnStoreActions {
  /** Get column configuration for a table */
  getConfig: (tableId: string) => TableColumnConfig | undefined;
  /** Set column visibility for a table */
  setVisibility: (tableId: string, visibility: VisibilityState) => void;
  /** Set column order for a table */
  setOrder: (tableId: string, order: ColumnOrderState) => void;
  /** Set column sizing for a table */
  setSizing: (tableId: string, sizing: ColumnSizingState) => void;
  /** Reset column configuration for a table */
  resetConfig: (tableId: string) => void;
  /** Reset all column configurations */
  resetAll: () => void;
}

type TableColumnStore = TableColumnStoreState & TableColumnStoreActions;

/**
 * Zustand store for table column configurations
 * Uses localStorage to persist preferences
 */
export const useTableColumnStore = create<TableColumnStore>()(
  persist(
    (set, get) => ({
      configs: {},

      getConfig: (tableId) => {
        return get().configs[tableId];
      },

      setVisibility: (tableId, visibility) => {
        set((prev) => ({
          configs: {
            ...prev.configs,
            [tableId]: {
              ...prev.configs[tableId],
              visibility,
            },
          },
        }));
      },

      setOrder: (tableId, order) => {
        set((prev) => ({
          configs: {
            ...prev.configs,
            [tableId]: {
              ...prev.configs[tableId],
              order,
            },
          },
        }));
      },

      setSizing: (tableId, sizing) => {
        set((prev) => ({
          configs: {
            ...prev.configs,
            [tableId]: {
              ...prev.configs[tableId],
              sizing,
            },
          },
        }));
      },

      resetConfig: (tableId) => {
        set((prev) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [tableId]: _, ...remaining } = prev.configs;
          return { configs: remaining };
        });
      },

      resetAll: () => {
        set({ configs: {} });
      },
    }),
    {
      name: "amg-table-columns",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        configs: state.configs,
      }),
    }
  )
);

/**
 * Hook return type
 */
export interface UseTableColumnsResult {
  /** Current column visibility state */
  columnVisibility: VisibilityState;
  /** Current column order state */
  columnOrder: ColumnOrderState;
  /** Current column sizing state */
  columnSizing: ColumnSizingState;
  /** Column metadata for UI */
  columnMeta: ColumnMeta[];
  /** Handler for visibility changes */
  onColumnVisibilityChange: (visibility: VisibilityState) => void;
  /** Handler for order changes */
  onColumnOrderChange: (order: ColumnOrderState) => void;
  /** Handler for sizing changes */
  onColumnSizingChange: (sizing: ColumnSizingState) => void;
  /** Reset all column preferences for this table */
  resetColumns: () => void;
  /** Show a specific column */
  showColumn: (columnId: string) => void;
  /** Hide a specific column */
  hideColumn: (columnId: string) => void;
  /** Toggle a column's visibility */
  toggleColumn: (columnId: string) => void;
  /** Set column width */
  setColumnWidth: (columnId: string, width: number) => void;
  /** Reset a column's width */
  resetColumnWidth: (columnId: string) => void;
}

/**
 * Options for useTableColumns hook
 */
export interface UseTableColumnsOptions {
  /** Unique identifier for the table (used for persistence) */
  tableId: string;
  /** Column metadata for customization UI */
  columns: ColumnMeta[];
  /** Default column order (if not persisted) */
  defaultOrder?: string[];
}

/**
 * Hook for managing table column customization with persistence.
 *
 * Provides column visibility, ordering, and sizing state with
 * automatic localStorage persistence per table.
 *
 * @example
 * ```tsx
 * const tableColumns = useTableColumns({
 *   tableId: "clients-table",
 *   columns: [
 *     { id: "name", label: "Name", required: true },
 *     { id: "email", label: "Email" },
 *     { id: "status", label: "Status" },
 *   ],
 * });
 *
 * const table = useReactTable({
 *   state: {
 *     columnVisibility: tableColumns.columnVisibility,
 *     columnOrder: tableColumns.columnOrder,
 *     columnSizing: tableColumns.columnSizing,
 *   },
 *   onColumnVisibilityChange: tableColumns.onColumnVisibilityChange,
 *   onColumnOrderChange: tableColumns.columnOrder,
 *   onColumnSizingChange: tableColumns.onColumnSizingChange,
 * });
 * ```
 */
export function useTableColumns({
  tableId,
  columns,
  defaultOrder,
}: UseTableColumnsOptions): UseTableColumnsResult {
  const config = useTableColumnStore((state) => state.configs[tableId]);
  const setVisibility = useTableColumnStore((state) => state.setVisibility);
  const setOrder = useTableColumnStore((state) => state.setOrder);
  const setSizing = useTableColumnStore((state) => state.setSizing);
  const resetConfig = useTableColumnStore((state) => state.resetConfig);

  // Memoize derived state to avoid dependency issues
  const columnVisibility = useMemo(
    () => config?.visibility ?? {},
    [config?.visibility]
  );
  const columnOrder = useMemo(
    () => config?.order ?? defaultOrder ?? columns.map((c) => c.id),
    [config?.order, defaultOrder, columns]
  );
  const columnSizing = useMemo(
    () => config?.sizing ?? {},
    [config?.sizing]
  );

  // Initialize default sizes for columns that specify them
  useEffect(() => {
    const hasDefaults = columns.some((c) => c.defaultWidth !== undefined);
    const hasExistingSizes = Object.keys(columnSizing).length > 0;

    if (hasDefaults && !hasExistingSizes) {
      const defaultSizes: ColumnSizingState = {};
      for (const col of columns) {
        if (col.defaultWidth !== undefined) {
          defaultSizes[col.id] = col.defaultWidth;
        }
      }
      if (Object.keys(defaultSizes).length > 0) {
        setSizing(tableId, defaultSizes);
      }
    }
  }, [tableId, columns, columnSizing, setSizing]);

  // Handlers
  const onColumnVisibilityChange = useCallback(
    (visibility: VisibilityState) => {
      setVisibility(tableId, visibility);
    },
    [tableId, setVisibility]
  );

  const onColumnOrderChange = useCallback(
    (order: ColumnOrderState) => {
      setOrder(tableId, order);
    },
    [tableId, setOrder]
  );

  const onColumnSizingChange = useCallback(
    (sizing: ColumnSizingState) => {
      setSizing(tableId, sizing);
    },
    [tableId, setSizing]
  );

  const resetColumns = useCallback(() => {
    resetConfig(tableId);
  }, [tableId, resetConfig]);

  const showColumn = useCallback(
    (columnId: string) => {
      setVisibility(tableId, {
        ...columnVisibility,
        [columnId]: true,
      });
    },
    [tableId, columnVisibility, setVisibility]
  );

  const hideColumn = useCallback(
    (columnId: string) => {
      setVisibility(tableId, {
        ...columnVisibility,
        [columnId]: false,
      });
    },
    [tableId, columnVisibility, setVisibility]
  );

  const toggleColumn = useCallback(
    (columnId: string) => {
      const isVisible = columnVisibility[columnId] !== false;
      if (isVisible) {
        hideColumn(columnId);
      } else {
        showColumn(columnId);
      }
    },
    [columnVisibility, showColumn, hideColumn]
  );

  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      // Get column constraints
      const col = columns.find((c) => c.id === columnId);
      let constrainedWidth = width;

      if (col?.minWidth !== undefined && width < col.minWidth) {
        constrainedWidth = col.minWidth;
      }
      if (col?.maxWidth !== undefined && width > col.maxWidth) {
        constrainedWidth = col.maxWidth;
      }

      setSizing(tableId, {
        ...columnSizing,
        [columnId]: constrainedWidth,
      });
    },
    [tableId, columnSizing, columns, setSizing]
  );

  const resetColumnWidth = useCallback(
    (columnId: string) => {
      const col = columns.find((c) => c.id === columnId);
      const newSizing = { ...columnSizing };
      delete newSizing[columnId];

      // If there's a default width, restore it
      if (col?.defaultWidth !== undefined) {
        newSizing[columnId] = col.defaultWidth;
      }

      setSizing(tableId, newSizing);
    },
    [tableId, columnSizing, columns, setSizing]
  );

  return useMemo(
    () => ({
      columnVisibility,
      columnOrder,
      columnSizing,
      columnMeta: columns,
      onColumnVisibilityChange,
      onColumnOrderChange,
      onColumnSizingChange,
      resetColumns,
      showColumn,
      hideColumn,
      toggleColumn,
      setColumnWidth,
      resetColumnWidth,
    }),
    [
      columnVisibility,
      columnOrder,
      columnSizing,
      columns,
      onColumnVisibilityChange,
      onColumnOrderChange,
      onColumnSizingChange,
      resetColumns,
      showColumn,
      hideColumn,
      toggleColumn,
      setColumnWidth,
      resetColumnWidth,
    ]
  );
}

/**
 * Get column size with constraints applied
 */
export function getConstrainedSize(
  width: number,
  meta?: ColumnMeta
): number {
  let result = width;

  if (meta?.minWidth !== undefined && result < meta.minWidth) {
    result = meta.minWidth;
  }
  if (meta?.maxWidth !== undefined && result > meta.maxWidth) {
    result = meta.maxWidth;
  }

  return result;
}
