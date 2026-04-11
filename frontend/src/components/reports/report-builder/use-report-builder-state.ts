import { useState } from "react";
import type { DropResult } from "@hello-pangea/dnd";
import type {
  CustomReport,
  DataSource,
  FieldMeta,
  FilterOperator,
  ReportField,
  ReportFilter,
  ReportSort,
} from "@/types/custom-report";

export function useReportBuilderState(initialReport?: CustomReport) {
  const [name, setName] = useState(initialReport?.name ?? "");
  const [description, setDescription] = useState(initialReport?.description ?? "");
  const [dataSource, setDataSourceRaw] = useState<DataSource | "">(
    (initialReport?.data_source as DataSource) ?? "",
  );
  const [fields, setFields] = useState<ReportField[]>(
    (initialReport?.fields ?? []) as unknown as ReportField[],
  );
  const [filters, setFilters] = useState<ReportFilter[]>(
    (initialReport?.filters ?? []) as unknown as ReportFilter[],
  );
  const [sorting, setSorting] = useState<ReportSort[]>(
    (initialReport?.sorting ?? []) as unknown as ReportSort[],
  );
  const [grouping, setGrouping] = useState<string[]>(initialReport?.grouping ?? []);
  const [isTemplate] = useState(initialReport?.is_template ?? false);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("fields");

  function setDataSource(v: DataSource | "") {
    setDataSourceRaw(v);
    setFields([]);
    setFilters([]);
    setSorting([]);
  }

  // Field management
  function addField(meta: FieldMeta) {
    if (fields.some((f) => f.key === meta.key)) return;
    setFields((prev) => [
      ...prev,
      { key: meta.key, label: meta.label, type: meta.type },
    ]);
  }

  function removeField(key: string) {
    setFields((prev) => prev.filter((f) => f.key !== key));
  }

  function updateFieldLabel(key: string, label: string) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, label } : f)));
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const reordered = Array.from(fields);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setFields(reordered);
  }

  // Filter management
  function addFilter(firstFieldKey: string | undefined) {
    if (!firstFieldKey) return;
    setFilters((prev) => [
      ...prev,
      { field: firstFieldKey, operator: "eq" as FilterOperator, value: "" },
    ]);
  }

  function updateFilter(index: number, patch: Partial<ReportFilter>) {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }

  // Sort management
  function addSort(firstFieldKey: string | undefined) {
    if (!firstFieldKey) return;
    setSorting((prev) => [
      ...prev,
      { field: firstFieldKey, direction: "asc" },
    ]);
  }

  function updateSort(index: number, patch: Partial<ReportSort>) {
    setSorting((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSort(index: number) {
    setSorting((prev) => prev.filter((_, i) => i !== index));
  }

  return {
    // state
    name,
    setName,
    description,
    setDescription,
    dataSource,
    setDataSource,
    fields,
    filters,
    sorting,
    grouping,
    setGrouping,
    isTemplate,
    page,
    setPage,
    activeTab,
    setActiveTab,
    // actions
    addField,
    removeField,
    updateFieldLabel,
    onDragEnd,
    addFilter,
    updateFilter,
    removeFilter,
    addSort,
    updateSort,
    removeSort,
  };
}

export type ReportBuilderState = ReturnType<typeof useReportBuilderState>;
