import type { FieldType, FilterOperator } from "@/types/custom-report";

export const PAGE_SIZE = 25;

export const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater than or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less than or equal" },
  { value: "in", label: "In (comma-separated)" },
  { value: "not_in", label: "Not in (comma-separated)" },
  { value: "is_null", label: "Is empty" },
  { value: "is_not_null", label: "Is not empty" },
];

export const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  text: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  number: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  date: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  status: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  rag: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  boolean: "bg-muted text-foreground/80",
  calculated: "bg-pink-100 text-pink-700",
};
