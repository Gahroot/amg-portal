"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type ExportColumn,
  type ExportFormat,
  exportData,
  downloadServerExport,
} from "@/lib/export-utils";

interface DataTableExportProps<T> {
  /** All rows available (unfiltered/unpaginated) for "Export All" */
  allRows?: T[];
  /** Currently visible rows (filtered/paginated) */
  visibleRows: T[];
  /** Selected rows (when row selection is enabled) */
  selectedRows?: T[];
  /** Column definitions for export */
  columns: ExportColumn<T>[];
  /** Base filename (without extension) */
  fileName: string;
  /**
   * Backend export URL for server-side full-dataset download.
   * Must be a full URL (e.g. `http://localhost:8000/api/v1/export/programs`).
   * Query parameters for filters may be appended (e.g. `?status=active`).
   * The `format` query param is added automatically.
   * Authentication is handled via the stored Bearer token.
   */
  exportAllUrl?: string;
  /** Optional variant override for the trigger button */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Optional size override */
  size?: "default" | "sm" | "lg" | "icon";
}

export function DataTableExport<T>({
  allRows,
  visibleRows,
  selectedRows,
  columns,
  fileName,
  exportAllUrl,
  variant = "outline",
  size = "sm",
}: DataTableExportProps<T>) {
  const hasSelected = selectedRows && selectedRows.length > 0;
  const hasAll = allRows && allRows.length > 0;
  const [serverExporting, setServerExporting] = useState(false);

  function handleExport(rows: T[], format: ExportFormat, label: string) {
    exportData(rows, columns, `${fileName}-${label}`, format);
  }

  function handleGoogleSheets(rows: T[]) {
    // Download CSV — user can then import into Google Sheets
    exportData(rows, columns, `${fileName}-google-sheets`, "csv");
    // Open Google Sheets import page in a new tab
    window.open("https://sheets.new", "_blank", "noopener,noreferrer");
  }

  async function handleServerExport(format: ExportFormat) {
    if (!exportAllUrl) return;
    setServerExporting(true);
    try {
      await downloadServerExport(exportAllUrl, format, `${fileName}-all`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download export",
      );
    } finally {
      setServerExporting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5" disabled={serverExporting}>
          {serverExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Current view */}
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Current view ({visibleRows.length} rows)
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleExport(visibleRows, "csv", "view")}>
          <FileText className="mr-2 h-4 w-4" />
          Download as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport(visibleRows, "xlsx", "view")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Download as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleGoogleSheets(visibleRows)}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in Google Sheets
        </DropdownMenuItem>

        {/* Selected rows */}
        {hasSelected && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Selected ({selectedRows.length} rows)
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => handleExport(selectedRows, "csv", "selected")}
            >
              <FileText className="mr-2 h-4 w-4" />
              Export selected as CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleExport(selectedRows, "xlsx", "selected")}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export selected as Excel
            </DropdownMenuItem>
          </>
        )}

        {/* All rows (preloaded) */}
        {hasAll && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              All records ({allRows.length} rows)
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleExport(allRows, "csv", "all")}>
              <FileText className="mr-2 h-4 w-4" />
              Export all as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport(allRows, "xlsx", "all")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export all as Excel
            </DropdownMenuItem>
          </>
        )}

        {/* Server-side full export (authenticated fetch) */}
        {exportAllUrl && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Full dataset (server)
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => void handleServerExport("csv")}
              disabled={serverExporting}
            >
              <FileText className="mr-2 h-4 w-4" />
              Download all (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void handleServerExport("xlsx")}
              disabled={serverExporting}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download all (Excel)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
