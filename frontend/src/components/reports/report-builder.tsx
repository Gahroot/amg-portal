"use client";

import * as React from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  ChevronDown,
  Download,
  FileText,
  GripVertical,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDataSources,
  getSourceFields,
  previewReport,
  createCustomReport,
  updateCustomReport,
  exportReport,
} from "@/lib/api/custom-reports";
import type {
  CustomReport,
  DataSource,
  ExportFormat,
  FieldMeta,
  FieldType,
  FilterOperator,
  ReportField,
  ReportFilter,
  ReportSort,
  SortDirection,
} from "@/types/custom-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────────────

const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
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

const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  text: "bg-blue-100 text-blue-700",
  number: "bg-purple-100 text-purple-700",
  date: "bg-green-100 text-green-700",
  status: "bg-amber-100 text-amber-700",
  rag: "bg-red-100 text-red-700",
  boolean: "bg-gray-100 text-gray-700",
  calculated: "bg-pink-100 text-pink-700",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReportBuilderProps {
  initialReport?: CustomReport;
  onSave?: (report: CustomReport) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportBuilder({ initialReport, onSave }: ReportBuilderProps) {
  const queryClient = useQueryClient();

  // Report definition state
  const [name, setName] = React.useState(initialReport?.name ?? "");
  const [description, setDescription] = React.useState(
    initialReport?.description ?? "",
  );
  const [dataSource, setDataSource] = React.useState<DataSource | "">(
    (initialReport?.data_source as DataSource) ?? "",
  );
  const [fields, setFields] = React.useState<ReportField[]>(
    initialReport?.fields ?? [],
  );
  const [filters, setFilters] = React.useState<ReportFilter[]>(
    initialReport?.filters ?? [],
  );
  const [sorting, setSorting] = React.useState<ReportSort[]>(
    initialReport?.sorting ?? [],
  );
  const [grouping, setGrouping] = React.useState<string[]>(
    initialReport?.grouping ?? [],
  );
  const [isTemplate, setIsTemplate] = React.useState(
    initialReport?.is_template ?? false,
  );

  // Preview pagination
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 25;

  // UI state
  const [activeTab, setActiveTab] = React.useState("fields");
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("csv");

  // ─── Data fetching ───────────────────────────────────────────────────

  const { data: dataSources } = useQuery({
    queryKey: ["custom-report-data-sources"],
    queryFn: getDataSources,
  });

  const { data: availableFields } = useQuery({
    queryKey: ["custom-report-fields", dataSource],
    queryFn: () => (dataSource ? getSourceFields(dataSource) : Promise.resolve([])),
    enabled: !!dataSource,
  });

  const {
    data: preview,
    isFetching: isPreviewing,
    refetch: runPreview,
  } = useQuery({
    queryKey: ["custom-report-preview", dataSource, fields, filters, sorting, grouping, page],
    queryFn: () =>
      dataSource
        ? previewReport({
            data_source: dataSource,
            fields,
            filters,
            sorting,
            grouping,
            page,
            page_size: PAGE_SIZE,
          })
        : Promise.resolve(null),
    enabled: !!dataSource,
  });

  // ─── Mutations ────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description: description || null,
        data_source: dataSource as DataSource,
        fields,
        filters,
        sorting,
        grouping,
        is_template: isTemplate,
      };
      if (initialReport) {
        return updateCustomReport(initialReport.id, payload);
      }
      return createCustomReport(payload);
    },
    onSuccess: (saved) => {
      toast.success(initialReport ? "Report updated" : "Report saved");
      queryClient.invalidateQueries({ queryKey: ["custom-reports"] });
      onSave?.(saved);
    },
    onError: () => toast.error("Failed to save report"),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!initialReport) throw new Error("Save the report first");
      return exportReport(initialReport.id, exportFormat, filters);
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name || "report"}.${exportFormat === "pdf" ? "pdf" : "csv"}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export started");
    },
    onError: () => toast.error("Export failed"),
  });

  // ─── Field management ────────────────────────────────────────────────

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
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, label } : f)),
    );
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const reordered = Array.from(fields);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setFields(reordered);
  }

  // ─── Filter management ───────────────────────────────────────────────

  function addFilter() {
    if (!availableFields?.length) return;
    const firstField = availableFields[0];
    setFilters((prev) => [
      ...prev,
      { field: firstField.key, operator: "eq", value: "" },
    ]);
  }

  function updateFilter(index: number, patch: Partial<ReportFilter>) {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Sort management ─────────────────────────────────────────────────

  function addSort() {
    if (!availableFields?.length) return;
    const firstField = availableFields[0];
    setSorting((prev) => [
      ...prev,
      { field: firstField.key, direction: "asc" },
    ]);
  }

  function updateSort(index: number, patch: Partial<ReportSort>) {
    setSorting((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSort(index: number) {
    setSorting((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Render ───────────────────────────────────────────────────────────

  const selectedKeys = new Set(fields.map((f) => f.key));
  const totalPages = preview ? Math.ceil(preview.total / PAGE_SIZE) : 1;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <Input
            placeholder="Report name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-semibold"
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="resize-none text-sm"
            rows={2}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {initialReport && (
            <>
              <Select
                value={exportFormat}
                onValueChange={(v) => setExportFormat(v as ExportFormat)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!name || !dataSource || saveMutation.isPending}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Data source picker */}
      <div className="flex items-center gap-3">
        <Label className="shrink-0 text-sm font-medium">Data source</Label>
        <Select
          value={dataSource}
          onValueChange={(v) => {
            setDataSource(v as DataSource);
            setFields([]);
            setFilters([]);
            setSorting([]);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Choose a data source…" />
          </SelectTrigger>
          <SelectContent>
            {dataSources?.map((ds) => (
              <SelectItem key={ds.key} value={ds.key}>
                {ds.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dataSource && (
        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Left panel — field catalogue + config tabs */}
          <div className="flex w-72 shrink-0 flex-col gap-3">
            {/* Available fields */}
            <Card className="flex-1 overflow-hidden">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Available fields</CardTitle>
                <CardDescription className="text-xs">
                  Click or drag to add
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-64">
                  <div className="space-y-0.5 p-2">
                    {availableFields?.map((meta) => (
                      <button
                        key={meta.key}
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors",
                          selectedKeys.has(meta.key)
                            ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                            : "hover:bg-accent cursor-pointer",
                        )}
                        onClick={() => !selectedKeys.has(meta.key) && addField(meta)}
                        disabled={selectedKeys.has(meta.key)}
                      >
                        <span className="truncate">{meta.label}</span>
                        <span
                          className={cn(
                            "ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                            FIELD_TYPE_COLORS[meta.type],
                          )}
                        >
                          {meta.type}
                        </span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Filters / Sorts / Grouping config */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 text-xs">
                <TabsTrigger value="filters">
                  Filters
                  {filters.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                      {filters.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sort">
                  Sort
                  {sorting.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                      {sorting.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="group">Group</TabsTrigger>
              </TabsList>

              {/* Filters */}
              <TabsContent value="filters" className="mt-2 space-y-2">
                {filters.map((filter, i) => (
                  <div key={i} className="rounded-md border p-2 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-muted-foreground">Filter {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeFilter(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Select
                      value={filter.field}
                      onValueChange={(v) => updateFilter(i, { field: v })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Field" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields?.map((f) => (
                          <SelectItem key={f.key} value={f.key} className="text-xs">
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filter.operator}
                      onValueChange={(v) =>
                        updateFilter(i, { operator: v as FilterOperator })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value} className="text-xs">
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filter.operator !== "is_null" &&
                      filter.operator !== "is_not_null" && (
                        <Input
                          className="h-7 text-xs"
                          placeholder="Value"
                          value={String(filter.value ?? "")}
                          onChange={(e) =>
                            updateFilter(i, { value: e.target.value })
                          }
                        />
                      )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={addFilter}
                  disabled={!availableFields?.length}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add filter
                </Button>
              </TabsContent>

              {/* Sorting */}
              <TabsContent value="sort" className="mt-2 space-y-2">
                {sorting.map((sort, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Select
                      value={sort.field}
                      onValueChange={(v) => updateSort(i, { field: v })}
                    >
                      <SelectTrigger className="h-7 flex-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields?.map((f) => (
                          <SelectItem key={f.key} value={f.key} className="text-xs">
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={sort.direction}
                      onValueChange={(v) =>
                        updateSort(i, { direction: v as SortDirection })
                      }
                    >
                      <SelectTrigger className="h-7 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc" className="text-xs">Asc</SelectItem>
                        <SelectItem value="desc" className="text-xs">Desc</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => removeSort(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={addSort}
                  disabled={!availableFields?.length}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add sort
                </Button>
              </TabsContent>

              {/* Grouping */}
              <TabsContent value="group" className="mt-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Group results by one or more fields.
                </p>
                {grouping.map((key, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Select
                      value={key}
                      onValueChange={(v) =>
                        setGrouping((prev) => prev.map((g, j) => (j === i ? v : g)))
                      }
                    >
                      <SelectTrigger className="h-7 flex-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields?.map((f) => (
                          <SelectItem key={f.key} value={f.key} className="text-xs">
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() =>
                        setGrouping((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() =>
                    availableFields?.[0] &&
                    setGrouping((prev) => [...prev, availableFields[0].key])
                  }
                  disabled={!availableFields?.length}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add grouping
                </Button>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right panel — selected fields + preview */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* Selected fields (drag-and-drop) */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">
                  Selected columns
                  <Badge variant="secondary" className="ml-2">
                    {fields.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Drag to reorder. Click the label to rename.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3">
                {fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Select fields from the panel on the left to add columns.
                  </p>
                ) : (
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="fields" direction="horizontal">
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="flex flex-wrap gap-2"
                        >
                          {fields.map((field, index) => (
                            <Draggable
                              key={field.key}
                              draggableId={field.key}
                              index={index}
                            >
                              {(drag, snapshot) => (
                                <div
                                  ref={drag.innerRef}
                                  {...drag.draggableProps}
                                  className={cn(
                                    "flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs shadow-sm",
                                    snapshot.isDragging && "ring-2 ring-primary",
                                  )}
                                >
                                  <span
                                    {...drag.dragHandleProps}
                                    className="cursor-grab text-muted-foreground active:cursor-grabbing"
                                  >
                                    <GripVertical className="h-3 w-3" />
                                  </span>
                                  <span
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) =>
                                      updateFieldLabel(
                                        field.key,
                                        e.currentTarget.textContent ?? field.label,
                                      )
                                    }
                                    className="outline-none focus:underline"
                                  >
                                    {field.label}
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded px-1 py-0.5 text-[9px] font-medium",
                                      FIELD_TYPE_COLORS[field.type],
                                    )}
                                  >
                                    {field.type}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeField(field.key)}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </CardContent>
            </Card>

            {/* Preview table */}
            <Card className="flex-1 overflow-hidden">
              <CardHeader className="flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-sm">
                    Preview
                    {preview && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {preview.total.toLocaleString()} rows
                      </span>
                    )}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {isPreviewing && <span>Loading…</span>}
                  {preview && totalPages > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </Button>
                      <span>
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-72">
                  {preview && preview.columns.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {preview.columns.map((col) => (
                            <TableHead key={col.key} className="text-xs whitespace-nowrap">
                              {col.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={preview.columns.length}
                              className="py-8 text-center text-sm text-muted-foreground"
                            >
                              No data matches the current filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          preview.rows.map((row, ri) => (
                            <TableRow key={ri}>
                              {preview.columns.map((col) => (
                                <TableCell
                                  key={col.key}
                                  className="max-w-[200px] truncate text-xs"
                                >
                                  {row[col.key] == null ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    renderCellValue(row[col.key], col.type)
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                      {isPreviewing
                        ? "Loading preview…"
                        : "Add columns to see a preview."}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!dataSource && (
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed">
          <div className="text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Select a data source above to start building your report
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cell renderer ───────────────────────────────────────────────────────────

function renderCellValue(value: unknown, type: string): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;

  const str = String(value);

  if (type === "rag") {
    const color =
      str === "green"
        ? "bg-green-100 text-green-700"
        : str === "amber"
          ? "bg-amber-100 text-amber-700"
          : str === "red"
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-600";
    return (
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", color)}>
        {str}
      </span>
    );
  }

  if (type === "status") {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize">
        {str.replace(/_/g, " ")}
      </span>
    );
  }

  if (type === "date" && str.includes("T")) {
    return str.slice(0, 10);
  }

  if (type === "number") {
    const num = Number(value);
    return isNaN(num) ? str : num.toLocaleString();
  }

  return str;
}
