import { Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CustomReport, ExportFormat } from "@/types/custom-report";

interface ReportBuilderHeaderProps {
  name: string;
  description: string;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  initialReport?: CustomReport;
  exportFormat: ExportFormat;
  onExportFormatChange: (v: ExportFormat) => void;
  onExport: () => void;
  exportPending: boolean;
  onSave: () => void;
  savePending: boolean;
  canSave: boolean;
}

export function ReportBuilderHeader({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  initialReport,
  exportFormat,
  onExportFormatChange,
  onExport,
  exportPending,
  onSave,
  savePending,
  canSave,
}: ReportBuilderHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-1">
        <Input
          placeholder="Report name…"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="text-lg font-semibold"
        />
        <Textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="resize-none text-sm"
          rows={2}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {initialReport && (
          <>
            <Select
              value={exportFormat}
              onValueChange={(v) => onExportFormatChange(v as ExportFormat)}
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
              onClick={onExport}
              disabled={exportPending}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
          </>
        )}
        <Button size="sm" onClick={onSave} disabled={!canSave || savePending}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {savePending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
