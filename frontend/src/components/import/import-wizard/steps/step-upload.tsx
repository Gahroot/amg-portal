"use client";

import type { ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, FileSpreadsheet, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type ImportEntityType, ENTITY_TYPE_LABELS } from "@/types/import";

interface StepUploadProps {
  entityType: ImportEntityType;
  file: File | null;
  isUploading: boolean;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onBack: () => void;
}

export function StepUpload({
  entityType,
  file,
  isUploading,
  onFileChange,
  onUpload,
  onBack,
}: StepUploadProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Upload your file</h2>
        <p className="text-muted-foreground">
          Upload a CSV or Excel file containing your{" "}
          {ENTITY_TYPE_LABELS[entityType].toLowerCase()} data.
        </p>
      </div>

      <div
        onClick={() => document.getElementById("file-input")?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors",
          file
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
        )}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={onFileChange}
        />
        {file ? (
          <>
            <FileSpreadsheet className="mb-3 h-10 w-10 text-primary" />
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
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
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button disabled={!file || isUploading} onClick={onUpload}>
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
}
