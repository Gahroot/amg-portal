"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Columns3, GripVertical, RotateCcw, Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import type { ColumnMeta } from "@/hooks/use-table-columns";

/**
 * Props for a single sortable column item
 */
interface SortableColumnItemProps {
  column: ColumnMeta;
  isVisible: boolean;
  onToggle: () => void;
}

/**
 * Sortable column item component
 */
function SortableColumnItem({
  column,
  isVisible,
  onToggle,
}: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-sm px-2 py-1.5",
        isDragging && "bg-accent opacity-90",
        !isDragging && "hover:bg-accent/50"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>

      {/* Visibility toggle */}
      <Checkbox
        id={`column-${column.id}`}
        checked={isVisible}
        disabled={column.required}
        onCheckedChange={onToggle}
        aria-label={`Toggle ${column.label} visibility`}
      />

      {/* Column label */}
      <label
        htmlFor={`column-${column.id}`}
        className={cn(
          "flex-1 cursor-pointer text-sm",
          column.required && "text-muted-foreground"
        )}
      >
        {column.label}
        {column.required && (
          <span className="ml-1 text-xs text-muted-foreground">(required)</span>
        )}
      </label>

      {/* Visibility indicator */}
      {isVisible ? (
        <Eye className="size-3.5 text-muted-foreground" />
      ) : (
        <EyeOff className="size-3.5 text-muted-foreground" />
      )}
    </div>
  );
}

/**
 * Props for ColumnCustomizer component
 */
export interface ColumnCustomizerProps {
  /** Column metadata */
  columns: ColumnMeta[];
  /** Current column visibility state */
  columnVisibility: Record<string, boolean>;
  /** Current column order */
  columnOrder: string[];
  /** Handler for visibility change */
  onVisibilityChange: (columnId: string, visible: boolean) => void;
  /** Handler for order change */
  onOrderChange: (order: string[]) => void;
  /** Handler to reset all column preferences */
  onReset: () => void;
  /** Additional class name for the trigger button */
  className?: string;
  /** Button variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
}

/**
 * Column customizer dropdown component.
 *
 * Provides UI for showing/hiding columns and reordering them via drag-and-drop.
 *
 * @example
 * ```tsx
 * <ColumnCustomizer
 *   columns={columnMeta}
 *   columnVisibility={visibility}
 *   columnOrder={order}
 *   onVisibilityChange={handleVisibilityChange}
 *   onOrderChange={handleOrderChange}
 *   onReset={handleReset}
 * />
 * ```
 */
export function ColumnCustomizer({
  columns,
  columnVisibility,
  columnOrder,
  onVisibilityChange,
  onOrderChange,
  onReset,
  className,
  variant = "outline",
  size = "sm",
}: ColumnCustomizerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(String(active.id));
      const newIndex = columnOrder.indexOf(String(over.id));
      const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
      onOrderChange(newOrder);
    }
  };

  const handleToggleAll = (visible: boolean) => {
    for (const col of columns) {
      if (!col.required) {
        onVisibilityChange(col.id, visible);
      }
    }
  };

  const allVisible = columns.every(
    (col) => col.required || columnVisibility[col.id] !== false
  );
  const someVisible = columns.some(
    (col) => columnVisibility[col.id] !== false
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Columns3 className="size-4" />
          <span className="hidden sm:inline ml-2">Columns</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Customize Columns</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={onReset}
          >
            <RotateCcw className="size-3 mr-1" />
            Reset
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Toggle all */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Checkbox
            id="toggle-all-columns"
            checked={allVisible}
            ref={(el) => {
              if (el) {
                (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate =
                  someVisible && !allVisible;
              }
            }}
            onCheckedChange={(checked) => handleToggleAll(checked === true)}
          />
          <label
            htmlFor="toggle-all-columns"
            className="text-sm cursor-pointer"
          >
            Toggle all
          </label>
        </div>

        <DropdownMenuSeparator />

        {/* Sortable column list */}
        <div className="max-h-64 overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columnOrder}
              strategy={verticalListSortingStrategy}
            >
              {columnOrder.map((columnId) => {
                const column = columns.find((c) => c.id === columnId);
                if (!column) return null;

                const isVisible = columnVisibility[columnId] !== false;

                return (
                  <SortableColumnItem
                    key={column.id}
                    column={column}
                    isVisible={isVisible}
                    onToggle={() => onVisibilityChange(column.id, !isVisible)}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Props for ColumnResizer component
 */
export interface ColumnResizerProps {
  /** Whether the column is currently being resized */
  isResizing: boolean;
  /** Resize handler from TanStack Table */
  onMouseDown: React.MouseEventHandler;
  /** Double-click handler to auto-fit/reset */
  onDoubleClick?: React.MouseEventHandler;
}

/**
 * Column resizer handle component.
 *
 * This is typically rendered inside the table header cell.
 *
 * @example
 * ```tsx
 * <th>
 *   {header}
 *   <ColumnResizer
 *     isResizing={column.getIsResizing()}
 *     onMouseDown={column.getResizeHandler()}
 *     onDoubleClick={() => column.resetSize()}
 *   />
 * </th>
 * ```
 */
export function ColumnResizer({
  isResizing,
  onMouseDown,
  onDoubleClick,
}: ColumnResizerProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={cn(
        "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
        "bg-transparent hover:bg-primary/50 transition-colors",
        isResizing && "bg-primary"
      )}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      style={{
        transform: isResizing ? "scaleX(2)" : undefined,
      }}
    />
  );
}

/**
 * Props for ResizableTableHead component
 */
export interface ResizableTableHeadProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Column width from TanStack Table */
  width?: number;
  /** Whether the column is being resized */
  isResizing?: boolean;
  /** Resize handler */
  onResizeMouseDown?: React.MouseEventHandler;
  /** Double-click handler to reset size */
  onResizeDoubleClick?: React.MouseEventHandler;
  /** Whether resizing is enabled */
  enableResizing?: boolean;
}

/**
 * Table header cell with resize support.
 *
 * @example
 * ```tsx
 * <ResizableTableHead
 *   width={column.getSize()}
 *   isResizing={column.getIsResizing()}
 *   onResizeMouseDown={column.getResizeHandler()}
 *   onResizeDoubleClick={() => column.resetSize()}
 *   enableResizing={column.getCanResize()}
 * >
 *   {header}
 * </ResizableTableHead>
 * ```
 */
export const ResizableTableHead = React.forwardRef<
  HTMLTableCellElement,
  ResizableTableHeadProps
>(
  (
    {
      width,
      isResizing = false,
      onResizeMouseDown,
      onResizeDoubleClick,
      enableResizing = true,
      className,
      children,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <th
        ref={ref}
        className={cn("relative", className)}
        style={{
          ...style,
          width: width !== undefined ? `${width}px` : undefined,
        }}
        {...props}
      >
        {children}
        {enableResizing && onResizeMouseDown && (
          <ColumnResizer
            isResizing={isResizing}
            onMouseDown={onResizeMouseDown}
            onDoubleClick={onResizeDoubleClick}
          />
        )}
      </th>
    );
  }
);

ResizableTableHead.displayName = "ResizableTableHead";

export default ColumnCustomizer;
