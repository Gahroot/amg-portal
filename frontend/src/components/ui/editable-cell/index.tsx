"use client";

import { EditableCheckboxCell } from "./editable-checkbox-cell";
import { EditableDateCell } from "./editable-date-cell";
import { EditableSelectCell } from "./editable-select-cell";
import { EditableTextCell } from "./editable-text-cell";
import { EditableToggleCell } from "./editable-toggle-cell";
import type { EditableCellProps } from "./types";

export type {
  CellEditState,
  CheckboxEditableCellProps,
  DateEditableCellProps,
  EditableCellBaseProps,
  EditableCellProps,
  SelectEditableCellProps,
  TextEditableCellProps,
  ToggleEditableCellProps,
  ValidationResult,
} from "./types";
export { validateValue } from "./validate-value";

/**
 * Main EditableCell component that renders the appropriate cell type
 */
export function EditableCell(props: EditableCellProps) {
  switch (props.type) {
    case "text":
    case "number":
    case "email":
    case "tel":
    case "url":
      return <EditableTextCell {...props} />;
    case "select":
      return <EditableSelectCell {...props} />;
    case "date":
      return <EditableDateCell {...props} />;
    case "toggle":
      return <EditableToggleCell {...props} />;
    case "checkbox":
      return <EditableCheckboxCell {...props} />;
    default:
      return null;
  }
}

/**
 * Higher-order component to create an editable cell column definition
 */
export function createEditableColumn(
  columnId: string,
  config: Omit<
    EditableCellProps,
    "value" | "rowId" | "columnId" | "isEditing" | "onStartEdit" | "onCancelEdit" | "onSave"
  >,
) {
  return {
    id: columnId,
    accessorKey: columnId,
    cell: ({
      row,
      getValue,
      table: _table,
    }: {
      row: { id: string };
      getValue: () => unknown;
      table: unknown;
    }) => {
      // These props should be provided by the EditableTable wrapper
      const cellProps = {
        ...config,
        value: getValue(),
        rowId: row.id,
        columnId,
      } as EditableCellProps;

      return <EditableCell {...cellProps} />;
    },
  };
}
