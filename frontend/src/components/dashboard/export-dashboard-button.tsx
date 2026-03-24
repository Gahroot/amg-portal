"use client";

import { useState } from "react";
import { Download, FileImage, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportDashboard } from "@/lib/dashboard-export";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";

interface ExportDashboardButtonProps {
  /** CSS selector for the dashboard container to capture */
  containerSelector?: string;
  /** Optional title shown in the export header */
  title?: string;
}

export function ExportDashboardButton({
  containerSelector = "#dashboard-content",
  title = "Portfolio Overview",
}: ExportDashboardButtonProps) {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport(format: "pdf" | "png", includeHeader: boolean) {
    setIsExporting(true);
    try {
      await exportDashboard(containerSelector, {
        format,
        includeHeader,
        title,
        userName: user?.full_name ?? "Unknown",
      });
      toast.success(
        `Dashboard exported as ${format.toUpperCase()} successfully`,
      );
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export dashboard. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={isExporting}
          data-export-ignore
        >
          {isExporting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          {isExporting ? "Exporting…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-export-ignore>
        <DropdownMenuLabel>Export Dashboard</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport("pdf", true)}>
          <FileText className="mr-2 h-4 w-4" />
          PDF with header
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf", false)}>
          <FileText className="mr-2 h-4 w-4" />
          PDF without header
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport("png", true)}>
          <FileImage className="mr-2 h-4 w-4" />
          PNG with header
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("png", false)}>
          <FileImage className="mr-2 h-4 w-4" />
          PNG without header
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
