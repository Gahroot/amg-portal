"use client";

import { Fragment, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
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
  Upload,
  XCircle,
} from "lucide-react";

import {
  type ImportEntityType,
  type ImportTemplate,
  type ColumnMapping,
  type ImportValidateResponse,
  type ImportConfirmResponse,
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_DESCRIPTIONS,
} from "@/types/import";
import {
  getImportTemplate,
  getTemplateDownloadUrl,
  uploadImportFile,
  mapImportColumns,
  validateImport,
  confirmImport,
  getErrorReportDownloadUrl,
} from "@/lib/api/imports";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type WizardStep = "select" | "upload" | "mapping" | "validation" | "preview" | "complete";

interface ImportWizardProps {
  initialEntityType?: ImportEntityType;
  onComplete?: (result: ImportConfirmResponse) => void;
}

export function ImportWizard({ initialEntityType, onComplete }: ImportWizardProps) {
  const router = useRouter();

  // State
  const [currentStep, setCurrentStep] = useState<WizardStep>("select");
  const [entityType, setEntityType] = useState<ImportEntityType | null>(initialEntityType ?? null);
  const [template, setTemplate] = useState<ImportTemplate | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);

  // Mapping state
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isMapping, setIsMapping] = useState(false);

  // Validation state
  const [validationResult, setValidationResult] = useState<ImportValidateResponse | null>(null);

  // Import state
  const [importResult, setImportResult] = useState<ImportConfirmResponse | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Load template when entity type changes
  useEffect(() => {
    if (entityType) {
      setIsLoadingTemplate(true);
      getImportTemplate(entityType)
        .then(setTemplate)
        .catch((err) => setError(err.message))
        .finally(() => setIsLoadingTemplate(false));
    }
  }, [entityType]);

  const handleEntityTypeSelect = (type: ImportEntityType) => {
    setEntityType(type);
    setError(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !entityType) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadImportFile(file, entityType);
      setImportId(result.import_id);
      setColumns(result.columns);

      // Initialize mappings with detected values
      const initialMappings: ColumnMapping[] = result.columns.map((col) => ({
        source_column: col,
        target_field: result.detected_mappings?.[col] || "",
        transform: null,
      }));
      setMappings(initialMappings);
      setCurrentStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleMappingChange = (sourceColumn: string, targetField: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.source_column === sourceColumn ? { ...m, target_field: targetField || "" } : m
      )
    );
  };

  const handleConfirmMappings = async () => {
    if (!importId) return;

    setIsMapping(true);
    setError(null);

    try {
      // Only send mappings that have a target field
      const validMappings = mappings.filter((m) => m.target_field);
      await mapImportColumns({
        import_id: importId,
        mappings: validMappings,
      });

      // Start validation
      setCurrentStep("validation");

      const result = await validateImport({
        import_id: importId,
        skip_duplicates: false,
      });

      setValidationResult(result);
      setCurrentStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process mappings");
    } finally {
      setIsMapping(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importId) return;

    setIsImporting(true);
    setError(null);

    try {
      const result = await confirmImport({
        import_id: importId,
        skip_invalid_rows: true,
        skip_warnings: false,
      });

      setImportResult(result);
      setCurrentStep("complete");

      if (onComplete) {
        onComplete(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete import");
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setCurrentStep("select");
    setEntityType(null);
    setTemplate(null);
    setFile(null);
    setImportId(null);
    setColumns([]);
    setMappings([]);
    setValidationResult(null);
    setImportResult(null);
    setError(null);
  };

  const renderStepIndicator = () => {
    const stepOrder: WizardStep[] = ["select", "upload", "mapping", "validation", "preview", "complete"];
    const currentIndex = stepOrder.indexOf(currentStep);

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {stepOrder.slice(0, -1).map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const labels = ["Select", "Upload", "Map", "Validate", "Preview"];

            return (
              <Fragment key={step}>
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                      isCompleted && "border-primary bg-primary text-primary-foreground",
                      isCurrent && "border-primary text-primary",
                      !isCompleted && !isCurrent && "border-muted-foreground/25 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-xs font-medium",
                      (isCompleted || isCurrent) ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {labels[index]}
                  </span>
                </div>
                {index < stepOrder.length - 2 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-2 transition-colors",
                      index < currentIndex ? "bg-primary" : "bg-muted-foreground/25"
                    )}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  // Render select entity type step
  const renderSelectStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">What would you like to import?</h2>
        <p className="text-muted-foreground">
          Select the type of data you want to import into the system.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(ENTITY_TYPE_LABELS) as ImportEntityType[]).map((type) => (
          <button
            key={type}
            onClick={() => handleEntityTypeSelect(type)}
            className={cn(
              "flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all hover:border-primary/50",
              entityType === type ? "border-primary bg-primary/5" : "border-muted"
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-semibold">{ENTITY_TYPE_LABELS[type]}</span>
              {entityType === type && <CheckCircle2 className="h-5 w-5 text-primary" />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {ENTITY_TYPE_DESCRIPTIONS[type]}
            </p>
          </button>
        ))}
      </div>

      {template && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Required Fields</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {template.fields
                  .filter((f) => f.required)
                  .map((f) => f.display_name)
                  .join(", ")}
              </p>
              <Button
                variant="link"
                className="mt-2 h-auto p-0"
                onClick={() => window.open(getTemplateDownloadUrl(entityType!), "_blank")}
              >
                <Download className="mr-1 h-4 w-4" />
                Download template CSV
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button disabled={!entityType || isLoadingTemplate} onClick={() => setCurrentStep("upload")}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // Render upload step
  const renderUploadStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Upload your file</h2>
        <p className="text-muted-foreground">
          Upload a CSV or Excel file containing your {ENTITY_TYPE_LABELS[entityType!].toLowerCase()} data.
        </p>
      </div>

      <div
        onClick={() => document.getElementById("file-input")?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors",
          file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
        {file ? (
          <>
            <FileSpreadsheet className="mb-3 h-10 w-10 text-primary" />
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </>
        ) : (
          <>
            <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Click to upload or drag and drop</p>
            <p className="text-sm text-muted-foreground">CSV or Excel files up to 10MB</p>
          </>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep("select")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button disabled={!file || isUploading} onClick={handleUpload}>
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              Upload and Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Render mapping step
  const renderMappingStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Map your columns</h2>
        <p className="text-muted-foreground">
          Match the columns from your file to the corresponding fields in the system.
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Your Column</TableHead>
              <TableHead className="w-1/3">Maps To</TableHead>
              <TableHead className="w-1/3">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {columns.map((col) => {
              const mapping = mappings.find((m) => m.source_column === col);
              const fieldDef = template?.fields.find((f) => f.name === mapping?.target_field);

              return (
                <TableRow key={col}>
                  <TableCell className="font-medium">{col}</TableCell>
                  <TableCell>
                    <Select
                      value={mapping?.target_field || ""}
                      onValueChange={(value) => handleMappingChange(col, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-- Skip this column --</SelectItem>
                        {template?.fields.map((field) => (
                          <SelectItem key={field.name} value={field.name}>
                            {field.display_name}
                            {field.required && " *"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fieldDef?.description}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Check required fields */}
      {template && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="font-medium">Required Fields Status</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {template.fields
              .filter((f) => f.required)
              .map((field) => {
                const isMapped = mappings.some((m) => m.target_field === field.name);
                return (
                  <Badge
                    key={field.name}
                    variant={isMapped ? "default" : "destructive"}
                  >
                    {isMapped ? <Check className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                    {field.display_name}
                  </Badge>
                );
              })}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep("upload")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          disabled={isMapping || !template?.fields.every((f) => f.required && mappings.some((m) => m.target_field === f.name))}
          onClick={handleConfirmMappings}
        >
          {isMapping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Validate Data
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Render validation/preview step
  const renderPreviewStep = () => {
    if (!validationResult) return null;

    const { total_rows, valid_rows, invalid_rows, rows_with_warnings, errors, warnings, preview_rows } = validationResult;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Preview & Confirm</h2>
          <p className="text-muted-foreground">
            Review the validation results and confirm the import.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{total_rows}</div>
              <p className="text-sm text-muted-foreground">Total Rows</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{valid_rows}</div>
              <p className="text-sm text-muted-foreground">Valid Rows</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{invalid_rows}</div>
              <p className="text-sm text-muted-foreground">Invalid Rows</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{rows_with_warnings}</div>
              <p className="text-sm text-muted-foreground">Rows with Warnings</p>
            </CardContent>
          </Card>
        </div>

        {/* Errors and warnings tabs */}
        <Tabs defaultValue={errors.length > 0 ? "errors" : warnings.length > 0 ? "warnings" : "preview"}>
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
                          <p className="mt-1 text-xs text-red-500">
                            Value: {String(error.value)}
                          </p>
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
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">{warning.message}</p>
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
                        row.is_valid && row.warnings.length > 0 && "bg-yellow-50 dark:bg-yellow-950/30"
                      )}
                    >
                      <TableCell>{row.row_number}</TableCell>
                      <TableCell>
                        {row.is_valid ? (
                          row.warnings.length > 0 ? (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-300">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Warning
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-300">
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
          <Button variant="outline" onClick={() => setCurrentStep("mapping")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Mapping
          </Button>
          <div className="flex gap-2">
            {errors.length > 0 && (
              <Button
                variant="outline"
                onClick={() => importId && window.open(getErrorReportDownloadUrl(importId), "_blank")}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Error Report
              </Button>
            )}
            <Button
              disabled={isImporting || (valid_rows === 0)}
              onClick={handleConfirmImport}
            >
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
  };

  // Render complete step
  const renderCompleteStep = () => {
    if (!importResult) return null;

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
                Successfully imported {importResult.imported_rows} of {importResult.total_rows} rows.
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

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{importResult.total_rows}</div>
              <p className="text-sm text-muted-foreground">Total Rows</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{importResult.imported_rows}</div>
              <p className="text-sm text-muted-foreground">Imported</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-muted-foreground">{importResult.skipped_rows}</div>
              <p className="text-sm text-muted-foreground">Skipped</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{importResult.failed_rows}</div>
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
          <Button variant="outline" onClick={handleReset}>
            Start New Import
          </Button>
          {entityType === "clients" && importResult.created_ids.length > 0 && (
            <Button onClick={() => router.push("/clients")}>
              View Clients
            </Button>
          )}
          {entityType === "partners" && importResult.created_ids.length > 0 && (
            <Button onClick={() => router.push("/partners")}>
              View Partners
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Data Import Wizard</CardTitle>
        <CardDescription>
          Import your data into AMG Portal with guided validation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {currentStep !== "complete" && currentStep !== "validation" && renderStepIndicator()}

        {currentStep === "select" && renderSelectStep()}
        {currentStep === "upload" && renderUploadStep()}
        {currentStep === "mapping" && renderMappingStep()}
        {currentStep === "validation" && (
          <div className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-lg font-medium">Validating your data...</p>
            <p className="text-sm text-muted-foreground">This may take a moment</p>
          </div>
        )}
        {currentStep === "preview" && renderPreviewStep()}
        {currentStep === "complete" && renderCompleteStep()}
      </CardContent>
    </Card>
  );
}
