import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createCustomReport,
  exportReport,
  getDataSources,
  getSourceFields,
  previewReport,
  updateCustomReport,
} from "@/lib/api/custom-reports";
import type {
  CustomReport,
  DataSource,
  ExportFormat,
  ReportField,
  ReportFilter,
  ReportSort,
} from "@/types/custom-report";
import { PAGE_SIZE } from "./constants";

interface UseReportBuilderQueriesArgs {
  initialReport?: CustomReport;
  onSave?: (report: CustomReport) => void;
  name: string;
  description: string;
  dataSource: DataSource | "";
  fields: ReportField[];
  filters: ReportFilter[];
  sorting: ReportSort[];
  grouping: string[];
  isTemplate: boolean;
  page: number;
  exportFormat: ExportFormat;
}

export function useReportBuilderQueries({
  initialReport,
  onSave,
  name,
  description,
  dataSource,
  fields,
  filters,
  sorting,
  grouping,
  isTemplate,
  page,
  exportFormat,
}: UseReportBuilderQueriesArgs) {
  const queryClient = useQueryClient();

  const { data: dataSources } = useQuery({
    queryKey: ["custom-report-data-sources"],
    queryFn: getDataSources,
  });

  const { data: availableFields } = useQuery({
    queryKey: ["custom-report-fields", dataSource],
    queryFn: () => (dataSource ? getSourceFields(dataSource) : Promise.resolve([])),
    enabled: !!dataSource,
  });

  const { data: preview, isFetching: isPreviewing } = useQuery({
    queryKey: [
      "custom-report-preview",
      dataSource,
      fields,
      filters,
      sorting,
      grouping,
      page,
    ],
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

  return {
    dataSources,
    availableFields,
    preview,
    isPreviewing,
    saveMutation,
    exportMutation,
  };
}
