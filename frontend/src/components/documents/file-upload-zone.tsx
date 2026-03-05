"use client";

import * as React from "react";
import { Upload } from "lucide-react";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  isUploading?: boolean;
}

export function FileUploadZone({
  onFileSelect,
  accept,
  maxSizeMB = 50,
  isUploading = false,
}: FileUploadZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
      setError(`File exceeds ${maxSizeMB}MB limit`);
      return;
    }
    setSelectedFile(file);
    onFileSelect(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div
      onClick={() => !isUploading && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
      } ${isUploading ? "pointer-events-none opacity-50" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleInputChange}
      />
      <Upload className="mb-2 size-8 text-muted-foreground" />
      {selectedFile ? (
        <p className="text-sm font-medium">{selectedFile.name}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Drag and drop a file here, or click to browse
        </p>
      )}
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      {isUploading && <p className="mt-1 text-sm text-muted-foreground">Uploading...</p>}
    </div>
  );
}
