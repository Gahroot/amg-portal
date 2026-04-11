"use client";

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ImportConfirmResponse, ImportEntityType } from "@/types/import";

import { useImportWizard } from "./import-wizard/hooks/use-import-wizard";
import { StepIndicator } from "./import-wizard/step-indicator";
import { StepComplete } from "./import-wizard/steps/step-complete";
import { StepMapping } from "./import-wizard/steps/step-mapping";
import { StepPreview } from "./import-wizard/steps/step-preview";
import { StepSelect } from "./import-wizard/steps/step-select";
import { StepUpload } from "./import-wizard/steps/step-upload";
import { StepValidating } from "./import-wizard/steps/step-validating";

interface ImportWizardProps {
  initialEntityType?: ImportEntityType;
  onComplete?: (result: ImportConfirmResponse) => void;
}

export function ImportWizard({ initialEntityType, onComplete }: ImportWizardProps) {
  const wizard = useImportWizard({ initialEntityType, onComplete });

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Data Import Wizard</CardTitle>
        <CardDescription>
          Import your data into AMG Portal with guided validation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {wizard.error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{wizard.error}</AlertDescription>
          </Alert>
        )}

        {wizard.currentStep !== "complete" && wizard.currentStep !== "validation" && (
          <StepIndicator currentStep={wizard.currentStep} />
        )}

        {wizard.currentStep === "select" && (
          <StepSelect
            entityType={wizard.entityType}
            template={wizard.template}
            isLoadingTemplate={wizard.isLoadingTemplate}
            onSelect={wizard.handleEntityTypeSelect}
            onContinue={() => wizard.setCurrentStep("upload")}
          />
        )}

        {wizard.currentStep === "upload" && wizard.entityType && (
          <StepUpload
            entityType={wizard.entityType}
            file={wizard.file}
            isUploading={wizard.isUploading}
            onFileChange={wizard.handleFileChange}
            onUpload={wizard.handleUpload}
            onBack={() => wizard.setCurrentStep("select")}
          />
        )}

        {wizard.currentStep === "mapping" && (
          <StepMapping
            template={wizard.template}
            columns={wizard.columns}
            mappings={wizard.mappings}
            isMapping={wizard.isMapping}
            onMappingChange={wizard.handleMappingChange}
            onConfirm={wizard.handleConfirmMappings}
            onBack={() => wizard.setCurrentStep("upload")}
          />
        )}

        {wizard.currentStep === "validation" && <StepValidating />}

        {wizard.currentStep === "preview" && wizard.validationResult && (
          <StepPreview
            validationResult={wizard.validationResult}
            columns={wizard.columns}
            importId={wizard.importId}
            isImporting={wizard.isImporting}
            onConfirm={wizard.handleConfirmImport}
            onBack={() => wizard.setCurrentStep("mapping")}
          />
        )}

        {wizard.currentStep === "complete" && wizard.importResult && (
          <StepComplete
            importResult={wizard.importResult}
            importId={wizard.importId}
            entityType={wizard.entityType}
            onReset={wizard.handleReset}
          />
        )}
      </CardContent>
    </Card>
  );
}
