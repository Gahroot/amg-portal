"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  XCircle,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getErrorReportDownloadUrl } from "@/lib/api/imports";
import type { ImportValidateResponse } from "@/types/import";

interface StepPreviewProps {
  validationResult: ImportValidateResponse;
  columns: string[];
  importId: string | null;
  isImporting: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function StepPreview({
  validationResult,
  columns,
  importId,
  isImporting,
  onConfirm,
  onBack,
}: StepPreviewProps) {
  const {
    total_rows,
    valid_rows,
    invalid_rows,
    rows_with_warnings,
    errors,
    warnings,
    preview_rows,
  } = validationResult;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Preview & Confirm</h2>
        <p className="text-muted-foreground">
          Review the validation results and confirm the import.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{total_rows}</div>
            <p className="text-sm text-muted-foreground">Total Rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {valid_rows}
            </div>
            <p className="text-sm text-muted-foreground">Valid Rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {invalid_rows}
            </div>
            <p className="text-sm text-muted-foreground">Invalid Rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {rows_with_warnings}
            </div>
            <p className="text-sm text-muted-foreground">Rows with Warnings</p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        defaultValue={
          errors.length > 0 ? "errors" : warnings.length > 0 ? "warnings" : "preview"
        }
      >
        <TabsList>
          <TabsTrigger value="errors" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Errors ({errors.length})
          </TabsTrigger>
          <TabsTrigger value="warnings" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Warnings ({warnings.length})
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Data Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="mt-4">
          {errors.length === 0 ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>No errors found</AlertTitle>
              <AlertDescription>All rows passed validation.</AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {errors.slice(0, 50).map((error, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3"
                  >
                    <XCircle className="mt-0.5 h-4 w-4 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-300">
                        Row {error.row_number}: {error.field || "Unknown field"}
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
                      {error.value !== undefined && error.value !== null && (
                        <p className="mt-1 text-xs text-red-500">Value: {String(error.value)}</p>
                      )}
                    </div>
                  </div>
                ))}
                {errors.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground">
                    And {errors.length - 50} more errors...
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="warnings" className="mt-4">
          {warnings.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No warnings</AlertTitle>
              <AlertDescription>No potential issues were detected.</AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {warnings.slice(0, 50).map((warning, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-3"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <div>
                      <p className="font-medium text-yellow-800 dark:text-yellow-300">
                        Row {warning.row_number}: {warning.field || "Warning"}
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        {warning.message}
                      </p>
                      {warning.existing_name && (
                        <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                          Existing: {warning.existing_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Status</TableHead>
                  {columns.slice(0, 5).map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview_rows.map((row) => (
                  <TableRow
                    key={row.row_number}
                    className={cn(
                      !row.is_valid && "bg-red-50 dark:bg-red-950/30",
                      row.is_valid &&
                        row.warnings.length > 0 &&
                        "bg-yellow-50 dark:bg-yellow-950/30",
                    )}
                  >
                    <TableCell>{row.row_number}</TableCell>
                    <TableCell>
                      {row.is_valid ? (
                        row.warnings.length > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-yellow-500 text-yellow-700 dark:text-yellow-300"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Warning
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-green-500 text-green-700 dark:text-green-300"
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Valid
                          </Badge>
                        )
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" />
                          Invalid
                        </Badge>
                      )}
                    </TableCell>
                    {columns.slice(0, 5).map((col) => (
                      <TableCell key={col} className="max-w-[200px] truncate">
                        {String(row.data[col] || "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Mapping
        </Button>
        <div className="flex gap-2">
          {errors.length > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                importId && window.open(getErrorReportDownloadUrl(importId), "_blank")
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Download Error Report
            </Button>
          )}
          <Button disabled={isImporting || valid_rows === 0} onClick={onConfirm}>
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                Import {valid_rows} Rows
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
