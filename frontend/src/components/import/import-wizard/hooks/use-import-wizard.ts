"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";

import {
  type ImportEntityType,
  type ImportTemplate,
  type ColumnMapping,
  type ImportValidateResponse,
  type ImportConfirmResponse,
} from "@/types/import";
import {
  getImportTemplate,
  uploadImportFile,
  mapImportColumns,
  validateImport,
  confirmImport,
} from "@/lib/api/imports";

export type WizardStep =
  | "select"
  | "upload"
  | "mapping"
  | "validation"
  | "preview"
  | "complete";

export interface UseImportWizardOptions {
  initialEntityType?: ImportEntityType;
  onComplete?: (result: ImportConfirmResponse) => void;
}

export function useImportWizard({ initialEntityType, onComplete }: UseImportWizardOptions) {
  // Wizard navigation
  const [currentStep, setCurrentStep] = useState<WizardStep>("select");

  // Entity / template
  const [entityType, setEntityType] = useState<ImportEntityType | null>(
    initialEntityType ?? null,
  );
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
    if (!entityType) return;
    setIsLoadingTemplate(true);
    getImportTemplate(entityType)
      .then(setTemplate)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoadingTemplate(false));
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
        m.source_column === sourceColumn ? { ...m, target_field: targetField || "" } : m,
      ),
    );
  };

  const handleConfirmMappings = async () => {
    if (!importId) return;

    setIsMapping(true);
    setError(null);

    try {
      const validMappings = mappings.filter((m) => m.target_field);
      await mapImportColumns({
        import_id: importId,
        mappings: validMappings,
      });

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

  return {
    // state
    currentStep,
    entityType,
    template,
    isLoadingTemplate,
    file,
    isUploading,
    importId,
    columns,
    mappings,
    isMapping,
    validationResult,
    importResult,
    isImporting,
    error,
    // actions
    setCurrentStep,
    handleEntityTypeSelect,
    handleFileChange,
    handleUpload,
    handleMappingChange,
    handleConfirmMappings,
    handleConfirmImport,
    handleReset,
  };
}

export type ImportWizardController = ReturnType<typeof useImportWizard>;
