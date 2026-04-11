"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getErrorReportDownloadUrl } from "@/lib/api/imports";
import type { ImportConfirmResponse, ImportEntityType } from "@/types/import";

interface StepCompleteProps {
  importResult: ImportConfirmResponse;
  importId: string | null;
  entityType: ImportEntityType | null;
  onReset: () => void;
}

export function StepComplete({
  importResult,
  importId,
  entityType,
  onReset,
}: StepCompleteProps) {
  const router = useRouter();
  const isSuccess = importResult.status === "completed";
  const hasSomeFailures = importResult.failed_rows > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-8 text-center">
        {isSuccess ? (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-semibold">Import Complete!</h2>
            <p className="mt-2 text-muted-foreground">
              Successfully imported {importResult.imported_rows} of {importResult.total_rows}{" "}
              rows.
            </p>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-semibold">Import Failed</h2>
            <p className="mt-2 text-muted-foreground">
              The import encountered errors and could not complete.
            </p>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{importResult.total_rows}</div>
            <p className="text-sm text-muted-foreground">Total Rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {importResult.imported_rows}
            </div>
            <p className="text-sm text-muted-foreground">Imported</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-muted-foreground">
              {importResult.skipped_rows}
            </div>
            <p className="text-sm text-muted-foreground">Skipped</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {importResult.failed_rows}
            </div>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {hasSomeFailures && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Some rows failed to import</AlertTitle>
          <AlertDescription>
            {importResult.errors.length} errors occurred during import.
            {importId && (
              <Button
                variant="link"
                className="h-auto p-0 ml-2"
                onClick={() => window.open(getErrorReportDownloadUrl(importId), "_blank")}
              >
                Download error report
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={onReset}>
          Start New Import
        </Button>
        {entityType === "clients" && importResult.created_ids.length > 0 && (
          <Button onClick={() => router.push("/clients")}>View Clients</Button>
        )}
        {entityType === "partners" && importResult.created_ids.length > 0 && (
          <Button onClick={() => router.push("/partners")}>View Partners</Button>
        )}
      </div>
    </div>
  );
}
