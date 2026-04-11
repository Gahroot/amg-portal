"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import type { CustomReport, ExportFormat } from "@/types/custom-report";
import { AvailableFieldsPanel } from "./report-builder/available-fields-panel";
import { ConfigTabs } from "./report-builder/config-tabs";
import { PAGE_SIZE } from "./report-builder/constants";
import { DataSourcePicker } from "./report-builder/data-source-picker";
import { PreviewTable } from "./report-builder/preview-table";
import { ReportBuilderHeader } from "./report-builder/report-builder-header";
import { SelectedFieldsPanel } from "./report-builder/selected-fields-panel";
import { useReportBuilderQueries } from "./report-builder/use-report-builder-queries";
import { useReportBuilderState } from "./report-builder/use-report-builder-state";

interface ReportBuilderProps {
  initialReport?: CustomReport;
  onSave?: (report: CustomReport) => void;
}

export function ReportBuilder({ initialReport, onSave }: ReportBuilderProps) {
  const state = useReportBuilderState(initialReport);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");

  const {
    dataSources,
    availableFields,
    preview,
    isPreviewing,
    saveMutation,
    exportMutation,
  } = useReportBuilderQueries({
    initialReport,
    onSave,
    name: state.name,
    description: state.description,
    dataSource: state.dataSource,
    fields: state.fields,
    filters: state.filters,
    sorting: state.sorting,
    grouping: state.grouping,
    isTemplate: state.isTemplate,
    page: state.page,
    exportFormat,
  });

  const selectedKeys = new Set(state.fields.map((f) => f.key));
  const totalPages = preview ? Math.ceil(preview.total / PAGE_SIZE) : 1;
  const firstFieldKey = availableFields?.[0]?.key;

  return (
    <div className="flex h-full flex-col gap-4">
      <ReportBuilderHeader
        name={state.name}
        description={state.description}
        onNameChange={state.setName}
        onDescriptionChange={state.setDescription}
        initialReport={initialReport}
        exportFormat={exportFormat}
        onExportFormatChange={setExportFormat}
        onExport={() => exportMutation.mutate()}
        exportPending={exportMutation.isPending}
        onSave={() => saveMutation.mutate()}
        savePending={saveMutation.isPending}
        canSave={!!state.name && !!state.dataSource}
      />

      <DataSourcePicker
        dataSource={state.dataSource}
        dataSources={dataSources}
        onChange={state.setDataSource}
      />

      {state.dataSource && (
        <div className="flex flex-1 gap-4 overflow-hidden">
          <div className="flex w-72 shrink-0 flex-col gap-3">
            <AvailableFieldsPanel
              availableFields={availableFields}
              selectedKeys={selectedKeys}
              onAdd={state.addField}
            />
            <ConfigTabs
              activeTab={state.activeTab}
              onActiveTabChange={state.setActiveTab}
              availableFields={availableFields}
              filters={state.filters}
              onAddFilter={() => state.addFilter(firstFieldKey)}
              onUpdateFilter={state.updateFilter}
              onRemoveFilter={state.removeFilter}
              sorting={state.sorting}
              onAddSort={() => state.addSort(firstFieldKey)}
              onUpdateSort={state.updateSort}
              onRemoveSort={state.removeSort}
              grouping={state.grouping}
              onUpdateGroup={(i, key) =>
                state.setGrouping((prev) => prev.map((g, j) => (j === i ? key : g)))
              }
              onRemoveGroup={(i) =>
                state.setGrouping((prev) => prev.filter((_, j) => j !== i))
              }
              onAddGroup={() =>
                firstFieldKey &&
                state.setGrouping((prev) => [...prev, firstFieldKey])
              }
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <SelectedFieldsPanel
              fields={state.fields}
              onDragEnd={state.onDragEnd}
              onUpdateLabel={state.updateFieldLabel}
              onRemove={state.removeField}
            />
            <PreviewTable
              preview={preview}
              isPreviewing={isPreviewing}
              page={state.page}
              totalPages={totalPages}
              onPageChange={(updater) => state.setPage(updater)}
            />
          </div>
        </div>
      )}

      {!state.dataSource && (
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
