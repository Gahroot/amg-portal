"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
]);

interface UploadZoneProps {
  onFilesSelect: (files: File[]) => void;
  isUploading?: boolean;
  accept?: string;
  maxSizeMB?: number;
  maxFiles?: number;
}

export function UploadZone({
  onFilesSelect,
  isUploading = false,
  maxSizeMB = 50,
  maxFiles = 20,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function processFiles(rawFiles: FileList | File[]) {
    const fileArray = Array.from(rawFiles);
    const validFiles: File[] = [];
    const newErrors: string[] = [];

    if (fileArray.length > maxFiles) {
      newErrors.push(`Maximum ${maxFiles} files allowed per upload.`);
      fileArray.splice(maxFiles);
    }

    for (const file of fileArray) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        newErrors.push(`"${file.name}" — unsupported file type (${file.type || "unknown"}).`);
        continue;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        newErrors.push(`"${file.name}" — exceeds ${maxSizeMB} MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    setErrors(newErrors);
    if (validFiles.length > 0) {
      onFilesSelect(validFiles);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      processFiles(e.target.files);
      // Reset input so the same file can be re-selected after removal
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        } ${isUploading ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <Upload className="mb-3 size-10 text-muted-foreground" />
        <p className="text-sm font-medium">Drag and drop files here, or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, Word, Excel, PowerPoint, images, CSV — up to {maxSizeMB} MB each, max {maxFiles} files
        </p>
        {isUploading && (
          <Badge variant="secondary" className="mt-3">
            Uploading…
          </Badge>
        )}
      </div>

      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
              <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{err}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
