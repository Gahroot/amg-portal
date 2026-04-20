"use client";

import { useState } from "react";
import { FileText, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";


export interface PDFExportOptions {
  orientation: "portrait" | "landscape";
  includeHeader: boolean;
  includeFooter: boolean;
  includeTimestamp: boolean;
  includeFilters: boolean;
  pageSize: "A4" | "Letter" | "Legal";
}

interface ExportPDFOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: PDFExportOptions) => void;
  isExporting: boolean;
  title: string;
}

function ExportPDFOptionsDialog({
  open,
  onOpenChange,
  onExport,
  isExporting,
  title,
}: ExportPDFOptionsDialogProps) {
  const [options, setOptions] = useState<PDFExportOptions>({
    orientation: "portrait",
    includeHeader: true,
    includeFooter: true,
    includeTimestamp: true,
    includeFilters: false,
    pageSize: "A4",
  });

  const handleExport = () => {
    onExport(options);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export PDF Options</DialogTitle>
          <DialogDescription>
            Configure your PDF export for {title}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="orientation" className="text-right">
              Orientation
            </Label>
            <Select
              value={options.orientation}
              onValueChange={(value: "portrait" | "landscape") =>
                setOptions((prev) => ({ ...prev, orientation: value }))
              }
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select orientation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="pageSize" className="text-right">
              Page Size
            </Label>
            <Select
              value={options.pageSize}
              onValueChange={(value: "A4" | "Letter" | "Legal") =>
                setOptions((prev) => ({ ...prev, pageSize: value }))
              }
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select page size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
                <SelectItem value="Legal">Legal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="includeHeader" className="text-right">
              Header
            </Label>
            <div className="col-span-3 flex items-center space-x-2">
              <Switch
                id="includeHeader"
                checked={options.includeHeader}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, includeHeader: checked }))
                }
              />
              <span className="text-sm text-muted-foreground">
                Include company header
              </span>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="includeFooter" className="text-right">
              Footer
            </Label>
            <div className="col-span-3 flex items-center space-x-2">
              <Switch
                id="includeFooter"
                checked={options.includeFooter}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, includeFooter: checked }))
                }
              />
              <span className="text-sm text-muted-foreground">
                Include confidentiality notice
              </span>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="includeTimestamp" className="text-right">
              Timestamp
            </Label>
            <div className="col-span-3 flex items-center space-x-2">
              <Switch
                id="includeTimestamp"
                checked={options.includeTimestamp}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, includeTimestamp: checked }))
                }
              />
              <span className="text-sm text-muted-foreground">
                Include generation timestamp
              </span>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="includeFilters" className="text-right">
              Filters
            </Label>
            <div className="col-span-3 flex items-center space-x-2">
              <Switch
                id="includeFilters"
                checked={options.includeFilters}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, includeFilters: checked }))
                }
              />
              <span className="text-sm text-muted-foreground">
                Include applied filters
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ExportPDFButtonProps {
  /** Export URL endpoint (without query params) */
  exportUrl: string;
  /** Display title for the export */
  title: string;
  /** Optional filters to include in the export */
  filters?: Record<string, string>;
  /** Button variant */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Show options dialog before export */
  showOptions?: boolean;
  /** Additional query parameters */
  queryParams?: Record<string, string>;
}

export function ExportPDFButton({
  exportUrl,
  title,
  variant = "outline",
  size = "sm",
  showOptions = true,
  queryParams,
}: ExportPDFButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [defaultOptions] = useState<PDFExportOptions>({
    orientation: "portrait",
    includeHeader: true,
    includeFooter: true,
    includeTimestamp: true,
    includeFilters: false,
    pageSize: "A4",
  });

  const handleExport = async (options: PDFExportOptions) => {
    setIsExporting(true);
    setShowOptionsDialog(false);

    try {
      const params = new URLSearchParams();

      // Add options as query params
      params.set("orientation", options.orientation);
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          params.set(key, value);
        });
      }

      const separator = exportUrl.includes("?") ? "&" : "?";
      const fullUrl = `${exportUrl}${separator}${params.toString()}`;

      const response = await fetch(fullUrl, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Extract filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?(?:;|$)/);
        if (match) {
          filename = match[1];
        }
      }

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to export PDF",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickExport = () => {
    handleExport(defaultOptions);
  };

  if (!showOptions) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleQuickExport}
        disabled={isExporting}
        className="gap-1.5"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        Export PDF
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={isExporting}
            className="gap-1.5"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Export PDF
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Export Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleQuickExport}>
            <FileText className="mr-2 h-4 w-4" />
            Quick Export
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowOptionsDialog(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Custom Export...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExportPDFOptionsDialog
        open={showOptionsDialog}
        onOpenChange={setShowOptionsDialog}
        onExport={handleExport}
        isExporting={isExporting}
        title={title}
      />
    </>
  );
}

/**
 * Export table data as PDF using the server-side export endpoint.
 */
export async function exportTableAsPDF(
  title: string,
  headers: string[],
  rows: (string | number | null)[][],
  options?: Partial<PDFExportOptions>,
  filters?: Record<string, string>,
): Promise<void> {
  const response = await api.post<Blob>(
    "/api/v1/export/pdf/table",
    {
      title,
      headers,
      rows,
      orientation: options?.orientation ?? "portrait",
      include_header: options?.includeHeader ?? true,
      include_footer: options?.includeFooter ?? true,
      include_timestamp: options?.includeTimestamp ?? true,
      include_filters: options?.includeFilters ?? false,
      page_size: options?.pageSize ?? "A4",
      filters,
    },
    { responseType: "blob" },
  );

  const blob = response.data;
  const objectUrl = URL.createObjectURL(blob);
  const filename = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}
